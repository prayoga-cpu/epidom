import { z } from "zod";
import {
  nameSchema,
  phoneSchema,
  optionalEmailSchema,
  urlSchema,
  localeSchema,
} from "./common.schemas";
import { countryCodeSchema } from "./onboarding.schemas";
import { isValidTimezone } from "@/lib/onboarding/markets";

/**
 * Business and Store validation schemas
 */

/**
 * Business.timezone drives attendance, reports' day boundaries, shifts and
 * the midnight PIN-session expiry, so only an IANA zone the runtime knows
 * ("Europe/Paris") is accepted. Anything else is refused, not stored.
 */
export const businessTimezoneSchema = z
  .string()
  .trim()
  .refine((tz) => isValidTimezone(tz), "Invalid timezone");

// Create business schema
export const createBusinessSchema = z.object({
  name: nameSchema,
  address: z.string().max(200, "Address is too long").optional(),
  city: z.string().max(100, "City name is too long").optional(),
  country: z.string().max(100, "Country name is too long").optional(),
  phone: phoneSchema,
  // Optional contact field. The wizard never asks for it, so most businesses
  // have none; an empty input is "no email", not an error (the Profile dialog
  // sends "" and must still save the timezone and country).
  email: optionalEmailSchema,
  website: urlSchema,
  logo: urlSchema,
  timezone: businessTimezoneSchema.optional(),
  locale: localeSchema.optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// Update business schema (all fields optional)
export const updateBusinessSchema = createBusinessSchema.partial();

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

// The Store columns a create or edit form can set.
const storeDetailsSchema = z.object({
  name: nameSchema,
  address: z.string().max(200, "Address is too long").optional(),
  city: z.string().max(100, "City name is too long").optional(),
  country: z.string().max(100, "Country name is too long").optional(),
  phone: phoneSchema,
  // Optional contact field: an empty input is "no email", not an error.
  email: optionalEmailSchema,
  image: urlSchema,
});

/**
 * Where a new store's currency and payment settings come from (the Create a
 * store dialog's "Use the same currency and payment settings as <store>"
 * switch):
 * - `copy`: copy them from another store of the same business. A source that
 *   follows the shared business settings makes the new store follow them too.
 * - `country`: start from the defaults of `countryCode` (currency, payment
 *   market, that market's payment methods). `currency` is only read when
 *   countryCode is "ZZ" (a country not in the list).
 */
export const storeFinanceSourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("copy"),
    storeId: z.string().trim().min(1, "Choose a store to copy from"),
  }),
  z.object({
    mode: z.literal("country"),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Invalid currency code format")
      .optional(),
  }),
]);

export type StoreFinanceSourceInput = z.infer<typeof storeFinanceSourceSchema>;

// Create store schema. countryCode and financeSource are optional so older
// callers (a body with only the store columns) keep working unchanged.
export const createStoreSchema = storeDetailsSchema.extend({
  /**
   * A code from COUNTRY_CODES (src/lib/onboarding/markets.ts). The server
   * stores the country's English name in Store.country; for "ZZ" (other) the
   * free-text `country` is kept. Also seeds the store's finance settings when
   * no financeSource says otherwise.
   */
  countryCode: countryCodeSchema.optional(),
  financeSource: storeFinanceSourceSchema.optional(),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
/** The request body as sent, before trimming/upper-casing. */
export type CreateStoreRequestBody = z.input<typeof createStoreSchema>;

// Update store schema (all fields optional). Store columns only: a store's
// finance settings are edited in Fees & Taxes, not through the store form.
export const updateStoreSchema = storeDetailsSchema.partial();

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
