import { z } from "zod";
import { cuidSchema, optionalCuidSchema, priceSchema, decimalSchema } from "./common.schemas";

/**
 * Inventory management validation schemas (Products & Ingredients)
 */

// Product schemas
const baseProductSchema = z.object({
  storeId: cuidSchema,
  sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  costPrice: priceSchema,
  sellingPrice: priceSchema,
  currentStock: decimalSchema.default(0),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").default("piece"),
  minStock: decimalSchema.default(0),
  maxStock: decimalSchema.default(1000),
  recipeId: optionalCuidSchema,
  productionTime: z.number().int().nonnegative("Production time must be non-negative").optional(),
  shelfLife: z.number().int().positive("Shelf life must be positive").optional(),
  isActive: z.boolean().default(true),
});

export const createProductSchema = baseProductSchema.refine(
  (data) => data.sellingPrice >= data.costPrice,
  {
    message: "Selling price must be greater than or equal to cost price",
    path: ["sellingPrice"],
  }
);

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = baseProductSchema.partial().omit({ storeId: true });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Ingredient schemas
export const ingredientSupplierSchema = z.object({
  supplierId: cuidSchema,
  price: priceSchema,
  isPreferred: z.boolean().default(false),
});

const baseIngredientSchema = z.object({
  storeId: cuidSchema,
  sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").default("kg"),
  unitCost: priceSchema,
  currentStock: decimalSchema.default(0),
  minStock: decimalSchema.default(0),
  maxStock: decimalSchema.default(1000),
  suppliers: z.array(ingredientSupplierSchema).optional(),
  isActive: z.boolean().default(true),
});

export const createIngredientSchema = baseIngredientSchema
  .refine((data) => data.minStock <= data.maxStock, {
    message: "Minimum stock must be less than or equal to maximum stock",
    path: ["minStock"],
  })
  .refine(
    (data) => {
      // Ensure only one supplier is marked as preferred
      if (data.suppliers) {
        const preferredCount = data.suppliers.filter((s) => s.isPreferred).length;
        return preferredCount <= 1;
      }
      return true;
    },
    {
      message: "Only one supplier can be marked as preferred",
      path: ["suppliers"],
    }
  );

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;

// Form schema for client-side (without storeId, making default fields optional)
const baseIngredientFormSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").optional(),
  unitCost: priceSchema,
  currentStock: decimalSchema.optional(),
  minStock: decimalSchema.optional(),
  maxStock: decimalSchema.optional(),
  suppliers: z.array(ingredientSupplierSchema).optional(),
  isActive: z.boolean().optional(),
});

export const createIngredientFormSchema = baseIngredientFormSchema
  .refine(
    (data) => {
      const minStock = data.minStock ?? 0;
      const maxStock = data.maxStock ?? 1000;
      return minStock <= maxStock;
    },
    {
      message: "Minimum stock must be less than or equal to maximum stock",
      path: ["minStock"],
    }
  )
  .refine(
    (data) => {
      // Ensure only one supplier is marked as preferred
      if (data.suppliers) {
        const preferredCount = data.suppliers.filter((s) => s.isPreferred).length;
        return preferredCount <= 1;
      }
      return true;
    },
    {
      message: "Only one supplier can be marked as preferred",
      path: ["suppliers"],
    }
  );

export type CreateIngredientFormInput = z.infer<typeof createIngredientFormSchema>;

export const updateIngredientSchema = baseIngredientSchema
  .omit({ storeId: true })
  .partial()
  .refine(
    (data) => {
      // Ensure only one supplier is marked as preferred
      if (data.suppliers) {
        const preferredCount = data.suppliers.filter((s) => s.isPreferred).length;
        return preferredCount <= 1;
      }
      return true;
    },
    {
      message: "Only one supplier can be marked as preferred",
      path: ["suppliers"],
    }
  );

export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

// Update form schema for client-side (includes suppliers)
export const updateIngredientFormSchema = baseIngredientFormSchema.partial();

export type UpdateIngredientFormInput = z.infer<typeof updateIngredientFormSchema>;

// Material filter schema (for query params)
export const materialFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  supplierId: cuidSchema.optional(),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "overstocked"]).optional(),
  sortBy: z
    .enum(["name", "sku", "currentStock", "unitCost", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type MaterialFilterInput = z.infer<typeof materialFilterSchema>;

// Bulk delete schema
export const bulkDeleteSchema = z.object({
  ids: z.array(cuidSchema).min(1, "At least one ID is required"),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

// Update supplier for material schema
export const updateMaterialSupplierSchema = z.object({
  price: priceSchema.optional(),
  isPreferred: z.boolean().optional(),
});

export type UpdateMaterialSupplierInput = z.infer<typeof updateMaterialSupplierSchema>;

// Add supplier to material schema
export const addMaterialSupplierSchema = z.object({
  supplierId: cuidSchema,
  price: priceSchema,
  isPreferred: z.boolean().default(false),
});

export type AddMaterialSupplierInput = z.infer<typeof addMaterialSupplierSchema>;

// Recipe schemas (new format - standalone recipes, not product-linked)
const recipeIngredientSchema = z.object({
  materialId: cuidSchema,
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
  notes: z.string().max(500, "Notes are too long").optional(),
});

const baseRecipeSchema = z.object({
  storeId: cuidSchema,
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  yieldQuantity: z.number().positive("Yield quantity must be positive"),
  yieldUnit: z.string().min(1, "Yield unit is required").max(20, "Yield unit is too long"),
  productionTimeMinutes: z
    .number()
    .int()
    .min(1, "Production time must be at least 1 minute")
    .nonnegative("Production time must be non-negative"),
  instructions: z.string().max(5000, "Instructions are too long").optional(),
  ingredients: z.array(recipeIngredientSchema).optional(),
});

export const createRecipeSchema = baseRecipeSchema;

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = baseRecipeSchema.partial().omit({ storeId: true });

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

// Form schema for client-side (without storeId)
const baseRecipeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  yieldQuantity: z.number().positive("Yield quantity must be positive"),
  yieldUnit: z.string().min(1, "Yield unit is required").max(20, "Yield unit is too long"),
  productionTimeMinutes: z
    .number()
    .int()
    .min(1, "Production time must be at least 1 minute")
    .nonnegative("Production time must be non-negative"),
  instructions: z.string().max(5000, "Instructions are too long").optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient is required"),
});

export const createRecipeFormSchema = baseRecipeFormSchema;

export type CreateRecipeFormInput = z.infer<typeof createRecipeFormSchema>;

export const updateRecipeFormSchema = baseRecipeFormSchema.partial();

export type UpdateRecipeFormInput = z.infer<typeof updateRecipeFormSchema>;

// Recipe filter schema (for query params)
export const recipeFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z
    .enum(["name", "category", "productionTimeMinutes", "costPerBatch", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type RecipeFilterInput = z.infer<typeof recipeFilterSchema>;

// Duplicate recipe schema
export const duplicateRecipeSchema = z.object({
  newName: z.string().min(1, "New name is required").max(200, "Name is too long"),
});

export type DuplicateRecipeInput = z.infer<typeof duplicateRecipeSchema>;

// Stock movement schemas
export const movementTypeSchema = z.enum([
  "PURCHASE",
  "PRODUCTION_IN",
  "PRODUCTION_OUT",
  "SALE",
  "ADJUSTMENT",
  "WASTE",
]);

export const createStockMovementSchema = z
  .object({
    productId: cuidSchema.optional(),
    materialId: cuidSchema.optional(),
    type: movementTypeSchema,
    quantity: decimalSchema.positive("Quantity must be positive"),
    unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
    orderId: cuidSchema.optional(),
    productionBatchId: cuidSchema.optional(),
    notes: z.string().max(500, "Notes are too long").optional(),
  })
  .refine((data) => data.productId || data.materialId, {
    message: "Either productId or materialId must be provided",
    path: ["productId"],
  });

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

// Supplier schemas
export const createSupplierSchema = z.object({
  storeId: cuidSchema,
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  contactPerson: z
    .string()
    .max(100, "Contact person name is too long")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().max(20, "Phone number is too long").optional().or(z.literal("")),
  address: z.string().max(200, "Address is too long").optional().or(z.literal("")),
  city: z.string().max(100, "City name is too long").optional().or(z.literal("")),
  country: z.string().max(100, "Country name is too long").optional().or(z.literal("")),
  notes: z.string().max(1000, "Notes are too long").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial().omit({ storeId: true });

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
