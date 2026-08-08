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
]);

// The method actually used to settle a payment — excludes PAY_LATER, which
// only makes sense as a deferred choice at checkout, not as a record of how
// money changed hands.
export const settlePaymentMethodEnum = paymentMethodEnum.exclude(["PAY_LATER"]);

export const createPosOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().cuid(),
        name: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        selectedOptions: z.array(selectedOptionSchema).optional(),
        notes: z.string().max(300, "Note is too long").optional(),
      })
    )
    .min(1),
  paymentMethod: paymentMethodEnum,
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().cuid().optional(),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  bankCode: z.enum(["BNI", "BRI", "MANDIRI", "PERMATA"]).optional(),
  notes: z.string().optional(),
  amountTendered: z.number().optional(),
  shiftId: z.string().cuid().optional(),
  // Staff-applied discount, flat amount off the item total. Clamped again
  // server-side in computeOrderCharges() — never trust this alone.
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().max(200, "Reason is too long").optional(),
});

export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;

/**
 * Holding a cart has no payment method yet — a materially smaller contract
 * than a full checkout submission. `orderId` is set when re-holding an
 * already-held order in place (e.g. resumed, edited, held again) instead of
 * creating a duplicate row.
 */
export const createHoldOrderSchema = z.object({
  items: createPosOrderSchema.shape.items,
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().cuid().optional(),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  shiftId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
});

export type CreateHoldOrderInput = z.infer<typeof createHoldOrderSchema>;

export const updateOrderStatusSchema = z
  .object({
    status: z
      .enum(["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED"])
      .optional(),
    // Manual settle-up for orders stuck at PENDING (Pay Later, or a payment
    // that was actually collected outside the online flow) — deliberately
    // narrowed to "mark paid" only, not a general paymentStatus setter.
    paymentStatus: z.literal("PAID").optional(),
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
