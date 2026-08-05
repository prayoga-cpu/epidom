import { z } from "zod";
import { cuidSchema, decimalSchema } from "./common.schemas";

/**
 * Waste management validation schemas — recording and correcting wasted
 * Materials/Products (see src/lib/services/waste.service.ts).
 */

export const wasteReasonSchema = z.enum([
  "EXPIRED",
  "DAMAGED",
  "SPOILED",
  "OVERPRODUCTION",
  "QUALITY_CONTROL",
  "OTHER",
]);

export type WasteReasonInput = z.infer<typeof wasteReasonSchema>;

// customReason is required (not just accepted) when reason = OTHER, since
// that's the only case where the predefined taxonomy carries no meaning on
// its own.
const requiresCustomReasonWhenOther = (data: { reason: string; customReason?: string }) =>
  data.reason !== "OTHER" || !!data.customReason?.trim();

export const recordWasteSchema = z
  .object({
    materialId: cuidSchema.optional(),
    productId: cuidSchema.optional(),
    quantity: decimalSchema.positive("Quantity must be positive"),
    reason: wasteReasonSchema,
    customReason: z.string().max(200, "Custom reason is too long").optional(),
    notes: z.string().max(500, "Notes are too long").optional(),
    referenceId: z.string().max(100, "Reference ID is too long").optional(),
  })
  .refine((data) => data.productId || data.materialId, {
    message: "Either productId or materialId must be provided",
    path: ["productId"],
  })
  .refine(requiresCustomReasonWhenOther, {
    message: "Custom reason is required when reason is Other",
    path: ["customReason"],
  });

export type RecordWasteInput = z.infer<typeof recordWasteSchema>;

export const updateWasteSchema = z
  .object({
    quantity: decimalSchema.positive("Quantity must be positive").optional(),
    reason: wasteReasonSchema.optional(),
    customReason: z.string().max(200, "Custom reason is too long").optional(),
    notes: z.string().max(500, "Notes are too long").optional(),
    referenceId: z.string().max(100, "Reference ID is too long").optional(),
    // Manager/owner correction escape hatch — a frozen snapshot override,
    // never a re-fetch of the item's live cost. See WasteEntry.unitCostSnapshot.
    unitCostOverride: decimalSchema.positive("Unit cost must be positive").optional(),
  })
  .refine((data) => data.reason !== "OTHER" || !!data.customReason?.trim(), {
    message: "Custom reason is required when reason is Other",
    path: ["customReason"],
  });

export type UpdateWasteInput = z.infer<typeof updateWasteSchema>;

export const wasteListQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  materialId: cuidSchema.optional(),
  productId: cuidSchema.optional(),
  reason: wasteReasonSchema.optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export type WasteListQuery = z.infer<typeof wasteListQuerySchema>;
