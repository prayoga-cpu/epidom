/**
 * Day, month and year closures (clôtures). A closure freezes a period's totals
 * and the perpetual totals at its end into a signed record on the store's
 * CLOSURE chain. Entries never change, so a closure can be written any time
 * after its period ends and still says exactly what that period held; it is
 * written by runFiscalMaintenance (maintenance.ts), never in a paying
 * transaction.
 *
 * Days close from their entries; months from their day closures; years from
 * their month closures, so each level is checkable against the one below.
 */
import { Prisma, type FiscalClosureKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CanonicalValue } from "./canonical";
import { lockChainHead, saveChainHead, sealRecord } from "./chain";
import { decimal, money } from "./entry-payload";

type Tx = Prisma.TransactionClient;
type Sums = Record<string, Prisma.Decimal>;

const CLOSURE_TX_TIMEOUT_MS = 30_000;

export interface PeriodSummary {
  firstEntrySeq: number;
  lastEntrySeq: number;
  entryCount: number;
  currency: string;
  mixedCurrencies: boolean;
  counts: { SALE: number; REFUND: number; CANCELLATION: number };
  salesTotal: Prisma.Decimal;
  refundsTotal: Prisma.Decimal;
  cancellationsTotal: Prisma.Decimal;
  net: Prisma.Decimal;
  taxByRate: Sums;
  tenders: Sums;
  totalNet: Prisma.Decimal;
  totalAbsolute: Prisma.Decimal;
  lastEntryHash: string;
}

function add(sums: Sums, key: string, value: Prisma.Decimal): void {
  sums[key] = (sums[key] ?? decimal(0)).plus(value);
}

function sumsToCanonical(sums: Sums): Record<string, CanonicalValue> {
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, money(v)]));
}

export interface SummarisableEntry {
  seq: number;
  kind: string;
  amount: Prisma.Decimal | string | number;
  currency: string;
  payload: string;
  hash: string;
  totalNet: Prisma.Decimal | string | number;
  totalAbsolute: Prisma.Decimal | string | number;
}

/** A day's figures from its entries, in seq order. */
export function summariseEntries(entries: SummarisableEntry[]): PeriodSummary {
  if (entries.length === 0) throw new Error("Nothing to summarise");
  const counts = { SALE: 0, REFUND: 0, CANCELLATION: 0 };
  const byKind: Sums = { SALE: decimal(0), REFUND: decimal(0), CANCELLATION: decimal(0) };
  const taxByRate: Sums = {};
  const tenders: Sums = {};
  for (const entry of entries) {
    const kind = entry.kind as keyof typeof counts;
    counts[kind] += 1;
    add(byKind, kind, decimal(entry.amount));
    const parsed = JSON.parse(entry.payload) as {
      tax?: string;
      taxRate?: string;
      tenders?: { method: string; amount: string }[];
    };
    if (parsed.tax) add(taxByRate, parsed.taxRate ?? "0.0000", decimal(parsed.tax));
    for (const tender of parsed.tenders ?? []) add(tenders, tender.method, decimal(tender.amount));
  }
  const last = entries[entries.length - 1];
  return {
    firstEntrySeq: entries[0].seq,
    lastEntrySeq: last.seq,
    entryCount: entries.length,
    currency: last.currency,
    mixedCurrencies: entries.some((e) => e.currency !== last.currency),
    counts,
    salesTotal: byKind.SALE,
    refundsTotal: byKind.REFUND,
    cancellationsTotal: byKind.CANCELLATION,
    net: byKind.SALE.plus(byKind.REFUND).plus(byKind.CANCELLATION),
    taxByRate,
    tenders,
    totalNet: decimal(last.totalNet),
    totalAbsolute: decimal(last.totalAbsolute),
    lastEntryHash: last.hash,
  };
}

interface ClosurePayload {
  firstEntrySeq: number;
  lastEntrySeq: number;
  entryCount: number;
  currency: string;
  mixedCurrencies: boolean;
  counts: { SALE: number; REFUND: number; CANCELLATION: number };
  salesTotal: string;
  refundsTotal: string;
  cancellationsTotal: string;
  net: string;
  taxByRate: Record<string, string>;
  tenders: Record<string, string>;
  totals: { net: string; absolute: string };
  lastEntryHash: string;
}

/** A month's (or year's) figures from the closures below it, in period order. */
export function summariseClosures(
  closures: { payload: string; hash: string }[]
): PeriodSummary & { parts: { hash: string }[] } {
  if (closures.length === 0) throw new Error("Nothing to summarise");
  const parsed = closures.map((c) => JSON.parse(c.payload) as ClosurePayload);
  const counts = { SALE: 0, REFUND: 0, CANCELLATION: 0 };
  const taxByRate: Sums = {};
  const tenders: Sums = {};
  let sales = decimal(0);
  let refunds = decimal(0);
  let cancellations = decimal(0);
  let entryCount = 0;
  for (const p of parsed) {
    counts.SALE += p.counts.SALE;
    counts.REFUND += p.counts.REFUND;
    counts.CANCELLATION += p.counts.CANCELLATION;
    sales = sales.plus(decimal(p.salesTotal));
    refunds = refunds.plus(decimal(p.refundsTotal));
    cancellations = cancellations.plus(decimal(p.cancellationsTotal));
    entryCount += p.entryCount;
    for (const [rate, amount] of Object.entries(p.taxByRate)) add(taxByRate, rate, decimal(amount));
    for (const [method, amount] of Object.entries(p.tenders)) add(tenders, method, decimal(amount));
  }
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  return {
    firstEntrySeq: first.firstEntrySeq,
    lastEntrySeq: last.lastEntrySeq,
    entryCount,
    currency: last.currency,
    mixedCurrencies: parsed.some((p) => p.mixedCurrencies || p.currency !== last.currency),
    counts,
    salesTotal: sales,
    refundsTotal: refunds,
    cancellationsTotal: cancellations,
    net: sales.plus(refunds).plus(cancellations),
    taxByRate,
    tenders,
    totalNet: decimal(last.totals.net),
    totalAbsolute: decimal(last.totals.absolute),
    lastEntryHash: last.lastEntryHash,
    parts: closures.map((c) => ({ hash: c.hash })),
  };
}

async function appendClosureInTx(
  tx: Tx,
  storeId: string,
  kind: FiscalClosureKind,
  period: string,
  summary: PeriodSummary,
  parts: { hash: string }[] | null
): Promise<void> {
  const head = await lockChainHead(tx, storeId, "CLOSURE");
  const seq = head.lastSeq + 1;
  const sealed = await sealRecord(tx, {
    chain: "CLOSURE",
    store: storeId,
    seq,
    kind,
    period,
    closedAt: new Date().toISOString(),
    firstEntrySeq: summary.firstEntrySeq,
    lastEntrySeq: summary.lastEntrySeq,
    entryCount: summary.entryCount,
    currency: summary.currency,
    mixedCurrencies: summary.mixedCurrencies,
    counts: summary.counts,
    salesTotal: money(summary.salesTotal),
    refundsTotal: money(summary.refundsTotal),
    cancellationsTotal: money(summary.cancellationsTotal),
    net: money(summary.net),
    taxByRate: sumsToCanonical(summary.taxByRate),
    tenders: sumsToCanonical(summary.tenders),
    totals: { net: money(summary.totalNet), absolute: money(summary.totalAbsolute) },
    lastEntryHash: summary.lastEntryHash,
    parts,
    prev: head.lastHash,
  });
  await tx.fiscalClosure.create({
    data: {
      storeId,
      seq,
      kind,
      period,
      firstEntrySeq: summary.firstEntrySeq,
      lastEntrySeq: summary.lastEntrySeq,
      entryCount: summary.entryCount,
      currency: summary.currency,
      salesTotal: summary.salesTotal,
      refundsTotal: summary.refundsTotal,
      cancellationsTotal: summary.cancellationsTotal,
      net: summary.net,
      totalNet: summary.totalNet,
      totalAbsolute: summary.totalAbsolute,
      payload: sealed.payload,
      prevHash: head.lastHash,
      hash: sealed.hash,
      signature: sealed.signature,
      keyId: sealed.keyId,
    },
  });
  await saveChainHead(tx, storeId, "CLOSURE", { ...head, lastSeq: seq, lastHash: sealed.hash });
}

async function alreadyClosed(tx: Tx, storeId: string, kind: FiscalClosureKind, period: string) {
  const found = await tx.fiscalClosure.findUnique({
    where: { storeId_kind_period: { storeId, kind, period } },
    select: { id: true },
  });
  return found !== null;
}

/** Close every day with entries before `beforeDay` that isn't closed yet. */
export async function closeDueDays(storeId: string, beforeDay: string): Promise<string[]> {
  const last = await prisma.fiscalClosure.findFirst({
    where: { storeId, kind: "DAY" },
    orderBy: { period: "desc" },
    select: { period: true },
  });
  const groups = await prisma.fiscalEntry.groupBy({
    by: ["businessDay"],
    where: {
      storeId,
      businessDay: { lt: beforeDay, ...(last ? { gt: last.period } : {}) },
    },
    orderBy: { businessDay: "asc" },
  });
  const closed: string[] = [];
  for (const { businessDay: day } of groups) {
    const done = await prisma.$transaction(
      async (tx) => {
        if (await alreadyClosed(tx, storeId, "DAY", day)) return false;
        const entries = await tx.fiscalEntry.findMany({
          where: { storeId, businessDay: day },
          orderBy: { seq: "asc" },
          select: {
            seq: true,
            kind: true,
            amount: true,
            currency: true,
            payload: true,
            hash: true,
            totalNet: true,
            totalAbsolute: true,
          },
        });
        if (entries.length === 0) return false;
        await appendClosureInTx(tx, storeId, "DAY", day, summariseEntries(entries), null);
        return true;
      },
      { timeout: CLOSURE_TX_TIMEOUT_MS }
    );
    if (done) closed.push(day);
  }
  return closed;
}

/**
 * Close the periods one level up: months from day closures ("2026-10-31" →
 * "2026-10"), years from month closures ("2026-12" → "2026"). `before` is
 * the current month or year, which stays open.
 */
async function closeFromBelow(
  storeId: string,
  kind: "MONTH" | "YEAR",
  before: string
): Promise<string[]> {
  const below: FiscalClosureKind = kind === "MONTH" ? "DAY" : "MONTH";
  const width = kind === "MONTH" ? 7 : 4;
  const last = await prisma.fiscalClosure.findFirst({
    where: { storeId, kind },
    orderBy: { period: "desc" },
    select: { period: true },
  });
  // "2026-10-99" sorts after every day of October, "2026-99" after every month of 2026.
  const parts = await prisma.fiscalClosure.findMany({
    where: {
      storeId,
      kind: below,
      period: { lt: before, ...(last ? { gt: `${last.period}-99` } : {}) },
    },
    orderBy: { period: "asc" },
    select: { period: true },
  });
  const periods = [...new Set(parts.map((p) => p.period.slice(0, width)))];
  const closed: string[] = [];
  for (const period of periods) {
    const done = await prisma.$transaction(
      async (tx) => {
        if (await alreadyClosed(tx, storeId, kind, period)) return false;
        const children = await tx.fiscalClosure.findMany({
          where: { storeId, kind: below, period: { gt: `${period}-00`, lt: `${period}-99` } },
          orderBy: { period: "asc" },
          select: { payload: true, hash: true },
        });
        if (children.length === 0) return false;
        const summary = summariseClosures(children);
        await appendClosureInTx(tx, storeId, kind, period, summary, summary.parts);
        return true;
      },
      { timeout: CLOSURE_TX_TIMEOUT_MS }
    );
    if (done) closed.push(period);
  }
  return closed;
}

export function closeDueMonths(storeId: string, currentMonth: string): Promise<string[]> {
  return closeFromBelow(storeId, "MONTH", currentMonth);
}

export function closeDueYears(storeId: string, currentYear: string): Promise<string[]> {
  return closeFromBelow(storeId, "YEAR", currentYear);
}
