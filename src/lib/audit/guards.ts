import { prisma } from "@/lib/prisma";
import type { Refusal } from "./catalog-types";

/**
 * Machine-derived guards for the reversal engine.
 *
 * Both checks here exist because a hand-maintained list was found to be wrong
 * in ways that only surface under incident pressure — read live from
 * `pg_index`/`pg_attribute` so they cannot drift when a migration adds a
 * column.
 *
 * Deliberately NOT `Prisma.dmmf.datamodel` — verified live against this
 * database that Prisma 7's runtime DMMF strips `isUnique`, `isId` and
 * `uniqueFields`/`uniqueIndexes` from every field (a model's `fields` entries
 * carry only `name`/`kind`/`type`). Code written against those properties does
 * not merely miss coverage, it throws or silently returns nothing — worse than
 * the hand-maintained list this replaces, because a caller trusting an empty
 * result sees a false "no collisions" instead of a crash. This is the same
 * DMMF-stripping fk-graph.ts already routes around for cascade metadata; see
 * its module comment.
 */

interface UniqueProbe {
  table: string;
  columns: string[];
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Every non-primary unique constraint on `table`, read from `pg_index`.
 *
 * A restore planner that checks primary keys only will pass a row straight
 * into a constraint violation. Several of this schema's uniques are global
 * rather than tenant-scoped — `User.email`, `PushSubscription.endpoint`,
 * `Order.orderNumber`, `SupplierOrder.orderNumber`,
 * `ProductionBatch.batchNumber`, `Subscription.stripeCustomerId` — so the
 * classic failure is: delete a user, the address is reused at re-signup,
 * restore, green preview, then a mid-restore `users_email_key` violation.
 */
export async function uniqueConstraintsFor(table: string): Promise<UniqueProbe[]> {
  const rows = await prisma.$queryRawUnsafe<{ index_name: string; columns: string[] }[]>(
    `
    SELECT i.relname AS index_name,
           array_agg(a.attname::text ORDER BY k.ord) AS columns
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE ix.indisunique AND NOT ix.indisprimary AND n.nspname = 'public' AND t.relname = $1
    GROUP BY i.relname
    `,
    table
  );

  return rows.map((r) => ({ table, columns: r.columns }));
}

/**
 * Probe rows about to be inserted against every unique constraint on `table`.
 * Returns a refusal naming the field and the conflicting row, never a bare
 * "collision" — an operator needs to know which address is already taken.
 *
 * `table` is a Postgres table name (e.g. `"user"`), not a Prisma model name —
 * callers reach this through raw SQL already (see restore.ts), so there is no
 * model delegate to go through.
 */
export async function probeUniqueCollisions(
  table: string,
  rows: Record<string, unknown>[]
): Promise<Refusal | null> {
  if (rows.length === 0) return null;
  const probes = await uniqueConstraintsFor(table);
  if (probes.length === 0) return null;

  for (const probe of probes) {
    for (const row of rows) {
      // A constraint whose columns are not all present in the payload cannot
      // be probed; skipping is correct, since the insert will not set them.
      if (probe.columns.some((c) => row[c] === undefined || row[c] === null)) continue;

      const where = probe.columns.map((c, i) => `${quoteIdent(c)} = $${i + 1}`).join(" AND ");
      const values = probe.columns.map((c) => row[c]);

      const hit = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM ${quoteIdent(table)} WHERE ${where} AND id <> $${probe.columns.length + 1} LIMIT 1`,
        ...values,
        row.id
      );

      if (hit.length > 0) {
        const pretty = probe.columns.map((c, i) => `${c}=${String(values[i])}`).join(", ");
        return {
          code: "UNIQUE_COLLISION",
          message: `Cannot restore: ${table} ${pretty} is already used by an existing record (${hit[0].id}). Restoring would violate a unique constraint.`,
        };
      }
    }
  }

  return null;
}

/**
 * Refuse a reversal whose value has already been consumed by a materialised
 * figure that nothing recomputes.
 *
 * `Shift.closedAt` / `expectedCash` / `cashDifference` are written once at
 * close and read directly by the cash-reconciliation report, which does no
 * recompute. Reverting an order's payment method, a settle-up, or a refund
 * whose date falls inside a closed till therefore desynchronises a financial
 * report permanently and silently — the report will simply be wrong, with no
 * error anywhere.
 */
export async function checkDownstreamConsumption(
  targetType: string | null,
  targetId: string | null
): Promise<Refusal | null> {
  if (targetType !== "Order" || !targetId) return null;

  try {
    const order = await prisma.order.findUnique({
      where: { id: targetId },
      select: { id: true, orderDate: true, storeId: true, shiftId: true },
    });
    if (!order) return null;

    // Direct linkage first: the order names its till session.
    if (order.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: order.shiftId },
        select: { id: true, closedAt: true },
      });
      if (shift?.closedAt) {
        return closedShiftRefusal(shift.id, shift.closedAt);
      }
    }

    // Otherwise fall back to the time window. Order.shiftId is nullable and
    // often unset, but the reconciliation report sums by window regardless, so
    // an order inside a closed window still affects a settled figure.
    // The till session's window is openedAt..closedAt. Note this is `Shift`,
    // the cash-drawer session — not `ScheduleShift`, the roster block. They are
    // separate domains and only this one carries a cash count.
    const covering = await prisma.shift.findFirst({
      where: {
        storeId: order.storeId,
        closedAt: { not: null, gte: order.orderDate },
        openedAt: { lte: order.orderDate },
      },
      select: { id: true, closedAt: true },
      orderBy: { openedAt: "desc" },
    });

    if (covering?.closedAt) {
      return closedShiftRefusal(covering.id, covering.closedAt);
    }
  } catch (error) {
    // A guard that cannot run must not silently pass. Refusing is the safe
    // failure: the operator can retry, where a false "all clear" is permanent.
    console.error("[audit] downstream-consumption check failed:", error);
    return {
      code: "DOWNSTREAM_CONSUMED",
      message:
        "Could not verify whether this order falls inside a closed till session. Refusing rather than risk desynchronising a cash reconciliation.",
    };
  }

  return null;
}

function closedShiftRefusal(shiftId: string, closedAt: Date): Refusal {
  return {
    code: "DOWNSTREAM_CONSUMED",
    message: `This order falls inside a till session closed on ${closedAt.toISOString().slice(0, 16).replace("T", " ")}. Its cash count was written once and is never recomputed, so reverting would leave the cash reconciliation permanently wrong. Post a correcting transaction instead.`,
    remedyHref: `#shift-${shiftId}`,
  };
}

/**
 * Models whose rows are ledger entries: append-only records where an inverse
 * write corrupts the invariant that the balance equals the sum of movements.
 */
const LEDGER_MODELS = new Set(["StockMovement", "WasteEntry", "ProductionBatch"]);

export function isLedgerModel(targetType: string | null | undefined): boolean {
  return Boolean(targetType && LEDGER_MODELS.has(targetType));
}
