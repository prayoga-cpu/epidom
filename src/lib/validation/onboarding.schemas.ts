import { z } from "zod";
import { nameSchema, phoneSchema, urlSchema } from "./common.schemas";
import { BUSINESS_TYPES, COUNTRY_CODES, isValidTimezone } from "@/lib/onboarding/markets";
import { ONBOARDING_GOALS } from "@/lib/onboarding/contracts";

/**
 * Request bodies for the setup wizard (/api/onboarding/*). Response shapes are
 * in src/lib/onboarding/contracts.ts.
 */

/** Same rule as the storefront settings slug (updateStorefrontSchema). */
export const storefrontSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(50, "Slug must not exceed 50 characters")
  .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens");

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => COUNTRY_CODES.includes(code), "Unsupported country");

export const businessTypeSchema = z.enum(BUSINESS_TYPES);

/** An https URL, or empty to clear. Rejects data: URIs (no more inline SVG logos). */
const httpsUrlSchema = urlSchema.refine(
  (value) => !value || value.startsWith("https://"),
  "Image must be an uploaded https URL"
);

/** Step 1 — POST /api/onboarding/store. Creates or updates the business, first store and draft storefront. */
export const onboardingStoreStepSchema = z.object({
  name: nameSchema,
  countryCode: countryCodeSchema,
  city: z.string().trim().max(100, "City name is too long").optional().or(z.literal("")),
  /**
   * The wizard always shows the type picker and sends the owner's current
   * choice, so an absent type means they cleared it (saveStoreStep stores null).
   */
  businessType: businessTypeSchema.optional(),
  /** Browser timezone; used when it belongs to the chosen country (see resolveMarketDefaults). */
  browserTimezone: z
    .string()
    .optional()
    .refine((tz) => !tz || isValidTimezone(tz), "Invalid timezone"),
  /** Only read when countryCode is "ZZ" (other): the currency the owner picked. */
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Invalid currency code format")
    .optional(),
  /** Optional custom store link; the server derives one from the name when absent. */
  slug: storefrontSlugSchema.optional(),
  /**
   * The owner tapped "Use my store name": derive the link from the name again
   * (first free one), even though the name is unchanged. Ignored with `slug`.
   */
  slugFromName: z.boolean().optional(),
  tagline: z.string().trim().max(150, "Tagline must not exceed 150 characters").optional().or(z.literal("")),
  /** Filled by the optional Instagram shortcut. */
  instagramUrl: urlSchema,
  whatsappNumber: phoneSchema,
  logoUrl: httpsUrlSchema,
  themeColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format")
    .optional(),
});
export type OnboardingStoreStepInput = z.infer<typeof onboardingStoreStepSchema>;

export const onboardingMenuItemSchema = z.object({
  /** Present when editing an item created earlier in the wizard (resume). */
  id: z.string().optional(),
  name: z.string().trim().min(1, "Item name is required").max(100, "Item name is too long"),
  price: z.number().nonnegative("Price must be 0 or more").finite(),
});

/** Step 2 — POST /api/onboarding/storefront. Every field is optional; skipping is allowed. */
export const onboardingStorefrontStepSchema = z.object({
  logoUrl: httpsUrlSchema,
  themeColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format")
    .optional(),
  tagline: z.string().trim().max(150, "Tagline must not exceed 150 characters").optional().or(z.literal("")),
  menuItems: z.array(onboardingMenuItemSchema).max(3, "Add up to 3 items here").default([]),
  /**
   * Items saved earlier in the wizard whose row the owner cleared: deleted,
   * but only when they belong to the caller's storefront.
   */
  removedItemIds: z.array(z.string().min(1)).max(3, "Remove up to 3 items here").optional(),
});
export type OnboardingStorefrontStepInput = z.infer<typeof onboardingStorefrontStepSchema>;

/** Step 3 — POST /api/onboarding/complete. Saves goals, publishes the storefront, marks onboarding done. */
export const onboardingCompleteSchema = z.object({
  goals: z
    .array(z.enum(ONBOARDING_GOALS))
    .max(ONBOARDING_GOALS.length)
    .default([])
    .transform((goals) => Array.from(new Set(goals))),
});
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;

/** GET /api/onboarding/slug-check?slug=… */
export const slugCheckQuerySchema = z.object({
  slug: z.string().trim().min(1).max(80),
});
