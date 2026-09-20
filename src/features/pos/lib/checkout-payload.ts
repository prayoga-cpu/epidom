import type { PaymentMethod } from "@prisma/client";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";
import type { NormalizedTender, TenderMethod } from "@/lib/finance/order-payments";
import type { PosOrderCreatedDto } from "@/types/api/cashier";
import type { CartCustomer, CartDiscountSource, CartItem } from "../types/pos.types";
import { cartItemsToWireLines } from "./cart-wire";

/**
 * Builds the request body checkout sends to POST /pos/orders (or /finalize), and
 * what the offline queue persists verbatim. Pure, so the exact shape — the thing
 * that must never drift — is pinned by unit tests instead of by reading a dialog.
 *
 * Typed as CreatePosOrderInput on purpose: the compiler then checks every
 * payload this file can produce against the server's own schema.
 *
 * Two invariants:
 *  - A single-method sale keeps sending the LEGACY fields (paymentMethod,
 *    amountTendered, paymentNote, bankCode) and never `payments[]`, so the common
 *    path — and everything already sitting in an offline queue — is unchanged.
 *  - The client never sends a computed amount for a preset, coupon or points:
 *    those go as ids/codes and the server re-prices them. The one exception is a
 *    by-items split bill (`discount.flat`) and an offline sale, where there is
 *    no server-side rule to re-run and the previewed amount is all we have.
 */

export type CheckoutPayment =
  | {
      kind: "single";
      method: PaymentMethod;
      amountTendered?: number | null;
      /** The typed label for method OTHER. */
      paymentNote?: string;
      /** Only for BANK_TRANSFER. */
      bankCode?: "BNI" | "BRI" | "MANDIRI" | "PERMATA";
    }
  | {
      kind: "split";
      /** Already validated and rounded by normalizeTenders. */
      tenders: NormalizedTender[];
    };

export interface CheckoutDiscountInput {
  /** The cart's own primary source. Ignored when `flat` is set or when offline. */
  source: CartDiscountSource | null;
  /** cart.primaryDiscountAmount — the manual/preset/coupon part, as the cart previews it. */
  primaryAmount: number;
  /** cart.discountAmount / discountReason — the full previewed discount (primary + points). */
  totalAmount: number;
  totalReason: string | null;
  /** cart.pointsRedeemed — already clamped to what the cart can really burn. */
  redeemPoints: number;
  /**
   * A by-items split bill pins its proportional share as a plain flat amount: the
   * server must not re-price it (a FIXED preset would otherwise be charged in
   * full on every bill).
   */
  flat?: { amount: number; reason: string | null };
}

export interface BuildCheckoutPayloadInput {
  items: CartItem[];
  orderType: "DINE_IN" | "TAKEAWAY";
  /** Sent for DINE_IN only, and only when known. */
  guestCount?: number | null;
  tableNumber: string;
  customer: Pick<CartCustomer, "id" | "name" | "phone"> | null;
  /** A number typed on the customer-facing screen; used when the customer has none. */
  fallbackPhone?: string | null;
  /**
   * An email typed on the customer-facing screen. Sent whenever present and left
   * for the server to weigh: an attached customer's own address wins there, this
   * is only what an unsaved walk-in has. Its presence is what makes the receipt
   * email itself once the order is paid.
   */
  fallbackEmail?: string | null;
  notes: string;
  shiftId?: string;
  splitGroupId?: string;
  discount: CheckoutDiscountInput;
  payment: CheckoutPayment;
  /**
   * No network. Anything the server has to validate (customer record, preset,
   * coupon, points) cannot be honored on replay, so it is downgraded to what a
   * plain offline sale can carry: a flat discount and the free-text customer.
   */
  offline: boolean;
}

/** Drops undefined values so the body serializes and compares as exactly the fields that matter. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}

const clean = (s: string | null | undefined): string | undefined => s?.trim() || undefined;

function discountFields(
  d: CheckoutDiscountInput,
  offline: boolean,
  hasCustomerId: boolean
): Partial<CreatePosOrderInput> {
  if (d.flat) {
    return d.flat.amount > 0
      ? { discountAmount: d.flat.amount, discountReason: clean(d.flat.reason) }
      : {};
  }
  if (offline) {
    return d.totalAmount > 0
      ? { discountAmount: d.totalAmount, discountReason: clean(d.totalReason) }
      : {};
  }

  const out: Partial<CreatePosOrderInput> = {};
  const source = d.source;
  if (source?.kind === "preset") {
    out.presetId = source.presetId;
  } else if (source?.kind === "coupon") {
    out.couponCode = source.code;
  } else if (source?.kind === "manual" && d.primaryAmount > 0) {
    out.discountAmount = d.primaryAmount;
    out.discountReason = clean(source.reason);
  }
  // Points are burned from a customer's balance; the schema rejects them without one.
  if (d.redeemPoints > 0 && hasCustomerId) out.redeemPoints = d.redeemPoints;
  return out;
}

export function buildCheckoutPayload(input: BuildCheckoutPayloadInput): CreatePosOrderInput {
  const { customer, payment, offline } = input;

  const customerId = !offline && customer?.id ? customer.id : undefined;

  const base: Partial<CreatePosOrderInput> = {
    items: cartItemsToWireLines(input.items).map((line) => compact({ ...line })),
    orderType: input.orderType,
    guestCount: input.orderType === "DINE_IN" ? (input.guestCount ?? undefined) : undefined,
    tableNumber: clean(input.tableNumber),
    customerId,
    customerName: clean(customer?.name),
    customerPhone: clean(customer?.phone) ?? clean(input.fallbackPhone),
    customerEmail: clean(input.fallbackEmail),
    notes: clean(input.notes),
    shiftId: input.shiftId,
    splitGroupId: input.splitGroupId,
    ...discountFields(input.discount, offline, !!customerId),
  };

  const paymentFields: Partial<CreatePosOrderInput> =
    payment.kind === "split"
      ? {
          payments: payment.tenders.map((t) =>
            compact({
              method: t.method,
              amount: t.amount,
              amountTendered: t.method === "CASH" ? (t.amountTendered ?? undefined) : undefined,
              note: t.note ?? undefined,
            })
          ),
        }
      : {
          // PAY_LATER and the rest of PaymentMethod are all valid legacy values;
          // SPLIT is never one — it is derived server-side from the tender count.
          paymentMethod: payment.method as CreatePosOrderInput["paymentMethod"],
          amountTendered:
            payment.method === "CASH" ? (payment.amountTendered ?? undefined) : undefined,
          paymentNote: payment.method === "OTHER" ? clean(payment.paymentNote) : undefined,
          bankCode: payment.method === "BANK_TRANSFER" ? payment.bankCode : undefined,
        };

  return compact({ ...base, ...paymentFields }) as CreatePosOrderInput;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Cash change owed back to the customer, or null when there is no cash tender
 * with a known hand-over (card/QRIS, Pay Later, or a cash row left blank).
 * Zero is a real answer — an exact hand-over — and is distinct from null.
 */
export function cashChangeOf(payment: CheckoutPayment, total: number): number | null {
  if (payment.kind === "split") {
    const cash = payment.tenders.filter((t) => t.method === "CASH" && t.change != null);
    return cash.length > 0 ? round2(cash.reduce((s, t) => s + (t.change ?? 0), 0)) : null;
  }
  if (payment.method !== "CASH" || payment.amountTendered == null) return null;
  return Math.max(0, round2(payment.amountTendered - total));
}

/**
 * What the server says actually settled the bill, as a CheckoutPayment — the
 * order-complete screen and the receipt show THAT rather than a re-computation,
 * so a discount the server re-priced (preset, coupon, points) or a tender it
 * rounded can never leave the paper disagreeing with the ledger. Falls back to
 * what was submitted when the response carries no tenders: an older server, or a
 * Pay Later / zero-total order, which writes no payment row.
 */
export function settledPaymentFromServer(
  server: PosOrderCreatedDto["payments"] | undefined,
  submitted: CheckoutPayment
): CheckoutPayment {
  if (!server || server.length === 0) return submitted;

  const tenders: NormalizedTender[] = server.map((p) => ({
    method: p.method as TenderMethod,
    amount: p.amount,
    amountTendered: p.amountTendered,
    change: p.change,
    note: p.note,
  }));
  if (tenders.length >= 2) return { kind: "split", tenders };

  const only = tenders[0];
  return {
    kind: "single",
    method: only.method,
    amountTendered: only.amountTendered,
    paymentNote: only.note ?? undefined,
    bankCode: submitted.kind === "single" ? submitted.bankCode : undefined,
  };
}
