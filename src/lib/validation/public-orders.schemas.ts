import { z } from "zod";

export const publicOrderItemSchema = z.object({
  menuItemId: z.string().cuid(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(99),
  unitPrice: z.number().positive(),
  modifierSelections: z
    .array(
      z.object({
        modifierName: z.string(),
        optionName: z.string(),
        priceAdd: z.number().default(0),
      })
    )
    .optional(),
});

export const createPublicOrderSchema = z.object({
  storefrontSlug: z.string().min(1),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(5).max(20).optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).default("DINE_IN"),
  tableNumber: z.string().max(20).optional(),
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
  notes: z.string().max(500).optional(),
  bankCode: z.enum(["BNI", "BRI", "MANDIRI", "PERMATA"]).optional(),
  items: z.array(publicOrderItemSchema).min(1).max(50),
});

export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;

export const lookupPublicOrdersSchema = z.object({
  storefrontSlug: z.string().min(1).max(100),
  orderIds: z.array(z.string().cuid()).min(1).max(20),
});

export type LookupPublicOrdersInput = z.infer<typeof lookupPublicOrdersSchema>;
