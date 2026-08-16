import { z } from "zod";
import {
  cuidSchema,
  priceSchema,
  decimalSchema,
  phoneSchema,
  purchaseQuantitySchema,
  derivedUnitCostSchema,
} from "./common.schemas";

/**
 * Inventory management validation schemas (Products & Ingredients)
 */

// Operational team split (Kitchen/Bar), independent of the free-text `category`
// field — shared across Product/Material/Recipe.
export const departmentSchema = z.enum(["KITCHEN", "BAR"]);

// Materials are raw ingredients, not a single station's preparation — a
// shared ingredient (sugar, ice) can genuinely serve both Kitchen and Bar,
// so materials get a third "Both" option that Product/Recipe/MenuItem don't.
export const materialDepartmentSchema = z.enum(["KITCHEN", "BAR", "BOTH"]);

// Product option schemas — variant groups editable on a Product (e.g.
// "Size"), each option optionally linked to a Material with a custom
// stock-deduction quantity (e.g. "Large" consumes +5g of Sugar per sale).
export const productOptionSchema = z.object({
  name: z.string().min(1, "Option name is required").max(100, "Option name is too long"),
  priceAdjustment: z.number().default(0),
  materialId: cuidSchema.optional(),
  materialQty: z.number().positive("Quantity must be positive").optional(),
});

export const productOptionGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100, "Group name is too long"),
  isRequired: z.boolean().default(false),
  maxSelections: z.number().int().positive().default(1),
  options: z.array(productOptionSchema).min(1, "At least one option is required"),
});

export type ProductOptionInput = z.infer<typeof productOptionSchema>;
export type ProductOptionGroupInput = z.infer<typeof productOptionGroupSchema>;

// Product schemas
const baseProductSchema = z.object({
  storeId: cuidSchema,
  sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  department: departmentSchema.default("KITCHEN"),
  // Orthogonal to `department` — see Product.productLine in schema.prisma.
  // CUSTOM marks an item belonging to the store's optional second product
  // line, managed via its own Data tab rather than the regular Products form.
  productLine: z.enum(["STANDARD", "CUSTOM"]).default("STANDARD"),
  costPrice: priceSchema,
  sellingPrice: priceSchema,
  currentStock: decimalSchema.default(0),
  // How a sale consumes inventory — the authoritative two-tier discriminator.
  // See Product.stockMode in schema.prisma and stock-deduction.service.ts.
  //
  // Deliberately NO cross-field rule here (e.g. "MADE_TO_ORDER requires a
  // primary recipe"): a `.superRefine()` returns a ZodEffects, which has
  // neither `.partial()` nor `.omit()`, so it would break updateProductSchema
  // below at compile time. Mode/recipe consistency is enforced in
  // productService.updateProduct, which can merge the incoming partial with the
  // stored row — a partial PATCH cannot evaluate it on its own.
  stockMode: z.enum(["BATCH_PRODUCED", "MADE_TO_ORDER", "UNTRACKED"]).default("BATCH_PRODUCED"),
  // Which of `recipeIds` defines ONE unit, for sale-time deduction and cost.
  // Must be one of recipeIds; validated store-side in productRepository
  // .updateRecipes, where the store scoping lives.
  primaryRecipeId: cuidSchema.nullish(),
  // true = the owner typed this cost themselves; the primary recipe must never
  // overwrite it. See Product.costPriceManual — the cascade matters because
  // OrderItem.unitCostSnapshot is frozen from Product.costPrice, so a stale
  // cost quietly corrupts every future COGS figure.
  costPriceManual: z.boolean().optional(),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").default("piece"),
  minStock: decimalSchema.default(0),
  maxStock: decimalSchema.default(1000),
  recipeIds: z.array(cuidSchema).optional(), // Changed from recipeId to recipeIds (array)
  productionTime: z.number().int().nonnegative("Production time must be non-negative").optional(),
  shelfLife: z.number().int().positive("Shelf life must be positive").optional(),
  linkedMenuItemId: z.string().optional(),
  optionGroups: z.array(productOptionGroupSchema).optional(),
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
  price: derivedUnitCostSchema,
  purchaseQuantity: purchaseQuantitySchema.default(1),
  isPreferred: z.boolean().default(false),
});

const baseIngredientSchema = z.object({
  storeId: cuidSchema,
  sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  department: materialDepartmentSchema.default("BOTH"),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").default("kg"),
  unitCost: derivedUnitCostSchema,
  purchaseQuantity: purchaseQuantitySchema.default(1),
  currentStock: decimalSchema.default(0),
  minStock: decimalSchema.default(0),
  maxStock: decimalSchema.default(1000),
  // Single next-expiration date for this material's current stock — not
  // per-batch/lot. Nullable so it can be explicitly cleared once set.
  expirationDate: z.coerce.date().nullable().optional(),
  suppliers: z.array(ingredientSupplierSchema).optional(),
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
  // No .default() here (unlike the server-side schema above): the client
  // form always has a concrete value via FORM_DEFAULTS, and zodResolver
  // infers useForm's field-values type from the schema's *input* type, which
  // .default() would make optional and desync from CreateIngredientFormInput
  // (the output type used for the form's TS generic).
  department: materialDepartmentSchema,
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").optional(),
  unitCost: derivedUnitCostSchema,
  purchaseQuantity: purchaseQuantitySchema.optional(),
  currentStock: decimalSchema.optional(),
  minStock: decimalSchema.optional(),
  maxStock: decimalSchema.optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  suppliers: z.array(ingredientSupplierSchema).optional(),
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
  department: materialDepartmentSchema.optional(),
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

// Category delete schema — controls what happens to items in the category:
// "uncategorize" clears the category tag (items are kept), "delete" removes
// the items themselves. Shared by products, materials, and recipes.
export const categoryDeleteSchema = z.object({
  mode: z.enum(["uncategorize", "delete"]).default("uncategorize"),
});

export type CategoryDeleteMode = z.infer<typeof categoryDeleteSchema>["mode"];

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
  department: departmentSchema.default("KITCHEN"),
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
// Note: yieldQuantity and productionTimeMinutes are optional here to allow undefined during editing
// Actual validation and conversion to required values happens in onSubmit handler
const baseRecipeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  // No .default() (see baseIngredientFormSchema's department comment above).
  department: departmentSchema,
  yieldQuantity: z.number().positive("Yield quantity must be positive").optional(),
  yieldUnit: z.string().min(1, "Yield unit is required").max(20, "Yield unit is too long"),
  productionTimeMinutes: z
    .number()
    .int()
    .min(1, "Production time must be at least 1 minute")
    .nonnegative("Production time must be non-negative")
    .optional(),
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
  department: departmentSchema.optional(),
  // Restrict to recipes that can actually be produced in a batch, i.e. that
  // have at least one linked BATCH_PRODUCED product. Applied SERVER-side on
  // purpose: the Produce tab pages at `take: 100`, so filtering in the client
  // would silently truncate a different set than the server counted.
  producibleOnly: z.coerce.boolean().optional(),
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
    reason: z.string().max(200, "Reason is too long").optional(),
    referenceId: z.string().max(100, "Reference ID is too long").optional(),
  })
  .refine((data) => data.productId || data.materialId, {
    message: "Either productId or materialId must be provided",
    path: ["productId"],
  });

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

// Stock adjustment schema (specific for manual adjustments)
export const stockAdjustmentSchema = z
  .object({
    materialId: cuidSchema.optional(),
    productId: cuidSchema.optional(),
    adjustmentType: z.enum(["IN", "OUT"]),
    quantity: decimalSchema.positive("Quantity must be positive"),
    reason: z.string().min(1, "Reason is required").max(200, "Reason is too long"),
    notes: z.string().max(500, "Notes are too long").optional(),
    referenceId: z.string().max(100, "Reference ID is too long").optional(),
  })
  .refine((data) => data.productId || data.materialId, {
    message: "Either productId or materialId must be provided",
    path: ["productId"],
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

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
  phone: phoneSchema,
  address: z.string().max(200, "Address is too long").optional().or(z.literal("")),
  city: z.string().max(100, "City name is too long").optional().or(z.literal("")),
  country: z.string().max(100, "Country name is too long").optional().or(z.literal("")),
  notes: z.string().max(1000, "Notes are too long").optional().or(z.literal("")),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial().omit({ storeId: true });

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// Supplier filter schema (for query params)
export const supplierFilterSchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "contactPerson", "email", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type SupplierFilterInput = z.infer<typeof supplierFilterSchema>;

// Supplier Order schemas
export const supplierOrderItemSchema = z.object({
  materialId: cuidSchema,
  quantity: decimalSchema.positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long").optional(),
  unitPrice: priceSchema,
});

export const createSupplierOrderSchema = z.object({
  supplierId: cuidSchema,
  expectedDate: z.string().datetime({ offset: true }).optional().or(z.date()).optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
  tax: priceSchema.default(0),
  shipping: priceSchema.default(0),
  items: z.array(supplierOrderItemSchema).min(1, "Order must have at least one item"),
});

export type CreateSupplierOrderInput = z.infer<typeof createSupplierOrderSchema>;

export const updateSupplierOrderSchema = z.object({
  status: z.enum(["PENDING", "ORDERED", "RECEIVED", "CANCELLED"]).optional(),
  expectedDate: z.string().datetime({ offset: true }).optional().or(z.date()).optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
  tax: priceSchema.default(0),
  shipping: priceSchema.default(0),
});

export type UpdateSupplierOrderInput = z.infer<typeof updateSupplierOrderSchema>;
