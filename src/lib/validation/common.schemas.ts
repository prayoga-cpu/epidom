import { z } from "zod";

/**
 * Common validation schemas used across the application
 */

// Email validation
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .toLowerCase()
  .trim();

// Password validation
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

// Name validation
export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must not exceed 100 characters")
  .trim();

// Phone validation (optional)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
  .optional()
  .or(z.literal(""));

// URL validation
export const urlSchema = z.string().url("Invalid URL format").optional().or(z.literal(""));

// Locale validation
export const localeSchema = z.enum(["en", "fr", "id"], {
  errorMap: () => ({ message: "Invalid locale. Must be en, fr, or id" }),
});

// Currency validation
export const currencySchema = z
  .string()
  .length(3, "Currency code must be 3 characters")
  .regex(/^[A-Z]{3}$/, "Invalid currency code format")
  .default("EUR");

// Timezone validation
export const timezoneSchema = z.string().default("UTC");

// CUID validation
export const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/, "Invalid ID format");

// Decimal/numeric validation
export const decimalSchema = z
  .number()
  .nonnegative("Value must be non-negative")
  .finite("Value must be finite");

export const priceSchema = z
  .number()
  .nonnegative("Price must be non-negative")
  .finite("Price must be finite")
  .multipleOf(0.01, "Price can only have 2 decimal places");

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Date range schemas
export const dateRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
});

// ============================================
// Base Filter Schema Factory (DRY)
// ============================================

/**
 * Base pagination fields for filter schemas
 * Used by material, product, recipe, supplier filters
 */
export const basePaginationFields = {
  search: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
};

/**
 * Create a filter schema with custom sortBy options
 * @param sortByOptions - Array of valid sortBy field names
 * @param defaultSortBy - Default sortBy field (defaults to "createdAt")
 * @returns Zod schema for filter
 *
 * @example
 * const productFilterSchema = createBaseFilterSchema(
 *   ["name", "sku", "currentStock", "costPrice", "sellingPrice", "createdAt", "updatedAt"]
 * );
 */
export function createBaseFilterSchema<T extends readonly [string, ...string[]]>(
  sortByOptions: T,
  defaultSortBy: T[number] = "createdAt" as T[number]
) {
  return z.object({
    ...basePaginationFields,
    sortBy: z.enum(sortByOptions).default(defaultSortBy),
  });
}

/**
 * Base filter schema with common sortBy options
 * For entities with standard timestamp fields
 */
export const baseFilterSchema = createBaseFilterSchema(["name", "createdAt", "updatedAt"] as const);
