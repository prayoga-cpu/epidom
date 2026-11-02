/**
 * Everything the journal does after the fact, in one idempotent pass per
 * store: append any paid order a path failed to record, close the days,
 * months and years that are over, and archive the closed months.
 *
 * Run when a sale opens a new business day (queueFiscalMaintenance, after the
 * response), when the owner opens the Fiscal journal page, and nightly by the
 * fiscal-maintenance Inngest job. Running it twice does nothing the second
 * time.
 */
import { prisma } from "@/lib/prisma";
import { storeLocalDay } from "@/lib/services/order-queue-number";
import { archiveClosedMonths } from "./archive";
import { closeDueDays, closeDueMonths, closeDueYears } from "./closures";
import {
  FISCAL_JOURNAL_START,
  loadStoreFiscalContext,
  recordCancellationInTx,
  recordRefundInTx,
  recordSaleInTx,
} from "./journal";
import { decimal } from "./entry-payload";

/** How far back the catch-up looks for a paid order with no SALE entry. */
const CATCH_UP_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;
const CATCH_UP_BATCH = 200;
/**
 * A day closes only once it has been over for this long, so a sale committing
 * at 23:59:59 is never left out of the closure that ran a moment later.
 */
const CLOSE_GRACE_MS = 10 * 60 * 1000;

export interface MaintenanceResult {
  lateSales: number;
  lateRefunds: number;
  lateCancellations: number;
  closedDays: string[];
  closedMonths: string[];
  closedYears: string[];
  archives: string[];
}

/** Paid orders since the journal started that no path recorded. */
async function catchUp(
  storeId: string,
  now: Date
): Promise<{ sales: number; refunds: number; cancels: number }> {
  const since = new Date(
    Math.max(FISCAL_JOURNAL_START.getTime(), now.getTime() - CATCH_UP_WINDOW_MS)
  );
  const missingSales = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o."id" FROM "orders" o
    WHERE o."storeId" = ${storeId}
      AND o."paymentStatus"::text IN ('PAID', 'REFUNDED')
      AND o."createdAt" >= ${since}
      AND NOT EXISTS (
        SELECT 1 FROM "fiscal_entries" f WHERE f."dedupeKey" = o."id" || ':SALE'
      )
    ORDER BY o."createdAt" ASC
    LIMIT ${CATCH_UP_BATCH}`;
  for (const { id } of missingSales) {
    await prisma.$transaction((tx) => recordSaleInTx(tx, { storeId, orderId: id, late: true }));
  }

  // Refunds the journal holds less of than the order says was refunded: one
  // late entry for the difference, through the order's own method (which
  // tender gave it back is not known after the fact).
  const missingRefunds = await prisma.$queryRaw<
    {
      id: string;
      refundAmount: string;
      journaled: string;
      paymentMethod: string;
      refundReason: string | null;
    }[]
  >`
    SELECT o."id", o."refundAmount"::text AS "refundAmount", o."paymentMethod"::text AS "paymentMethod",
      o."refundReason", COALESCE(r."journaled", 0)::text AS "journaled"
    FROM "orders" o
    LEFT JOIN LATERAL (
      SELECT -SUM(f."amount") AS "journaled" FROM "fiscal_entries" f
      WHERE f."orderId" = o."id" AND f."kind"::text = 'REFUND'
    ) r ON true
    WHERE o."storeId" = ${storeId}
      AND o."refundAmount" > COALESCE(r."journaled", 0)
      AND o."createdAt" >= ${since}
    LIMIT ${CATCH_UP_BATCH}`;
  for (const row of missingRefunds) {
    const amount = decimal(row.refundAmount).minus(decimal(row.journaled));
    await prisma.$transaction((tx) =>
      recordRefundInTx(tx, {
        storeId,
        orderId: row.id,
        amount,
        reason: row.refundReason,
        tenders: [{ method: row.paymentMethod, amount }],
        refundedTotal: row.refundAmount,
        late: true,
      })
    );
  }

  const missingCancels = await prisma.$queryRaw<{ id: string }[]>`
    SELECT f."orderId" AS "id" FROM "fiscal_entries" f
    JOIN "orders" o ON o."id" = f."orderId"
    WHERE f."storeId" = ${storeId}
      AND f."kind"::text = 'SALE'
      AND o."status"::text = 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM "fiscal_entries" c WHERE c."dedupeKey" = f."orderId" || ':CANCELLATION'
      )
    LIMIT ${CATCH_UP_BATCH}`;
  for (const { id } of missingCancels) {
    await prisma.$transaction((tx) =>
      recordCancellationInTx(tx, { storeId, orderId: id, late: true })
    );
  }
  return {
    sales: missingSales.length,
    refunds: missingRefunds.length,
    cancels: missingCancels.length,
  };
}

export async function runFiscalMaintenance(
  storeId: string,
  now: Date = new Date()
): Promise<MaintenanceResult> {
  const caught = await catchUp(storeId, now);
  const { timezone } = await loadStoreFiscalContext(prisma, storeId);
  const cutoffDay = storeLocalDay(new Date(now.getTime() - CLOSE_GRACE_MS), timezone);

  const closedDays = await closeDueDays(storeId, cutoffDay);
  const closedMonths = await closeDueMonths(storeId, cutoffDay.slice(0, 7));
  const closedYears = await closeDueYears(storeId, cutoffDay.slice(0, 4));
  const archives = await archiveClosedMonths(storeId);

  return {
    lateSales: caught.sales,
    lateRefunds: caught.refunds,
    lateCancellations: caught.cancels,
    closedDays,
    closedMonths,
    closedYears,
    archives,
  };
}
