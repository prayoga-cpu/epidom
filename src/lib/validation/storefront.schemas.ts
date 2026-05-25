import { z } from "zod";
import { nameSchema, phoneSchema, urlSchema, priceSchema } from "./common.schemas";

// Custom link structure
export const customLinkSchema = z.object({
  label: z.string().min(1, "Label is required").max(100, "Label is too long"),
  url: z.string().url("Invalid URL format"),
});

// Opening hours for a single day
export const dayOpeningHoursSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)").optional().or(z.literal("")),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)").optional().or(z.literal("")),
  isClosed: z.boolean().default(false),
});

// Full opening hours week configuration
export const openingHoursSchema = z.object({
  monday: dayOpeningHoursSchema.optional(),
  tuesday: dayOpeningHoursSchema.optional(),
  wednesday: dayOpeningHoursSchema.optional(),
  thursday: dayOpeningHoursSchema.optional(),
  friday: dayOpeningHoursSchema.optional(),
  saturday: dayOpeningHoursSchema.optional(),
  sunday: dayOpeningHoursSchema.optional(),
});

// Modifier option (e.g. "Extra Cheese" -> priceAdd: 5000)
export const modifierOptionSchema = z.object({
  name: z.string().min(1, "Option name is required").max(100),
  priceAdd: z.number().nonnegative("Price add-on must be non-negative"),
});

// Modifier group (e.g. "Select Sauce" with min/max requirements)
export const modifierSchema = z.object({
  name: z.string().min(1, "Modifier group name is required").max(100),
  isRequired: z.boolean().default(false),
  maxSelections: z.number().int().positive().default(1),
  options: z.array(modifierOptionSchema).min(1, "At least one option is required"),
});

// Storefront update settings schema
export const updateStorefrontSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must not exceed 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
    .optional(),
  displayName: nameSchema.optional(),
  tagline: z.string().max(150, "Tagline must not exceed 150 characters").optional().or(z.literal("")),
  description: z.string().max(500, "Description must not exceed 500 characters").optional().or(z.literal("")),
  logoUrl: urlSchema,
  heroImageUrl: urlSchema,
  themeColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format").optional(),
  fontFamily: z.string().default("Inter").optional(),
  
  whatsappNumber: phoneSchema,
  instagramUrl: urlSchema,
  tiktokUrl: urlSchema,
  gofoodUrl: urlSchema,
  grabfoodUrl: urlSchema,
  shopeefoodUrl: urlSchema,
  googleMapsUrl: urlSchema,
  customLinks: z.array(customLinkSchema).optional(),
  
  isPublished: z.boolean().default(false),
  acceptsOrders: z.boolean().default(false),
  openingHours: openingHoursSchema.optional(),
});

export type UpdateStorefrontInput = z.infer<typeof updateStorefrontSchema>;

// MenuCategory schema
export const createMenuCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name is too long"),
  displayOrder: z.number().int().optional().default(0),
});

export const updateMenuCategorySchema = createMenuCategorySchema.partial();

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

// MenuItem schema
export const createMenuItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(100, "Item name is too long"),
  categoryId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().max(300, "Description is too long").optional().or(z.literal("")),
  price: priceSchema,
  currency: z.string().default("IDR"),
  imageUrl: urlSchema,
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().optional().default(0),
  modifiers: z.array(modifierSchema).optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
