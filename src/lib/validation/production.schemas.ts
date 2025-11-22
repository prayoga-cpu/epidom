import { z } from "zod";
import { cuidSchema, decimalSchema } from "./common.schemas";

/**
 * Production batch validation schemas
 */

// Production status enum
export const productionStatusSchema = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

// Create production batch schema (start production)
export const createProductionBatchSchema = z.object({
  storeId: cuidSchema,
  productId: cuidSchema,
  recipeId: cuidSchema,
  plannedQuantity: z.number().positive("Planned quantity must be positive"),
  scheduledDate: z.coerce.date(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>;

// Form schema for client-side (without storeId)
export const createProductionBatchFormSchema = z.object({
  productId: cuidSchema,
  recipeId: cuidSchema,
  plannedQuantity: z.number().positive("Planned quantity must be positive"),
  scheduledDate: z.coerce.date(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type CreateProductionBatchFormInput = z.infer<typeof createProductionBatchFormSchema>;

// Update production batch schema (for basic fields)
export const updateProductionBatchSchema = z.object({
  plannedQuantity: z.number().positive("Planned quantity must be positive").optional(),
  scheduledDate: z.coerce.date().optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type UpdateProductionBatchInput = z.infer<typeof updateProductionBatchSchema>;

// Complete production schema
export const completeProductionSchema = z.object({
  actualQuantity: z.number().positive("Actual quantity must be positive"),
});

export type CompleteProductionInput = z.infer<typeof completeProductionSchema>;

// Cancel production schema
export const cancelProductionSchema = z.object({
  restoreMaterials: z.boolean().default(false),
});

export type CancelProductionInput = z.infer<typeof cancelProductionSchema>;

// Update batch status schema
export const updateBatchStatusSchema = z.object({
  status: productionStatusSchema,
  actualQuantity: z.number().positive("Actual quantity must be positive").optional(),
  completedDate: z.coerce.date().optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

export type UpdateBatchStatusInput = z.infer<typeof updateBatchStatusSchema>;

// Production batch filter schema (for query params)
export const productionBatchFilterSchema = z.object({
  status: z
    .union([
      productionStatusSchema,
      z.array(productionStatusSchema),
      /**
       * Type assertion needed because Zod transform return type doesn't match union type
       * Actual type: ProductionStatus[]
       * TODO: Use proper Zod type inference or create type helper
       */
      z.string().transform((val) => val.split(",") as any),
    ])
    .optional(),
  recipeId: cuidSchema.optional(),
  productId: cuidSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["batchNumber", "scheduledDate", "completedDate", "status", "createdAt"])
    .default("scheduledDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type ProductionBatchFilterInput = z.infer<typeof productionBatchFilterSchema>;

// Check material availability schema
export const checkMaterialAvailabilitySchema = z.object({
  recipeId: cuidSchema,
  multiplier: z.number().positive("Multiplier must be positive").default(1),
});

export type CheckMaterialAvailabilityInput = z.infer<typeof checkMaterialAvailabilitySchema>;

// Get batches due soon schema
export const getBatchesDueSoonSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type GetBatchesDueSoonInput = z.infer<typeof getBatchesDueSoonSchema>;
