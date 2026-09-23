import { z } from "zod";

// Frozen snapshot of one chosen modifier/option, shared by POS, hold, and
// public-order item schemas. materialId/materialQty pass through untouched
// from Product-linked options so stock-deduction can later read them off the
// persisted OrderItem without re-deriving from (possibly since-changed)
// MenuItem/Product data.
export const selectedOptionSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  priceAdjustment: z.number(),
  materialId: z.string().cuid().optional(),
  materialQty: z.number().optional(),
});

export type SelectedOptionInput = z.infer<typeof selectedOptionSchema>;

// Shared by checkout (where PAY_LATER defers payment) and the mark-paid flow
// (where PAY_LATER would be a contradiction — see settlePaymentMethodEnum).
export const paymentMethodEnum = z.enum([
  "CASH",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
  "STRIPE_CARD",
  "PAY_LATER",
  "LINKAJA",
  "CHEQUE",
  "TITRE_RESTAURANT",
  "PAYPAL",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "OTHER",
]);

// The method actually used to settle a payment — excludes PAY_LATER, which
// only makes sense as a deferred choice at checkout, not as a record of how
// money changed hands. Doubles as the tender-method enum for `payments[]`
// below (a tender is, by definition, money that actually changed hands), and
// SPLIT is absent from paymentMethodEnum entirely — it is derived by the
// server from the tender COUNT, never sent by a client.
export const settlePaymentMethodEnum = paymentMethodEnum.exclude(["PAY_LATER"]);

// ─── Order lines ─────────────────────────────────────────────────────────────

/** An ordinary line. The server reprices it from the live menu, so the
 * client-sent `unitPrice`/`name` here are advisory only. */
const menuOrderItemSchema = z.object({
  menuItemId: z.string().cuid(),
  name: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  selectedOptions: z.array(selectedOptionSchema).optional(),
  notes: z.string().max(300, "Note is too long").optional(),
});

/** A Custom Item's price ceiling. There is no menu row to reprice against, so
 * this bound is the only thing between a fat-fingered (or hostile) amount and
 * a permanent ledger row — Order is immutable, see the schema notes. */
export const CUSTOM_ITEM_MAX_UNIT_PRICE = 100_000_000;

/**
 * POS "Custom Item" (Luna parity) — an ad-hoc line the cashier typed, with no
 * MenuItem/Product behind it. Unlike an ordinary line this one's name and
 * price ARE authoritative (there is nothing to reprice from), which is why
 * both are bounded. `department` is the prep area the line prints to; null /
 * absent means "no prep area", which starts the line SERVED — see
 * resolveInitialOrderItemStatus. Unrelated to Product.productLine = CUSTOM.
 */
const customOrderItemSchema = z.object({
  custom: z.literal(true),
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive().max(CUSTOM_ITEM_MAX_UNIT_PRICE),
  notes: z.string().max(300, "Note is too long").optional(),
  department: z.enum(["KITCHEN", "BAR"]).nullish(),
});

/**
 * The two line shapes are disjoint (`custom: true` vs a required
 * `menuItemId`), so the union never has to guess — and an old-shape payload
 * still parses through the first branch exactly as it did before multi-line
 * support existed.
 */
const posOrderItemSchema = z.union([menuOrderItemSchema, customOrderItemSchema]);

/**
 * One payment that settled (part of) the bill. `amount` is what was applied
 * to the bill and never includes cash change, so the tenders always sum to
 * Order.total — see normalizeTenders in src/lib/finance/order-payments.ts,
 * which re-validates all of this server-side against the repriced total.
 */
export const orderTenderSchema = z.object({
  method: settlePaymentMethodEnum,
  amount: z.number().positive(),
  amountTendered: z.number().min(0).nullish(),
  note: z.string().max(200, "Note is too long").nullish(),
});

export type OrderTenderInput = z.infer<typeof orderTenderSchema>;

/** Mirrors MAX_TENDERS in src/lib/finance/order-payments.ts. */
const MAX_TENDERS_PER_ORDER = 10;

// Plain object (not the refined version below) so createHoldOrderSchema can
// still reach `.shape.items` — .refine() wraps a schema in ZodEffects, which
// drops `.shape`.
const posOrderObjectSchema = z.object({
  items: z.array(posOrderItemSchema).min(1),
  // Optional ONLY because `payments[]` may carry the methods instead — the
  // refine below requires one of the two. Every pre-multi-tender payload
  // (including everything sitting in an offline queue right now) still sends
  // it, so this loosening can never reject an old-shape body.
  paymentMethod: paymentMethodEnum.optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  // Pax at the table — only meaningful for DINE_IN, so the checkout dialog
  // omits it entirely for takeaway rather than sending a misleading 1. Left
  // optional here (not `.default(1)`) so "not recorded" stays distinguishable
  // from "one guest" all the way down to Order.guestCount.
  guestCount: z.number().int().min(1).max(99).optional(),
  tableId: z.string().cuid().optional(),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  // An address the customer typed on the customer-facing screen. Only a
  // fallback: an attached Customer's own email wins (see pos-order-settlement).
  // Its presence is what makes the receipt email send itself once the order is
  // paid — see send-receipt-email-on-order.ts.
  customerEmail: z.string().trim().email("Invalid email format").max(254).optional(),
  bankCode: z.enum(["BNI", "BRI", "MANDIRI", "PERMATA"]).optional(),
  notes: z.string().optional(),
  amountTendered: z.number().optional(),
  shiftId: z.string().cuid().optional(),
  // Staff-applied discount, flat amount off the item total. Clamped again
  // server-side in computeOrderCharges() — never trust this alone.
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().max(200, "Reason is too long").optional(),
  // The cashier-typed label for paymentMethod: "OTHER" (e.g. "Crypto",
  // "Company account") — required in that case, see the refine below.
  paymentNote: z.string().max(200, "Note is too long").optional(),
  // Idempotency key for offline replay. The POS queues orders to IndexedDB
  // while disconnected and POSTs them on reconnect; if the response is lost, or
  // a second tab flushes the same queue, the retry previously created a
  // DUPLICATE order with duplicate stock deduction behind it. The queue entry's
  // own id is the key. Absent for ordinary online checkouts.
  clientRequestId: z.string().min(1).max(128).optional(),

  // ── Cashier revamp (2.88.0) — every field below is optional and additive ───
  // The offline queue persists the raw request body UNVERSIONED and deletes an
  // entry after 5 failed replays, so a schema that starts rejecting an old
  // payload silently destroys an already-collected sale. Nothing here may ever
  // become required.

  /**
   * Customer record attached to the sale (POS tier). Must belong to the store.
   * Three-state on purpose: a cuid attaches, OMITTED keeps whatever a resumed
   * hold already recorded (losing it silently would cost the customer their
   * points), and an explicit `null` detaches.
   */
  customerId: z.string().cuid().nullish(),
  /** DiscountPreset to price server-side. OPERATIONS-gated on the server. */
  presetId: z.string().cuid().optional(),
  /** Coupon code, matched case-insensitively. OPERATIONS-gated on the server. */
  couponCode: z.string().trim().min(1).max(64).optional(),
  /** Loyalty points to burn on this bill. Needs customerId (see the refine). */
  redeemPoints: z.number().int().min(1).optional(),
  /**
   * Shared by every Order created from one "split bill by items" action.
   * Client-generated (nanoid/uuid), so it is constrained to an opaque, bounded
   * token rather than accepted as free text — it is echoed into responses and
   * grouped on in history queries.
   */
  splitGroupId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "splitGroupId must be alphanumeric")
    .optional(),
  /**
   * Multi-tender settlement. When present it REPLACES paymentMethod /
   * amountTendered / paymentNote; two or more rows make Order.paymentMethod
   * SPLIT. Absent ⇒ the legacy single-method fields are converted to a
   * one-element tender list server-side (legacyToTenders).
   */
  payments: z.array(orderTenderSchema).min(1).max(MAX_TENDERS_PER_ORDER).optional(),
});

export const createPosOrderSchema = posOrderObjectSchema
  .refine((data) => data.paymentMethod !== "OTHER" || !!data.paymentNote?.trim(), {
    message: "paymentNote is required when paymentMethod is OTHER",
    path: ["paymentNote"],
  })
  // One of the two settlement shapes must be present. Old payloads always
  // carry paymentMethod, new multi-tender ones always carry payments[].
  .refine((data) => !!data.paymentMethod || (data.payments?.length ?? 0) > 0, {
    message: "paymentMethod is required when no payments are provided",
    path: ["paymentMethod"],
  })
  // Points belong to a customer — there is no anonymous balance to burn.
  .refine((data) => data.redeemPoints === undefined || !!data.customerId, {
    message: "redeemPoints requires customerId",
    path: ["redeemPoints"],
  });

export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;

/** One line of a POS order request — either a menu line or a Custom Item. */
export type PosOrderItemInput = CreatePosOrderInput["items"][number];

/** Narrow a request line to the Custom Item branch of the union. */
export function isCustomOrderItem(
  item: PosOrderItemInput
): item is Extract<PosOrderItemInput, { custom: true }> {
  return (item as { custom?: unknown }).custom === true;
}

/**
 * Holding a cart has no payment method yet — a materially smaller contract
 * than a full checkout submission. `orderId` is set when re-holding an
 * already-held order in place (e.g. resumed, edited, held again) instead of
 * creating a duplicate row.
 */
export const createHoldOrderSchema = z.object({
  items: posOrderObjectSchema.shape.items,
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  guestCount: posOrderObjectSchema.shape.guestCount,
  tableId: z.string().cuid().optional(),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  shiftId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  // ── Cashier revamp (2.88.0) ───────────────────────────────────────────────
  // A hold used to persist nothing but customerName, so "Save Bill" quietly
  // dropped the attached customer and the discount the cashier had applied.
  // Coupons and points are deliberately NOT accepted here: they are redeemed
  // (usedCount bump / ledger burn) at finalize, and parking a bill must not
  // consume either.
  //
  // customerId and the discount fields are all three-state: OMITTED keeps what
  // the held row already recorded (a re-hold after editing the cart must not
  // silently drop the customer or the discount the cashier applied), and an
  // explicit `null` / a sent value replaces it.
  customerId: z.string().cuid().nullish(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().trim().email("Invalid email format").max(254).optional(),
  presetId: z.string().cuid().nullish(),
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().max(200, "Reason is too long").optional(),
});

export type CreateHoldOrderInput = z.infer<typeof createHoldOrderSchema>;

/**
 * POST /pos/orders/merge — fold one or more Saved (HELD) bills into another.
 * The cap mirrors the dialog's own limit and keeps the whole move inside one
 * short transaction; the route re-checks store scope and HELD status.
 */
export const MAX_MERGE_SOURCES = 10;

export const mergeOrdersSchema = z.object({
  targetOrderId: z.string().cuid(),
  sourceOrderIds: z.array(z.string().cuid()).min(1).max(MAX_MERGE_SOURCES),
});

export type MergeOrdersInput = z.infer<typeof mergeOrdersSchema>;

export const updateOrderStatusSchema = z
  .object({
    status: z
      .enum(["CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED"])
      .optional(),
    // Manual settle-up for orders whose paymentStatus is still PENDING (Pay
    // Later, or a payment that was actually collected outside the online
    // flow) — deliberately narrowed to "mark paid" only, not a general
    // paymentStatus setter.
    paymentStatus: z.literal("PAID").optional(),
    // Only meaningful alongside status: "CANCELLED". Stock deduction fires at
    // DELIVERED — i.e. after the food was made and handed over — so cancelling
    // puts counted finished goods back on the shelf but deliberately does NOT
    // credit raw ingredients back: they are physically inside food in a bin,
    // and crediting them would fabricate stock (and double-count the loss if
    // that food is then binned through the Waste flow). Setting this to true is
    // the operator stating the food was never actually made, which is the one
    // case where the ingredients really are still on the shelf.
    foodWasNeverMade: z.boolean().optional(),
    // How the settle-up was actually paid, and an optional free-text note
    // (e.g. "client paid directly to the owner") — only meaningful alongside
    // paymentStatus: "PAID", enforced by the refine below.
    paymentMethod: settlePaymentMethodEnum.optional(),
    paymentNote: z.string().max(300, "Note is too long").optional(),
  })
  .refine((data) => data.status !== undefined || data.paymentStatus !== undefined, {
    message: "Either status or paymentStatus is required",
  })
  .refine((data) => data.paymentMethod === undefined || data.paymentStatus === "PAID", {
    message: "paymentMethod requires paymentStatus: PAID",
  });

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Kept separate from updateOrderStatusSchema (a different endpoint) rather
// than folded in — status updates carry side effects (stock deduction,
// freeing a table) that a contact-info edit has no business triggering.
export const updateOrderCustomerSchema = z.object({
  customerPhone: z.string().min(6, "Phone number is too short").max(30),
});

export type UpdateOrderCustomerInput = z.infer<typeof updateOrderCustomerSchema>;

// Staff-initiated refund (POS order history "Issue Refund" action). Supports
// repeat partial refunds against the same order — the route sums this
// against Order.refundAmount and rejects anything that would exceed the
// order's total, so the schema itself only needs a positive amount.
export const refundOrderSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().max(300, "Reason is too long").optional(),
});

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export type UpdateOrderItemStatusInput = z.infer<typeof updateOrderItemStatusSchema>;
