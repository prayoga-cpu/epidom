import { Prisma } from "@prisma/client";
import type { CanonicalValue } from "./canonical";

/**
 * What a sale, refund or cancellation says about itself in the journal, built
 * from the order as it stands inside the paying transaction. Pure: the
 * journal adds the chain fields (seq, totals, prev) and does the writing.
 *
 * No customer data goes in (no name, phone, e-mail or address): the record is
 * kept six years and a fiscal record needs none of it.
 */

type DecimalLike = Prisma.Decimal | number | string;

export function decimal(value: DecimalLike): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Two-decimal string, the only form money takes in a payload. */
export function money(value: DecimalLike): string {
  return decimal(value).toFixed(2);
}

export interface JournalOrder {
  id: string;
  orderNumber: string;
  orderDate: Date;
  source: string;
  orderType: string;
  subtotal: DecimalLike;
  discountAmount: DecimalLike;
  serviceCharge: DecimalLike;
  delivery: DecimalLike;
  tax: DecimalLike;
  taxRate: DecimalLike;
  total: DecimalLike;
  refundAmount: DecimalLike;
  paymentMethod: string;
  items: {
    name: string;
    quantity: DecimalLike;
    unitPrice: DecimalLike;
    total: DecimalLike;
    selectedOptions: unknown;
  }[];
  payments: { method: string; amount: DecimalLike; refundedAmount: DecimalLike }[];
}

/** The select that fetches a JournalOrder. */
export const JOURNAL_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  orderDate: true,
  source: true,
  orderType: true,
  subtotal: true,
  discountAmount: true,
  serviceCharge: true,
  delivery: true,
  tax: true,
  taxRate: true,
  total: true,
  refundAmount: true,
  paymentMethod: true,
  paymentStatus: true,
  status: true,
  items: {
    select: { name: true, quantity: true, unitPrice: true, total: true, selectedOptions: true },
    orderBy: { createdAt: "asc" },
  },
  payments: {
    select: { method: true, amount: true, refundedAmount: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderSelect;

export interface EntryBody {
  kind: "SALE" | "REFUND" | "CANCELLATION";
  /** Signed amount this entry moves: + for a sale, − for a refund or cancellation. */
  amount: Prisma.Decimal;
  fields: Record<string, CanonicalValue>;
}

function optionLabels(selected: unknown): string[] {
  if (!Array.isArray(selected)) return [];
  return selected.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const { groupName, optionName } = option as { groupName?: unknown; optionName?: unknown };
    if (typeof optionName !== "string") return [];
    return [
      typeof groupName === "string" && groupName ? `${groupName}: ${optionName}` : optionName,
    ];
  });
}

function orderRef(order: JournalOrder, offline: boolean): CanonicalValue {
  return {
    id: order.id,
    number: order.orderNumber,
    orderedAt: order.orderDate.toISOString(),
    source: order.source,
    type: order.orderType,
    offline,
  };
}

/** Tax carried by `share` of the order (a refund, or what a cancel takes back). */
function proratedTax(order: JournalOrder, share: Prisma.Decimal): Prisma.Decimal {
  const total = decimal(order.total);
  if (total.isZero()) return decimal(0);
  return decimal(order.tax).mul(share).div(total).toDecimalPlaces(2);
}

export function buildSaleBody(order: JournalOrder, opts: { offline: boolean }): EntryBody {
  const total = decimal(order.total);
  const tenders =
    order.payments.length > 0
      ? order.payments.map((p) => ({ method: p.method, amount: money(p.amount) }))
      : [{ method: order.paymentMethod, amount: money(total) }];
  return {
    kind: "SALE",
    amount: total,
    fields: {
      order: orderRef(order, opts.offline),
      lines: order.items.map((item) => ({
        name: item.name,
        qty: money(item.quantity),
        unitPrice: money(item.unitPrice),
        total: money(item.total),
        options: optionLabels(item.selectedOptions),
      })),
      charges: {
        subtotal: money(order.subtotal),
        discount: money(order.discountAmount),
        serviceCharge: money(order.serviceCharge),
        delivery: money(order.delivery),
        tax: money(order.tax),
        taxRate: decimal(order.taxRate).toFixed(4),
        total: money(total),
      },
      tax: money(order.tax),
      taxRate: decimal(order.taxRate).toFixed(4),
      tenders,
      ref: null,
      reason: null,
    },
  };
}

export function buildRefundBody(
  order: JournalOrder,
  args: {
    amount: DecimalLike;
    reason: string | null | undefined;
    tenders: { method: string; amount: DecimalLike }[];
    /** Cumulative refunded total after this refund. */
    refundedTotal: DecimalLike;
    sale: { seq: number; hash: string } | null;
  }
): EntryBody {
  const amount = decimal(args.amount);
  return {
    kind: "REFUND",
    amount: amount.neg(),
    fields: {
      order: orderRef(order, false),
      lines: [],
      tax: money(proratedTax(order, amount).neg()),
      taxRate: decimal(order.taxRate).toFixed(4),
      tenders: args.tenders.map((t) => ({
        method: t.method,
        amount: money(decimal(t.amount).neg()),
      })),
      refundedTotal: money(args.refundedTotal),
      ref: args.sale,
      reason: args.reason?.trim() ? args.reason.trim().slice(0, 200) : null,
    },
  };
}

export function buildCancellationBody(
  order: JournalOrder,
  args: { sale: { seq: number; hash: string } | null }
): EntryBody {
  // What a cancel takes back is what is still in the till: refunds already
  // recorded their own negative entries.
  const remaining = decimal(order.total).minus(decimal(order.refundAmount));
  const share = remaining.isNegative() ? decimal(0) : remaining;
  const tenders =
    order.payments.length > 0
      ? order.payments
          .map((p) => ({
            method: p.method,
            amount: decimal(p.amount).minus(decimal(p.refundedAmount)),
          }))
          .filter((t) => t.amount.greaterThan(0))
          .map((t) => ({ method: t.method, amount: money(t.amount.neg()) }))
      : share.greaterThan(0)
        ? [{ method: order.paymentMethod, amount: money(share.neg()) }]
        : [];
  return {
    kind: "CANCELLATION",
    amount: share.neg(),
    fields: {
      order: orderRef(order, false),
      lines: [],
      tax: money(proratedTax(order, share).neg()),
      taxRate: decimal(order.taxRate).toFixed(4),
      tenders,
      ref: args.sale,
      reason: null,
    },
  };
}
