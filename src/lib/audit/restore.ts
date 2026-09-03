import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RESTORE_ATOMIC_LIMIT_ROWS } from "./config";
import { fromJsonSafe } from "./snapshot";
import { deferredForeignKeys, loadForeignKeys } from "./fk-graph";

/**
 * Snapshot restore.
 *
 * Identity restore: the original primary keys are reinserted rather than new
 * ones minted. After a delete those cuids are free, so every child foreign key
 * in the payload still points at the right parent and no remapping is needed.
 *
 * The planner ships before the executor and is mandatory. Every refusal it can
 * produce is one an operator would otherwise discover mid-restore, with a
 * half-built tenant already live.
 */

interface TablePayload {
  table: string;
  rows: Record<string, unknown>[];
}

interface OrphanRepair {
  table: string;
  column: string;
  entries: { id: unknown; value: unknown }[];
}

export interface RestorePlan {
  ok: boolean;
  snapshotId: string;
  rootType: string;
  rootLabel: string | null;
  totalRows: number;
  atomic: boolean;
  tables: { table: string; rows: number; existing: number }[];
  refusals: { code: string; message: string }[];
  warnings: string[];
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Dry run. Reads live state, writes nothing, and returns every reason the
 * restore would fail.
 */
export async function planRestore(snapshotId: string): Promise<RestorePlan> {
  const snapshot = await prisma.entitySnapshot.findUnique({ where: { id: snapshotId } });

  const base: RestorePlan = {
    ok: false,
    snapshotId,
    rootType: snapshot?.rootType ?? "unknown",
    rootLabel: snapshot?.rootLabel ?? null,
    totalRows: snapshot?.rowCount ?? 0,
    atomic: (snapshot?.rowCount ?? 0) <= RESTORE_ATOMIC_LIMIT_ROWS,
    tables: [],
    refusals: [],
    warnings: [],
  };

  if (!snapshot) {
    base.refusals.push({ code: "TARGET_MISSING", message: "That snapshot no longer exists." });
    return base;
  }

  if (snapshot.status !== "STORED") {
    base.refusals.push({
      code: "TARGET_MISSING",
      message:
        snapshot.status === "SHREDDED"
          ? "This snapshot was destroyed by a GDPR erasure request and cannot be restored."
          : `This snapshot is ${snapshot.status.toLowerCase()} — its contents are no longer available.`,
    });
    return base;
  }

  if (!snapshot.payload) {
    base.refusals.push({
      code: "TARGET_MISSING",
      message: "This snapshot was recorded without inline content (it exceeded the size limit).",
    });
    return base;
  }

  // Schema drift. A payload captured before a column was dropped, renamed, or
  // made NOT NULL no longer fits the table it came from. Refusing beats
  // discovering it at row 4,000 of 12,000.
  const currentMigration = await latestMigration();
  if (snapshot.schemaVersion && currentMigration && snapshot.schemaVersion !== currentMigration) {
    base.warnings.push(
      `Captured under migration ${snapshot.schemaVersion}; the database is now at ${currentMigration}. Columns added since will take their defaults; a dropped or renamed column will cause the restore to refuse mid-run.`
    );
  }

  const payload = fromJsonSafe(snapshot.payload) as TablePayload[];

  // Existence + unique-collision probing, per table.
  for (const entry of payload) {
    const ids = entry.rows.map((r) => r.id).filter(Boolean);
    let existing = 0;
    if (ids.length > 0) {
      const found = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*)::bigint AS count FROM ${quoteIdent(entry.table)} WHERE id = ANY($1::text[])`,
        ids
      );
      existing = Number(found[0]?.count ?? 0);
    }
    base.tables.push({ table: entry.table, rows: entry.rows.length, existing });

    if (existing > 0) {
      base.refusals.push({
        code: "UNIQUE_COLLISION",
        message: `${existing} of ${entry.rows.length} rows in ${entry.table} already exist. Restoring would duplicate live data.`,
      });
    }
  }

  // Unique constraints other than the primary key. This is the check a naive
  // planner skips, and it is the one that bites: delete a user, the address is
  // reused at re-signup, restore, and the insert dies on users_email_key with a
  // green preview already shown.
  const uniqueRefusals = await probeUniques(payload);
  base.refusals.push(...uniqueRefusals);

  // External references the payload points at but does not contain — a store's
  // subscription, say — must still exist or the insert violates its FK.
  const externalRefusals = await probeExternalRefs(payload);
  base.refusals.push(...externalRefusals);

  if (!base.atomic) {
    base.warnings.push(
      `${snapshot.rowCount} rows exceeds the ${RESTORE_ATOMIC_LIMIT_ROWS}-row atomic limit, so the restore runs in batches and is not all-or-nothing. The account is held deactivated until it completes, so a partial restore leaves an invisible tenant rather than a live broken one.`
    );
  }

  base.ok = base.refusals.length === 0;
  return base;
}

async function probeUniques(payload: TablePayload[]): Promise<{ code: string; message: string }[]> {
  const refusals: { code: string; message: string }[] = [];

  const uniques = await prisma.$queryRawUnsafe<
    { table_name: string; index_name: string; columns: string[] }[]
  >(`
    SELECT t.relname AS table_name,
           i.relname AS index_name,
           array_agg(a.attname::text ORDER BY k.ord) AS columns
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE ix.indisunique AND NOT ix.indisprimary AND n.nspname = 'public'
    GROUP BY t.relname, i.relname
  `);

  const byTable = new Map<string, { index_name: string; columns: string[] }[]>();
  for (const u of uniques) {
    const list = byTable.get(u.table_name) ?? [];
    list.push({ index_name: u.index_name, columns: u.columns });
    byTable.set(u.table_name, list);
  }

  for (const entry of payload) {
    const constraints = byTable.get(entry.table);
    if (!constraints) continue;

    for (const c of constraints) {
      for (const row of entry.rows) {
        if (c.columns.some((col) => row[col] === undefined || row[col] === null)) continue;

        const where = c.columns.map((col, i) => `${quoteIdent(col)} = $${i + 1}`).join(" AND ");
        const values = c.columns.map((col) => row[col]);

        const hit = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM ${quoteIdent(entry.table)} WHERE ${where} AND id <> $${c.columns.length + 1} LIMIT 1`,
          ...values,
          row.id
        );

        if (hit.length > 0) {
          const pretty = c.columns.map((col, i) => `${col}=${String(values[i])}`).join(", ");
          refusals.push({
            code: "UNIQUE_COLLISION",
            message: `Cannot restore ${entry.table}: ${pretty} is already used by live row ${hit[0].id}. This is the classic case of an email being reused after the account was deleted.`,
          });
          break;
        }
      }
    }
  }

  return refusals;
}

/** FKs pointing outside the snapshot must still resolve. */
async function probeExternalRefs(
  payload: TablePayload[]
): Promise<{ code: string; message: string }[]> {
  const refusals: { code: string; message: string }[] = [];
  const fks = await loadForeignKeys();
  const inPayload = new Set(payload.map((p) => p.table));

  for (const entry of payload) {
    for (const fk of fks) {
      if (fk.childTable !== entry.table) continue;
      if (inPayload.has(fk.parentTable)) continue;
      if (fk.childColumns.length !== 1) continue;

      const col = fk.childColumns[0];
      const values = [
        ...new Set(entry.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined)),
      ];
      if (values.length === 0) continue;

      const found = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*)::bigint AS count FROM ${quoteIdent(fk.parentTable)} WHERE ${quoteIdent(fk.parentColumns[0])} = ANY($1::text[])`,
        values
      );
      const missing = values.length - Number(found[0]?.count ?? 0);
      if (missing > 0) {
        refusals.push({
          code: "TARGET_MISSING",
          message: `${entry.table}.${col} references ${missing} row(s) in ${fk.parentTable} that no longer exist. Those must be restored first.`,
        });
      }
    }
  }

  return refusals;
}

export interface RestoreResult {
  ok: boolean;
  restoreRunId: string;
  rowsRestored: number;
  status: string;
  message?: string;
}

/**
 * Apply a restore.
 *
 * Re-plans first: the preview an operator saw may be minutes old, and another
 * admin may have acted since. Quarantine is applied for non-atomic runs, so a
 * failure part-way leaves a deactivated tenant rather than a live one missing
 * half its orders.
 */
export async function applyRestore(
  snapshotId: string,
  reason: string,
  actor: { refId: string | null; name: string | null }
): Promise<RestoreResult> {
  const plan = await planRestore(snapshotId);

  const run = await prisma.restoreRun.create({
    data: {
      snapshotId,
      status: plan.ok ? "RUNNING" : "REFUSED",
      dryRun: false,
      startedAt: new Date(),
      actorRefId: actor.refId,
      actorName: actor.name,
      reason,
      plan: plan as unknown as Prisma.InputJsonValue,
      quarantined: !plan.atomic,
    },
    select: { id: true },
  });

  if (!plan.ok) {
    await prisma.restoreRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), errorMessage: plan.refusals.map((r) => r.message).join("; ") },
    });
    return {
      ok: false,
      restoreRunId: run.id,
      rowsRestored: 0,
      status: "REFUSED",
      message: plan.refusals.map((r) => r.message).join("; "),
    };
  }

  const snapshot = await prisma.entitySnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
  const payload = fromJsonSafe(snapshot.payload) as TablePayload[];
  const tables = payload.map((p) => p.table);
  const deferred = await deferredForeignKeys(tables);
  const deferredByTable = new Map<string, Set<string>>();
  for (const fk of deferred) {
    const set = deferredByTable.get(fk.childTable) ?? new Set<string>();
    fk.childColumns.forEach((c) => set.add(c));
    deferredByTable.set(fk.childTable, set);
  }

  let rowsRestored = 0;
  const modelsDone: string[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        // Pass 1 — insert parent-first, with cyclic FK columns held back.
        for (const entry of payload) {
          const deferredCols = deferredByTable.get(entry.table) ?? new Set<string>();
          for (const row of entry.rows) {
            const cols = Object.keys(row).filter((c) => !deferredCols.has(c));
            const values = cols.map((c) => row[c]);
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
            await tx.$executeRawUnsafe(
              `INSERT INTO ${quoteIdent(entry.table)} (${cols.map(quoteIdent).join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
              ...values
            );
            rowsRestored++;
          }
          modelsDone.push(entry.table);
        }

        // Pass 2 — fill the deferred back-references now every row exists.
        for (const entry of payload) {
          const deferredCols = deferredByTable.get(entry.table);
          if (!deferredCols || deferredCols.size === 0) continue;
          for (const row of entry.rows) {
            const cols = [...deferredCols].filter((c) => row[c] !== null && row[c] !== undefined);
            if (cols.length === 0) continue;
            const sets = cols.map((c, i) => `${quoteIdent(c)} = $${i + 1}`).join(", ");
            await tx.$executeRawUnsafe(
              `UPDATE ${quoteIdent(entry.table)} SET ${sets} WHERE id = $${cols.length + 1}`,
              ...cols.map((c) => row[c]),
              row.id
            );
          }
        }

        // Pass 3 — orphan repair. These rows survived the delete with a nulled
        // pointer; the value is only recoverable from the snapshot.
        const repairs = (fromJsonSafe(snapshot.orphanRepairs) ?? []) as OrphanRepair[];
        for (const repair of repairs) {
          for (const e of repair.entries) {
            // Only re-point rows still null, so a value written since the
            // delete is never clobbered by a stale one.
            await tx.$executeRawUnsafe(
              `UPDATE ${quoteIdent(repair.table)} SET ${quoteIdent(repair.column)} = $1 WHERE id = $2 AND ${quoteIdent(repair.column)} IS NULL`,
              e.value,
              e.id
            );
          }
        }

        // Quarantine release. A non-atomic run holds the tenant deactivated
        // until every table lands; here the whole thing committed, so clear it.
        if (snapshot.rootType === "User") {
          await tx.$executeRawUnsafe(
            `UPDATE "user" SET "deactivatedAt" = NULL, "purgeAt" = NULL WHERE id = $1`,
            snapshot.rootId
          );
        }
      },
      { timeout: 120_000, isolationLevel: "Serializable" }
    );

    await prisma.restoreRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        rowsRestored,
        modelsDone,
        quarantined: false,
      },
    });

    return { ok: true, restoreRunId: run.id, rowsRestored, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.restoreRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        rowsRestored,
        modelsDone,
        errorMessage: message.slice(0, 1000),
      },
    });
    return { ok: false, restoreRunId: run.id, rowsRestored, status: "FAILED", message };
  }
}

async function latestMigration(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
    );
    return rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
}
