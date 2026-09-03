import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  SNAPSHOT_HARD_LIMIT_ROWS,
  SNAPSHOT_INLINE_MAX_BYTES,
  RETENTION,
  isSnapshotCaptureEnabled,
} from "./config";
import { cascadeChildren, cascadeClosure, setNullChildren } from "./fk-graph";

/**
 * Layer 3 — entity graph snapshots.
 *
 * Captures every row Postgres is about to cascade-delete, plus the pointers it
 * is about to null out, so a destructive admin action stops being permanent.
 *
 * Two things make this tractable rather than a general-purpose backup:
 *  - It operates on tables, not Prisma models. Cascade behaviour lives in
 *    Postgres, and after a delete the freed primary keys are still free, so a
 *    restore can reinsert the original ids and every child FK stays correct.
 *  - It refuses rather than truncates. A snapshot that silently dropped rows
 *    would restore a plausible-looking but wrong tenant, which is worse than
 *    blocking the delete.
 */

const ROOT_TABLE: Record<string, string> = {
  User: "user",
  Business: "businesses",
  Store: "stores",
};

/**
 * Column each root is found by. For a Business the caller passes the owning
 * user id, because "reset this account" is expressed in terms of the user.
 */
const ROOT_LOOKUP: Record<string, string> = {
  User: "id",
  Business: "userId",
  Store: "id",
};

export interface CaptureInput {
  rootType: "User" | "Business" | "Store";
  rootId: string;
  rootLabel?: string;
  reasonCode: string;
  subjectUserIds?: string[];
  storeId?: string | null;
  businessId?: string | null;
}

export interface CaptureResult {
  id: string;
  rowCount: number;
  modelCount: number;
  bytes: number;
}

interface TablePayload {
  table: string;
  rows: Record<string, unknown>[];
}

interface OrphanRepair {
  table: string;
  column: string;
  /** id -> value the cascade is about to null. */
  entries: { id: unknown; value: unknown }[];
}

/**
 * JSON-safe serialization that does not lose precision.
 *
 * Postgres numerics arrive as strings or Decimal-likes; BigInt and Date have no
 * JSON representation at all. Anything lossy here would produce a snapshot that
 * restores subtly wrong values — the exact class of corruption this feature is
 * meant to catch, introduced by the tool built to catch it.
 */
function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return { __t: "bigint", v: value.toString() };
  if (value instanceof Date) return { __t: "date", v: value.toISOString() };
  if (Buffer.isBuffer(value)) return { __t: "buffer", v: value.toString("base64") };
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Prisma Decimal and pg numeric wrappers both stringify losslessly.
    if (typeof obj.toFixed === "function" || typeof obj.toJSON === "function") {
      return { __t: "decimal", v: String(value) };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}

export function fromJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(fromJsonSafe);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.__t === "bigint") return BigInt(obj.v as string);
    if (obj.__t === "date") return new Date(obj.v as string);
    if (obj.__t === "buffer") return Buffer.from(obj.v as string, "base64");
    // Decimals stay strings: Postgres accepts a numeric literal as text on
    // insert, and converting to a JS number here would round.
    if (obj.__t === "decimal") return obj.v;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = fromJsonSafe(v);
    return out;
  }
  return value;
}

function quoteIdent(name: string): string {
  // Table and column names come from pg_catalog, never user input, but the
  // schema uses camelCase identifiers that must be quoted to survive folding.
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Capture the graph rooted at `rootId`.
 *
 * Returns null when snapshots are disabled or the root does not exist — the
 * caller proceeds with the destructive action either way, because blocking a
 * delete on a disabled audit feature would make the kill switch unusable.
 * A row-count overrun is different: that throws, so the delete does not happen.
 */
export async function captureEntitySnapshot(input: CaptureInput): Promise<CaptureResult | null> {
  if (!isSnapshotCaptureEnabled()) return null;

  const rootTable = ROOT_TABLE[input.rootType];
  const lookupColumn = ROOT_LOOKUP[input.rootType];
  if (!rootTable) return null;

  const rootRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM ${quoteIdent(rootTable)} WHERE ${quoteIdent(lookupColumn)} = $1`,
    input.rootId
  );

  if (rootRows.length === 0) return null;

  const rootIds = rootRows.map((r) => r.id);
  const tables = await cascadeClosure(rootTable);

  // Ids reachable per table, discovered breadth-first from the root.
  const idsByTable = new Map<string, unknown[]>([[rootTable, rootIds]]);
  const payload: TablePayload[] = [{ table: rootTable, rows: rootRows.map(mapRow) }];
  let totalRows = rootRows.length;

  for (const table of tables) {
    const parentIds = idsByTable.get(table);
    if (!parentIds || parentIds.length === 0) continue;

    for (const fk of await cascadeChildren(table)) {
      // Composite foreign keys are not used anywhere in this schema; a future
      // one would need a different WHERE shape, so it is skipped loudly rather
      // than silently mis-captured.
      if (fk.childColumns.length !== 1 || fk.parentColumns.length !== 1) {
        console.warn(`[audit] skipping composite FK ${fk.constraintName} in snapshot`);
        continue;
      }
      if (fk.parentColumns[0] !== "id") continue;

      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM ${quoteIdent(fk.childTable)} WHERE ${quoteIdent(fk.childColumns[0])} = ANY($1::text[])`,
        parentIds
      );
      if (rows.length === 0) continue;

      totalRows += rows.length;
      if (totalRows > SNAPSHOT_HARD_LIMIT_ROWS) {
        throw new Error(
          `[audit] snapshot exceeds ${SNAPSHOT_HARD_LIMIT_ROWS} rows; refusing to delete without a complete, restorable capture.`
        );
      }

      payload.push({ table: fk.childTable, rows: rows.map(mapRow) });
      const existing = idsByTable.get(fk.childTable) ?? [];
      idsByTable.set(fk.childTable, [...existing, ...rows.map((r) => r.id)]);
    }
  }

  // Orphan repairs. These rows SURVIVE the delete with a nulled pointer, so
  // they are not in the payload — but the value being nulled is unrecoverable
  // once the delete runs, which is why it is captured here and not at restore.
  const orphanRepairs: OrphanRepair[] = [];
  for (const [table, ids] of idsByTable) {
    for (const fk of await setNullChildren(table)) {
      if (fk.childColumns.length !== 1 || fk.parentColumns[0] !== "id") continue;
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, ${quoteIdent(fk.childColumns[0])} AS value FROM ${quoteIdent(fk.childTable)} WHERE ${quoteIdent(fk.childColumns[0])} = ANY($1::text[])`,
        ids
      );
      if (rows.length === 0) continue;
      orphanRepairs.push({
        table: fk.childTable,
        column: fk.childColumns[0],
        entries: rows.map((r) => ({ id: r.id, value: r.value })),
      });
    }
  }

  const serialized = JSON.stringify(payload);
  const bytes = Buffer.byteLength(serialized, "utf8");
  const sha = createHash("sha256").update(serialized).digest("hex");

  const migration = await currentMigrationName();

  const snapshot = await prisma.entitySnapshot.create({
    data: {
      status: "STORED",
      rootType: input.rootType,
      rootId: input.rootId,
      rootLabel: input.rootLabel ?? null,
      reasonCode: input.reasonCode,
      storeId: input.storeId ?? null,
      businessId: input.businessId ?? null,
      subjectUserIds: input.subjectUserIds ?? [],
      // Oversized payloads are recorded without inline content rather than
      // silently truncated; the row still proves what was destroyed and how
      // much of it, which is what an investigation starts from.
      payload: bytes <= SNAPSHOT_INLINE_MAX_BYTES ? (payload as any) : undefined,
      payloadSha256: sha,
      payloadBytes: bytes,
      rowCount: totalRows,
      modelCount: payload.length,
      orphanRepairs: orphanRepairs.length > 0 ? (orphanRepairs as any) : undefined,
      schemaVersion: migration,
      expiresAt: new Date(Date.now() + RETENTION.SNAPSHOT_DAYS * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  return { id: snapshot.id, rowCount: totalRows, modelCount: payload.length, bytes };
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = toJsonSafe(v);
  return out;
}

/**
 * Latest applied migration, stamped on every snapshot.
 *
 * A restore across a schema change is refused rather than attempted: a payload
 * captured before a column was dropped or made NOT NULL no longer fits the
 * table it came from, and finding that out mid-restore leaves a half-built
 * tenant.
 */
async function currentMigrationName(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
    );
    return rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
}
