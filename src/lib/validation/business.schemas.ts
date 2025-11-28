import { z } from "zod";
import {
  nameSchema,
  phoneSchema,
  emailSchema,
  urlSchema,
  currencySchema,
  timezoneSchema,
  localeSchema,
} from "./common.schemas";

/**
 * Business and Store validation schemas
 */

// Create business schema
export const createBusinessSchema = z.object({
  name: nameSchema,
  address: z.string().max(200, "Address is too long").optional(),
  city: z.string().max(100, "City name is too long").optional(),
  country: z.string().max(100, "Country name is too long").optional(),
  phone: phoneSchema,
  email: emailSchema.optional(),
  website: urlSchema,
  logo: urlSchema,
  currency: currencySchema.optional(),
  timezone: timezoneSchema.optional(),
  locale: localeSchema.optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// Update business schema (all fields optional)
export const updateBusinessSchema = createBusinessSchema.partial();

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

// Create store schema
export const createStoreSchema = z.object({
  name: nameSchema,
  address: z.string().max(200, "Address is too long").optional(),
  city: z.string().max(100, "City name is too long").optional(),
  country: z.string().max(100, "Country name is too long").optional(),
  phone: phoneSchema,
  email: emailSchema.optional(),
  image: urlSchema,
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

// Update store schema (all fields optional)
export const updateStoreSchema = createStoreSchema.partial().extend({});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
