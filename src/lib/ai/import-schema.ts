import { z } from "zod";

/**
 * Supported Target Fields for Material (Ingredients)
 * These are the fields the AI knows about and can map to.
 */
export const MaterialFields = z.enum([
  "sku",
  "name",
  "description",
  "category",
  "unit",
  "unitCost", // Cost Price
  "currentStock",
  "minStock",
  "maxStock",
  "supplierName", // Special field, needs lookup
  "supplierPrice", // Special field, price from that supplier
]);

export type MaterialField = z.infer<typeof MaterialFields>;

/**
 * Supported Target Fields for Product
 */
export const ProductFields = z.enum([
  "sku",
  "name",
  "description",
  "category",
  "costPrice",
  "sellingPrice",
  "currentStock",
  "unit",
  // productionTime removed to match manual form
  "minStock",
  "maxStock",
]);

export type ProductField = z.infer<typeof ProductFields>;

/**
 * Supported Target Fields for Suppliers
 */
export const SupplierFields = z.enum([
  "name",
  "contactPerson",
  "email",
  "phone",
  "address",
  "city",
  "country",
  "notes",
]);

export type SupplierField = z.infer<typeof SupplierFields>;

/**
 * Supported Target Fields for Recipes
 * Note: Recipe import is complex.
 * We assume a "Flat" CSV where ingredients are either strings or multiple columns
 */
export const RecipeFields = z.enum([
  "name",
  "description",
  "category",
  "yieldQuantity", // How much it makes
  "yieldUnit", // "porsi", "kg"
  "productionTimeMinutes",
  "instructions",
  "costPerBatch", // Optional, if user has this data
  // Special Handling for Ingredients:
  // AI will try to map "Column D" to "Ingredient Name 1" conceptually,
  // but for now we map to a generic "ingredients_blob" or specific text fields
  "ingredients_text", // A full text blob like "Chicken 1kg, Salt 2g"
  "ingredient_name", // If using multi-row format (1 recipe = multiple rows)
  "ingredient_qty",
  "ingredient_unit",
  // Extended Fields for Smart Creation (Cascade)
  "ingredient_sku",
  "ingredient_supplier",
  "ingredient_price",
  "ingredient_stock",
]);

export type RecipeField = z.infer<typeof RecipeFields>;

// Union of all possible fields for generic typing
export const ImportTargetFields = z.union([
  MaterialFields,
  ProductFields,
  SupplierFields,
  RecipeFields,
]);

// ============================================================================
// FIELD CLASSIFICATION (Single Source of Truth for Entity Detection & Visual Grouping)
// ============================================================================

/**
 * Fields that are UNIQUE to each entity type (used for entity detection).
 * A row is classified as a specific entity if it has any of these fields populated.
 * Order matters: Recipe > Material > Product > Supplier (most specific first)
 */
export const ENTITY_UNIQUE_FIELDS = {
  // Fields that ONLY appear in Supplier imports
  supplier: ["contactPerson", "phone", "email", "address", "city", "country"] as const,
  // Fields that ONLY appear in Material imports (excluding common fields)
  material: ["unitCost", "supplierName", "supplierPrice"] as const,
  // Fields that ONLY appear in Recipe imports
  recipe: [
    "yieldQuantity",
    "yieldUnit",
    "productionTimeMinutes",
    "costPerBatch",
    "instructions",
    "ingredients_text",
    "ingredient_name",
    "ingredient_qty",
    "ingredient_unit",
    "ingredient_sku",
    "ingredient_supplier",
    "ingredient_price",
    "ingredient_stock",
  ] as const,
  // Fields that ONLY appear in Product imports
  product: ["costPrice", "sellingPrice"] as const,
} as const;

/**
 * Fields that appear in MULTIPLE entities (for visual grouping as neutral/common)
 */
export const COMMON_FIELDS = ["name", "description", "category", "notes"] as const;

/**
 * Fields used for visual grouping in the import preview table.
 * These are broader than unique fields - they define visual zones.
 */
export const VISUAL_GROUPING_FIELDS = {
  supplier: ["contactPerson", "phone", "email", "address", "city", "country"] as const,
  material: [
    "sku",
    "unit",
    "unitCost",
    "currentStock",
    "minStock",
    "maxStock",
    "supplierName",
    "supplierPrice",
  ] as const,
  recipe: [
    "yieldQuantity",
    "yieldUnit",
    "productionTimeMinutes",
    "costPerBatch",
    "instructions",
    "ingredients_text",
  ] as const,
  ingredient: [
    "ingredient_name",
    "ingredient_qty",
    "ingredient_unit",
    "ingredient_sku",
    "ingredient_supplier",
    "ingredient_price",
    "ingredient_stock",
  ] as const,
  product: ["costPrice", "sellingPrice"] as const,
} as const;

/**
 * Transformation Types
 * AI can suggest simple transformations to clean data
 */
export const TransformType = z.enum([
  "NONE",
  "EXTRACT_NUMBER", // Remove symbols (Rp, $, etc)
  "EXTRACT_INT", // Parse integer only
  "BOOLEAN_Y_N", // Y/N -> true/false
  "DATE_STANDARD", // Try to parse date
  "UPPERCASE",
  "LOWERCASE",
  "TITLECASE",
]);

/**
 * Confidence Level of the AI's prediction
 */
export const ConfidenceLevel = z.enum(["HIGH", "MEDIUM", "LOW"]);

/**
 * Step 1: Structure Analysis Result
 * AI determines where the table actually lives in the CSV
 */
export const structureAnalysisSchema = z.object({
  hasHeader: z.boolean().describe("Does the CSV have a header row?"),
  headerRowIndex: z
    .number()
    .int()
    .min(0)
    .describe("0-based index of the header row. If no header, -1 or estimate."),
  dataStartIndex: z.number().int().min(0).describe("0-based index where actual data starts."),
  footerRowsToSkip: z
    .number()
    .int()
    .default(0)
    .describe("Number of rows at the bottom that are summaries/junk."),
});

/**
 * Step 2: Column Mapping Result
 * AI maps a CSV specific index/header to a Target Field
 */
export const columnMappingSchema = z.object({
  targetField: ImportTargetFields.describe("The database field this column maps to."),
  csvHeader: z.string().describe("The header name found in the CSV"),
  csvIndex: z.number().int().describe("The column index (0, 1, 2...)"),
  confidence: ConfidenceLevel.describe("How confident is the AI in this mapping?"),
  reasoning: z
    .string()
    .describe("Short explanation why this mapping was chosen (internal monologue)"),
  transform: TransformType.default("NONE").describe("Suggested transformation to clean the data"),
});

export const importAnalysisSchema = z.object({
  structure: structureAnalysisSchema,
  mappings: z.array(columnMappingSchema),
  summary: z.string().describe("Brief summary of what the AI understood."),
});

export type ImportAnalysis = z.infer<typeof importAnalysisSchema>;
