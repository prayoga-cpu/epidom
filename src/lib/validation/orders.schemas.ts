import { z } from "zod";
import { cuidSchema, priceSchema, decimalSchema } from "./common.schemas";

/**
 * Order and production management validation schemas
 */

// Order status enum
export const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

// Create order schema
export const createOrderSchema = z.object({
  storeId: cuidSchema,
  customerName: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name is too long"),
  customerEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  customerPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  deliveryAddress: z.string().max(500, "Delivery address is too long").optional(),
  dueDate: z.date().optional(),
  items: z
    .array(
      z.object({
        productId: cuidSchema,
        quantity: decimalSchema.positive("Quantity must be positive"),
        unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
        unitPrice: priceSchema,
      })
    )
    .min(1, "Order must have at least one item"),
  tax: priceSchema.default(0),
  delivery: priceSchema.default(0),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Update order schema
export const updateOrderSchema = z.object({
  customerName: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name is too long")
    .optional(),
  customerEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  customerPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  deliveryAddress: z.string().max(500, "Delivery address is too long").optional(),
  status: orderStatusSchema.optional(),
  dueDate: z.date().optional(),
  deliveredDate: z.date().optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
