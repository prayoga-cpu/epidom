import type { PaymentMethod } from "@prisma/client";
import {
  computeProcessingFee,
  resolvePaymentFeeRate,
  type PaymentFeeOverrides,
} from "@/config/payment-fees.config";

/**
 * Pure multi-tender helpers. No Prisma client import (type-only) — shared by
 * the POS tender list and the order routes, same contract as
 * order-charges.ts.
 *
 * A bill is settled by one or more TENDERS. `amount` on a tender is what was
 * applied to the bill and never includes cash change, so summing `amount`
 * always reproduces Order.total. `amountTendered`/`change` only exist on cash.
 */

/** A method a customer can actually pay with — never PAY_LATER or SPLIT. */
export type TenderMethod = Exclude<PaymentMethod, "PAY_LATER" | "SPLIT">;

export const MAX_TENDERS = 10;

export interface TenderInput {
  method: TenderMethod;
  amount: number;
  /** Cash handed over. Ignored for every other method. */
  amountTendered?: number | null;
  /** Cashier-typed label — required when method is OTHER. */
  note?: string | null;
}

export interface NormalizedTender {
  method: TenderMethod;
  amount: number;
  amountTendered: number | null;
  change: number | null;
  note: string | null;
}

export type TenderErrorCode =
  | "EMPTY"
  | "TOO_MANY"
  | "INVALID_METHOD"
  | "NON_POSITIVE"
  | "SUM_MISMATCH"
  | "CASH_UNDERPAID"
  | "NOTE_REQUIRED";

export interface TenderError {
  code: TenderErrorCode;
  message: string;
  /** Index of the offending tender, when the error is about one row. */
  index?: number;
}

export type NormalizeTendersResult =
  | { ok: true; tenders: NormalizedTender[] }
  | { ok: false; error: TenderError };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validate and normalize a tender list against the bill total. Rounds every
 * amount to cents, derives cash change, and requires the tenders to cover the
 * total exactly — an order is only ever created once it is fully paid, so
 * there is no partial-payment state to represent.
 */
export function normalizeTenders(total: number, tenders: TenderInput[]): NormalizeTendersResult {
  if (tenders.length === 0) {
    return { ok: false, error: { code: "EMPTY", message: "At least one payment is required" } };
  }
  if (tenders.length > MAX_TENDERS) {
    return {
      ok: false,
      error: { code: "TOO_MANY", message: `At most ${MAX_TENDERS} payments per order` },
    };
  }

  const out: NormalizedTender[] = [];
  for (let i = 0; i < tenders.length; i++) {
    const t = tenders[i];
    const method = t.method as string;
    if (method === "PAY_LATER" || method === "SPLIT") {
      return {
        ok: false,
        error: { code: "INVALID_METHOD", message: `${method} is not a payment method`, index: i },
      };
    }
    const amount = round2(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: {
          code: "NON_POSITIVE",
          message: "Each payment must be greater than zero",
          index: i,
        },
      };
    }

    const note = t.note?.trim() ? t.note.trim() : null;
    if (t.method === "OTHER" && !note) {
      return {
        ok: false,
        error: { code: "NOTE_REQUIRED", message: "A label is required for 'Other'", index: i },
      };
    }

    let amountTendered: number | null = null;
    let change: number | null = null;
    if (t.method === "CASH" && t.amountTendered != null) {
      amountTendered = round2(t.amountTendered);
      if (amountTendered < amount) {
        return {
          ok: false,
          error: {
            code: "CASH_UNDERPAID",
            message: "Cash tendered is less than the amount due",
            index: i,
          },
        };
      }
      change = round2(amountTendered - amount);
    }

    out.push({ method: t.method, amount, amountTendered, change, note });
  }

  const sum = round2(out.reduce((s, t) => s + t.amount, 0));
  if (Math.abs(sum - round2(total)) > 0.005) {
    return {
      ok: false,
      error: {
        code: "SUM_MISMATCH",
        message: `Payments (${sum}) do not equal the order total (${round2(total)})`,
      },
    };
  }

  return { ok: true, tenders: out };
}

/** SPLIT only when two or more tenders settled the bill; otherwise the one method. */
export function resolveOrderPaymentMethod(tenders: Array<{ method: TenderMethod }>): PaymentMethod {
  return tenders.length >= 2 ? "SPLIT" : tenders[0].method;
}

/**
 * The pre-multi-tender payload shape (paymentMethod + amountTendered +
 * paymentNote) as a one-element tender list, so old clients and the offline
 * queue — which persists the raw payload, unversioned — flow through the same
 * code path as new ones.
 */
export function legacyToTenders(
  input: {
    paymentMethod: TenderMethod;
    amountTendered?: number | null;
    paymentNote?: string | null;
  },
  total: number
): TenderInput[] {
  return [
    {
      method: input.paymentMethod,
      amount: total,
      amountTendered: input.paymentMethod === "CASH" ? (input.amountTendered ?? null) : null,
      note: input.paymentMethod === "OTHER" ? (input.paymentNote ?? null) : null,
    },
  ];
}

/**
 * Processing fee for a settled bill, summed per tender at each method's own
 * rate. For a single tender this is identical to what computeOrderCharges
 * produces, including the persisted rate (the method's percent), so ordinary
 * orders stay byte-identical. For two or more tenders the rate is the blended
 * effective fraction, since no single method's percent describes the order.
 * `enabled` mirrors ResolvedFinanceSettings.processingFeeEnabled.
 */
export function computeTendersProcessingFee(args: {
  tenders: Array<{ method: TenderMethod; amount: number }>;
  enabled: boolean;
  overrides?: PaymentFeeOverrides | null;
}): { fee: number; rate: number } {
  const { tenders, enabled, overrides } = args;
  if (!enabled || tenders.length === 0) return { fee: 0, rate: 0 };

  if (tenders.length === 1) {
    const t = tenders[0];
    return {
      fee: computeProcessingFee(t.amount, t.method, overrides),
      rate: resolvePaymentFeeRate(t.method, overrides).percent,
    };
  }

  const fee = round2(
    tenders.reduce((s, t) => s + computeProcessingFee(t.amount, t.method, overrides), 0)
  );
  const total = tenders.reduce((s, t) => s + t.amount, 0);
  // Order.processingFeeRate is Decimal(6,4).
  const rate = total > 0 ? Math.round((fee / total) * 10000) / 10000 : 0;
  return { fee, rate };
}

// ─── Refund attribution ──────────────────────────────────────────────────────

export interface RefundableTender {
  id: string;
  method: PaymentMethod;
  amount: number;
  refundedAmount: number;
}

export type AllocateRefundResult =
  | { ok: true; allocations: Array<{ paymentId: string; amount: number }> }
  | {
      ok: false;
      code: "TENDER_REQUIRED" | "TENDER_NOT_FOUND" | "TENDER_EXCEEDED";
      message: string;
    };

/**
 * Attribute a refund to the tender(s) that give the money back — a cash refund
 * leaves the drawer, a card refund doesn't, so the cash-drawer maths need to
 * know which. A single-tender order needs no choice. With several tenders the
 * caller names one (`tenderId`); the only choice-free case is refunding
 * exactly everything still outstanding, which refunds each tender in full.
 * Order-level bounds (cumulative refund ≤ total) are enforced elsewhere by
 * computeRefund; this only decides where the money goes.
 */
export function allocateRefund(
  tenders: RefundableTender[],
  amount: number,
  tenderId?: string | null
): AllocateRefundResult {
  const remaining = (t: RefundableTender) => round2(t.amount - t.refundedAmount);
  const total = round2(amount);

  if (tenders.length === 1) {
    const t = tenders[0];
    // A single tender needs no choice, but a tenderId that WAS supplied must
    // still name it — otherwise an id belonging to another order is silently
    // accepted and the request looks valid when it isn't.
    if (tenderId && tenderId !== t.id) {
      return { ok: false, code: "TENDER_NOT_FOUND", message: "Payment not found on this order" };
    }
    if (total > remaining(t) + 0.005) {
      return {
        ok: false,
        code: "TENDER_EXCEEDED",
        message: `Refund exceeds what is left on this payment (${remaining(t)})`,
      };
    }
    return { ok: true, allocations: [{ paymentId: t.id, amount: total }] };
  }

  if (tenderId) {
    const t = tenders.find((x) => x.id === tenderId);
    if (!t)
      return { ok: false, code: "TENDER_NOT_FOUND", message: "Payment not found on this order" };
    if (total > remaining(t) + 0.005) {
      return {
        ok: false,
        code: "TENDER_EXCEEDED",
        message: `Refund exceeds what is left on this payment (${remaining(t)})`,
      };
    }
    return { ok: true, allocations: [{ paymentId: t.id, amount: total }] };
  }

  const outstanding = round2(tenders.reduce((s, t) => s + remaining(t), 0));
  if (Math.abs(total - outstanding) <= 0.005) {
    return {
      ok: true,
      allocations: tenders
        .filter((t) => remaining(t) > 0)
        .map((t) => ({ paymentId: t.id, amount: remaining(t) })),
    };
  }

  return {
    ok: false,
    code: "TENDER_REQUIRED",
    message: "Choose which payment to refund on a split-payment order",
  };
}
