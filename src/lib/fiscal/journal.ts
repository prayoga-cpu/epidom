/**
 * The fiscal journal's write side: one signed, chained entry per sale, refund
 * and cancellation of a paid order, appended INSIDE the transaction that moves
 * the money, so the record commits with the payment (and never without it).
 * The write runs in a savepoint (`guarded`): if it fails, the payment still
 * commits and the catch-up records it late. docs/FISCAL_JOURNAL.md has the why.
 *
 * Every function here takes the caller's `tx` and is idempotent on the event
 * (FiscalEntry.dedupeKey): a retried webhook or a second settle attempt finds
 * the record already there and appends nothing.
 *
 * Callers: applySettlementBookkeeping (till checkout and finalize),
 * settlePendingOrderInTx (Mark as Paid), cancelOrderInTx, applyOrderRefund,
 * the Xendit webhook and the aggregator e-mail import. The catch-up sweep in
 * maintenance.ts appends anything a path missed, flagged `late`.
 */
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { storeLocalDay } from "@/lib/services/order-queue-number";
import { lockChainHead, saveChainHead, sealRecord } from "./chain";
import {
  buildCancellationBody,
  buildRefundBody,
  buildSaleBody,
  JOURNAL_ORDER_SELECT,
  money,
  type EntryBody,
} from "./entry-payload";

type Tx = Prisma.TransactionClient;

/**
 * Orders created from this instant on must each have a SALE entry once paid;
 * the catch-up sweep and verification only look from here. Sales before it
 * predate the journal and are not backfilled.
 */
export const FISCAL_JOURNAL_START = new Date("2026-11-02T00:00:00.000Z");

/** Statuses of an order whose money was taken. */
const PAID_STATUSES = ["PAID", "REFUNDED"];

export interface StoreFiscalContext {
  timezone: string;
  currency: string;
}

export async function loadStoreFiscalContext(tx: Tx, storeId: string): Promise<StoreFiscalContext> {
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: {
      syncFinanceWithBusiness: true,
      financeSettings: { select: { currency: true } },
      business: { select: { timezone: true, financeSettings: { select: { currency: true } } } },
    },
  });
  const currency = store?.syncFinanceWithBusiness
    ? store.business.financeSettings?.currency
    : store?.financeSettings?.currency;
  return { timezone: store?.business.timezone ?? "UTC", currency: currency ?? "IDR" };
}

/**
 * Run the day/month closures after the response, when an entry opens a new
 * business day. Outside a request (a background job) there is no after(), and
 * the nightly sweep closes the day instead.
 */
export function queueFiscalMaintenance(storeId: string): void {
  try {
    after(async () => {
      try {
        const { runFiscalMaintenance } = await import("./maintenance");
        await runFiscalMaintenance(storeId);
      } catch (err) {
        console.error("[FISCAL] maintenance after a new day failed:", err);
      }
    });
  } catch {
    // Not in a request scope.
  }
}

async function appendEntryInTx(
  tx: Tx,
  args: {
    storeId: string;
    dedupeKey: string;
    orderId: string;
    orderNumber: string;
    body: EntryBody;
    late: boolean;
  }
): Promise<{ seq: number; hash: string } | null> {
  const { storeId, body } = args;
  // Read before taking the lock: the lock is held until commit.
  const ctx = await loadStoreFiscalContext(tx, storeId);

  const head = await lockChainHead(tx, storeId, "ENTRY");
  const existing = await tx.fiscalEntry.findUnique({
    where: { dedupeKey: args.dedupeKey },
    select: { id: true },
  });
  if (existing) return null;

  const recordedAt = new Date();
  // Days never run backwards, even if the store's timezone is changed.
  const today = storeLocalDay(recordedAt, ctx.timezone);
  const businessDay = head.lastDay > today ? head.lastDay : today;
  const seq = head.lastSeq + 1;
  const totalNet = head.totalNet.plus(body.amount);
  const totalAbsolute = head.totalAbsolute.plus(body.amount.abs());

  const sealed = await sealRecord(tx, {
    ...body.fields,
    chain: "ENTRY",
    store: storeId,
    seq,
    kind: body.kind,
    recordedAt: recordedAt.toISOString(),
    businessDay,
    currency: ctx.currency,
    amount: money(body.amount),
    totals: { net: money(totalNet), absolute: money(totalAbsolute) },
    late: args.late,
    prev: head.lastHash,
  });

  await tx.fiscalEntry.create({
    data: {
      storeId,
      seq,
      kind: body.kind,
      dedupeKey: args.dedupeKey,
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      businessDay,
      recordedAt,
      currency: ctx.currency,
      amount: body.amount,
      totalNet,
      totalAbsolute,
      payload: sealed.payload,
      prevHash: head.lastHash,
      hash: sealed.hash,
      signature: sealed.signature,
      keyId: sealed.keyId,
      late: args.late,
    },
  });
  await saveChainHead(tx, storeId, "ENTRY", {
    lastSeq: seq,
    lastHash: sealed.hash,
    lastDay: businessDay,
    totalNet,
    totalAbsolute,
  });

  if (head.lastDay && businessDay > head.lastDay) queueFiscalMaintenance(storeId);
  return { seq, hash: sealed.hash };
}

async function readOrder(tx: Tx, storeId: string, orderId: string) {
  return tx.order.findFirst({
    where: { id: orderId, storeId },
    select: { ...JOURNAL_ORDER_SELECT, createdAt: true },
  });
}

/**
 * Run one journal write inside a savepoint. If it fails (the fiscal tables
 * missing on a database that was not migrated, a bug), only the journal write
 * is rolled back: the sale, refund or cancel itself still commits, and the
 * catch-up sweep (maintenance.ts) records it later, flagged late. A till that
 * refuses to take money is worse than a record written a moment late, and
 * verification counts any that are still missing.
 *
 * Postgres releases the chain-head lock taken inside the savepoint when it
 * rolls back, so a failed write never holds up the other tills.
 */
async function guarded(tx: Tx, what: string, write: () => Promise<void>): Promise<void> {
  await tx.$executeRawUnsafe("SAVEPOINT fiscal_journal");
  try {
    await write();
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT fiscal_journal");
  } catch (err) {
    console.error(`[FISCAL] ${what} not journaled, the catch-up will record it:`, err);
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT fiscal_journal");
  }
}

/** The SALE entry for a paid order. A no-op if it is already recorded. */
export function recordSaleInTx(
  tx: Tx,
  args: { storeId: string; orderId: string; offline?: boolean; late?: boolean }
): Promise<void> {
  return guarded(tx, `sale ${args.orderId}`, async () => {
    const order = await readOrder(tx, args.storeId, args.orderId);
    if (!order || !PAID_STATUSES.includes(order.paymentStatus)) return;
    await appendEntryInTx(tx, {
      storeId: args.storeId,
      dedupeKey: `${order.id}:SALE`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      body: buildSaleBody(order, { offline: args.offline ?? false }),
      late: args.late ?? false,
    });
  });
}

/**
 * The order's SALE entry, recording it first (late) when the order was paid
 * after the journal started but no path recorded it: a refund or cancel must
 * never be the first thing the journal knows about a sale.
 */
async function saleRef(
  tx: Tx,
  storeId: string,
  order: NonNullable<Awaited<ReturnType<typeof readOrder>>>
): Promise<{ seq: number; hash: string } | null> {
  const find = () =>
    tx.fiscalEntry.findUnique({
      where: { dedupeKey: `${order.id}:SALE` },
      select: { seq: true, hash: true },
    });
  const found = await find();
  if (found || order.createdAt < FISCAL_JOURNAL_START) return found;
  await appendEntryInTx(tx, {
    storeId,
    dedupeKey: `${order.id}:SALE`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    body: buildSaleBody(order, { offline: false }),
    late: true,
  });
  return find();
}

/** One REFUND entry per refund, keyed on the cumulative refunded total it reached. */
export function recordRefundInTx(
  tx: Tx,
  args: {
    storeId: string;
    orderId: string;
    amount: Prisma.Decimal | number | string;
    reason?: string | null;
    tenders: { method: string; amount: Prisma.Decimal | number | string }[];
    refundedTotal: Prisma.Decimal | number | string;
    late?: boolean;
  }
): Promise<void> {
  return guarded(tx, `refund ${args.orderId}`, async () => {
    const order = await readOrder(tx, args.storeId, args.orderId);
    if (!order) return;
    const sale = await saleRef(tx, args.storeId, order);
    await appendEntryInTx(tx, {
      storeId: args.storeId,
      dedupeKey: `${order.id}:REFUND:${money(args.refundedTotal)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      body: buildRefundBody(order, {
        amount: args.amount,
        reason: args.reason,
        tenders: args.tenders,
        refundedTotal: args.refundedTotal,
        sale,
      }),
      late: args.late ?? false,
    });
  });
}

/**
 * The CANCELLATION entry when a PAID order is cancelled: it takes back what
 * the till still holds for it. An unpaid order's cancel moves no money and
 * records nothing.
 */
export function recordCancellationInTx(
  tx: Tx,
  args: { storeId: string; orderId: string; late?: boolean }
): Promise<void> {
  return guarded(tx, `cancellation ${args.orderId}`, async () => {
    const order = await readOrder(tx, args.storeId, args.orderId);
    if (!order || !PAID_STATUSES.includes(order.paymentStatus)) return;
    const sale = await saleRef(tx, args.storeId, order);
    await appendEntryInTx(tx, {
      storeId: args.storeId,
      dedupeKey: `${order.id}:CANCELLATION`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      body: buildCancellationBody(order, { sale }),
      late: args.late ?? false,
    });
  });
}
