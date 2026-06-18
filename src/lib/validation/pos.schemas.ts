import { z } from "zod";

export const createPosOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().cuid(),
        name: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        modifierSelections: z
          .array(
            z.object({
              name: z.string(),
              priceAdd: z.number(),
            })
          )
          .optional(),
      })
    )
    .min(1),
  paymentMethod: z.enum([
    "CASH",
    "QRIS",
    "GOPAY",
    "OVO",
    "DANA",
    "SHOPEEPAY",
    "BANK_TRANSFER",
    "STRIPE_CARD",
  ]),
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().cuid().optional(),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  bankCode: z.enum(["BNI", "BRI", "MANDIRI", "PERMATA"]).optional(),
  notes: z.string().optional(),
  amountTendered: z.number().optional(),
  shiftId: z.string().cuid().optional(),
});

export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "IN_PRODUCTION",
    "READY",
    "DELIVERED",
    "CANCELLED",
  ]),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export type UpdateOrderItemStatusInput = z.infer<
  typeof updateOrderItemStatusSchema
>;
