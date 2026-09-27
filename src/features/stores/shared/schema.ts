import { z } from "zod";
import { COUNTRY_CODES, OTHER_COUNTRY_CODE, type BusinessType } from "@/lib/onboarding/markets";
import { businessTypeSchema, onboardingStoreStepSchema } from "@/lib/validation/onboarding.schemas";

/**
 * The store essentials — what the setup wizard's first step and the Your Stores
 * Create/Edit store dialogs both ask for first: name, country, city and, where
 * shown, the kind of place. `currency` is only read for "Other country"
 * (OTHER_COUNTRY_CODE); every listed country implies its own currency.
 *
 * The limits match the server's (onboardingStoreStepSchema), so a form that
 * passes here is never refused by /api/onboarding/store for these fields.
 */
export const STORE_NAME_MIN_LENGTH = 2;
export const STORE_NAME_MAX_LENGTH = 100;
export const STORE_CITY_MAX_LENGTH = 100;

/**
 * Static schema with the server's English messages — the same rules the
 * onboarding API applies, picked straight from onboardingStoreStepSchema. For a
 * form a person fills in, use `createStoreEssentialsSchema(t)` instead so the
 * error messages follow the UI language.
 */
export const storeEssentialsSchema = onboardingStoreStepSchema.pick({
  name: true,
  countryCode: true,
  city: true,
  businessType: true,
  currency: true,
});

/** Parsed (output) values of the essentials. */
export type StoreEssentialsValues = z.infer<typeof storeEssentialsSchema>;
/**
 * Raw (input) values, what react-hook-form holds before parsing. A cleared
 * business type is null, not undefined: react-hook-form's useController falls
 * back to the field's mount-time value when it becomes undefined, so a chip the
 * form started with could never be un-pressed. `createStoreEssentialsSchema`
 * turns that null back into undefined, so parsed values never carry it.
 */
export type StoreEssentialsInput = Omit<z.input<typeof storeEssentialsSchema>, "businessType"> & {
  businessType?: BusinessType | null;
};

/** The `t` from `useI18n()`. */
type Translate = (key: string) => string;

/**
 * Same shape and rules as `storeEssentialsSchema`, with messages in the UI
 * language. zod bakes a message in when the schema is built, so a form builds
 * it with `useMemo(() => createStoreEssentialsSchema(t), [t])`. It is a plain
 * z.object, so a caller can `.extend()` it with its own fields (image,
 * address, a "same settings as" switch…).
 */
export function createStoreEssentialsSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("storeEssentials.validation.nameRequired"))
      .min(
        STORE_NAME_MIN_LENGTH,
        t("storeEssentials.validation.nameTooShort").replace("{min}", String(STORE_NAME_MIN_LENGTH))
      )
      .max(
        STORE_NAME_MAX_LENGTH,
        t("storeEssentials.validation.nameTooLong").replace("{max}", String(STORE_NAME_MAX_LENGTH))
      ),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (code) => COUNTRY_CODES.includes(code),
        t("storeEssentials.validation.countryRequired")
      ),
    city: z
      .string()
      .trim()
      .max(
        STORE_CITY_MAX_LENGTH,
        t("storeEssentials.validation.cityTooLong").replace("{max}", String(STORE_CITY_MAX_LENGTH))
      )
      .optional()
      .or(z.literal("")),
    // The form holds null for a cleared choice (see StoreEssentialsInput);
    // parsed values say undefined, like the server schema.
    businessType: businessTypeSchema.nullish().transform((value) => value ?? undefined),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, t("storeEssentials.validation.currencyInvalid"))
      .optional(),
  });
}

/**
 * Blank essentials for `useForm({ defaultValues })`. `countryCode` starts
 * empty; <StoreEssentialsFields> fills in the browser's best guess (see
 * useDefaultCountryCode) unless the caller passes one — e.g. the business's
 * country in the Create a store dialog, via `countryCodeFromName()`.
 */
export function storeEssentialsDefaultValues(
  overrides: Partial<StoreEssentialsInput> = {}
): StoreEssentialsInput {
  return {
    name: "",
    countryCode: "",
    city: "",
    businessType: undefined,
    currency: undefined,
    ...overrides,
  };
}

/**
 * The essentials as an API body: trimmed, the currency sent only for "Other
 * country" (a listed country always implies its own), an empty city left out.
 * The keys match onboardingStoreStepSchema.
 */
export function storeEssentialsPayload(values: StoreEssentialsValues): {
  name: string;
  countryCode: string;
  city?: string;
  businessType?: StoreEssentialsValues["businessType"];
  currency?: string;
} {
  const countryCode = values.countryCode.trim().toUpperCase();
  const city = values.city?.trim();
  return {
    name: values.name.trim(),
    countryCode,
    ...(city ? { city } : {}),
    ...(values.businessType ? { businessType: values.businessType } : {}),
    ...(countryCode === OTHER_COUNTRY_CODE && values.currency
      ? { currency: values.currency.trim().toUpperCase() }
      : {}),
  };
}
