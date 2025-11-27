/**
 * Form Default Values Configuration
 *
 * Centralized configuration for all form default values in the dashboard.
 * This allows easy modification of default values without changing multiple files.
 *
 * Usage:
 * Import this config in your form components and use it in useForm defaultValues:
 *
 * import { FORM_DEFAULTS } from "@/lib/config/form-defaults";
 *
 * const form = useForm({
 *   defaultValues: FORM_DEFAULTS.material
 * });
 */

export const FORM_DEFAULTS = {
  /**
   * Material/Ingredient form defaults
   * Using undefined for number fields to allow empty input (better UX)
   */
  material: {
    sku: "",
    name: "",
    description: "",
    category: "",
    unit: "kg",
    unitCost: undefined as number | undefined,
    currentStock: undefined as number | undefined,
    minStock: undefined as number | undefined,
    maxStock: undefined as number | undefined,
    suppliers: [],
    isActive: true,
  },

  /**
   * Product form defaults
   * Using undefined for number fields to allow empty input (better UX)
   */
  product: {
    name: "",
    sku: "",
    description: "",
    category: "",
    retailPrice: undefined as number | undefined,
    costPrice: undefined as number | undefined,
    unit: "piece",
    currentStock: undefined as number | undefined,
    minStock: undefined as number | undefined,
    maxStock: undefined as number | undefined,
    recipeId: "none",
  },

  /**
   * Recipe form defaults
   * Using undefined for number fields to allow empty input (better UX)
   */
  recipe: {
    name: "",
    description: "",
    category: undefined as string | undefined,
    yieldQuantity: undefined as number | undefined,
    yieldUnit: "",
    productionTimeMinutes: undefined as number | undefined,
    ingredients: [],
    instructions: "",
  },

  /**
   * Supplier form defaults
   */
  supplier: {
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    notes: "",
    isActive: true,
  },

  /**
   * Store form defaults
   */
  store: {
    name: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: "",
    image: "",
  },

  /**
   * Order form defaults
   */
  order: {
    supplierId: "",
    items: [],
    tax: 0,
    delivery: 0,
    notes: "",
  },
} as const;

/**
 * Helper function to get default values with type safety
 */
export function getFormDefaults<T extends keyof typeof FORM_DEFAULTS>(
  formType: T
): (typeof FORM_DEFAULTS)[T] {
  return { ...FORM_DEFAULTS[formType] };
}

/**
 * Type exports for form default values
 */
export type MaterialFormDefaults = typeof FORM_DEFAULTS.material;
export type ProductFormDefaults = typeof FORM_DEFAULTS.product;
export type RecipeFormDefaults = typeof FORM_DEFAULTS.recipe;
export type SupplierFormDefaults = typeof FORM_DEFAULTS.supplier;
export type StoreFormDefaults = typeof FORM_DEFAULTS.store;
export type OrderFormDefaults = typeof FORM_DEFAULTS.order;
