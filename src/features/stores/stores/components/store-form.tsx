"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import type { CreateStoreInput } from "@/lib/validation/business.schemas";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/shared/image-upload";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  CountrySelect,
  MarketSummary,
  createStoreEssentialsSchema,
  useDefaultCountryCode,
  STORE_CITY_MAX_LENGTH,
  STORE_NAME_MAX_LENGTH,
} from "@/features/stores/shared";
import {
  COUNTRY_CODES,
  OTHER_COUNTRY_CODE,
  OTHER_COUNTRY_DEFAULT_CURRENCY,
  countryCodeFromName,
  getCountry,
} from "@/lib/onboarding/markets";
import { cn } from "@/lib/utils";
import type { Store } from "../hooks/use-stores";

export type StoreFormMode = "create" | "edit";

export const CREATE_STORE_FORM_ID = "create-store-form";
export const EDIT_STORE_FORM_ID = "edit-store-form";

const ADDRESS_MAX_LENGTH = 200;
const COUNTRY_NAME_MAX_LENGTH = 100;
/** Same rule as the server's phoneSchema (E.164, what <PhoneInput> produces). */
const PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;
const emailFormat = z.string().email();

/** The `t` from `useI18n()`. */
type Translate = (key: string) => string;

/**
 * The store essentials (name, country, city, "Other country" currency) with
 * localized messages, plus the store's contact details and the Create a store
 * dialog's "same settings as" switch. A country is required to create a
 * store; editing one keeps an unknown legacy country as it is, so an empty
 * picker is accepted there.
 */
function createStoreFormSchema(t: Translate, mode: StoreFormMode) {
  const tooLong = (max: number) =>
    t("stores.form.validation.tooLong").replace("{max}", String(max));
  return createStoreEssentialsSchema(t)
    .omit({ businessType: true })
    .extend({
      countryCode: z
        .string()
        .trim()
        .toUpperCase()
        .refine(
          (code) => code === "" || COUNTRY_CODES.includes(code),
          t("storeEssentials.validation.countryRequired")
        ),
      /** Free-text country name, only used with "Other country". */
      country: z
        .string()
        .trim()
        .max(COUNTRY_NAME_MAX_LENGTH, tooLong(COUNTRY_NAME_MAX_LENGTH))
        .optional(),
      address: z.string().trim().max(ADDRESS_MAX_LENGTH, tooLong(ADDRESS_MAX_LENGTH)).optional(),
      phone: z
        .string()
        .optional()
        .refine(
          (value) => !value || PHONE_PATTERN.test(value),
          t("stores.form.validation.phoneInvalid")
        ),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .optional()
        .refine(
          (value) => !value || emailFormat.safeParse(value).success,
          t("stores.form.validation.emailInvalid")
        ),
      image: z.string().optional(),
      copyFinance: z.boolean(),
      copyFromStoreId: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (mode === "create" && !values.countryCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["countryCode"],
          message: t("storeEssentials.validation.countryRequired"),
        });
      }
      // Editing: "Other country" with no name can't be saved (the server keeps
      // the old country when the name is empty), so ask for it rather than
      // report a change that didn't happen.
      if (mode === "edit" && values.countryCode === OTHER_COUNTRY_CODE && !values.country) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["country"],
          message: t("stores.form.validation.otherCountryNameRequired"),
        });
      }
    });
}

type StoreFormSchema = ReturnType<typeof createStoreFormSchema>;
/** Raw values react-hook-form holds. */
export type StoreFormInput = z.input<StoreFormSchema>;
/** Parsed values handed to the payload builders. */
export type StoreFormValues = z.output<StoreFormSchema>;

/**
 * The business's own stores (never one this account only works at as staff),
 * oldest first: the Create a store dialog's copy sources, and where its
 * default country comes from.
 */
export function copySourceStores(stores: Store[] | undefined | null): Store[] {
  return (stores ?? [])
    .filter((store) => store.accessRole !== "staff")
    .slice()
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return Number.isFinite(diff) && diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
}

/**
 * The country to pre-select when creating a store: the oldest store's, else
 * the business's, else any other store's. Undefined lets the browser guess
 * (useDefaultCountryCode).
 */
export function defaultCreateCountryCode(
  sources: Store[],
  businessCountry?: string | null
): string | undefined {
  return (
    countryCodeFromName(sources[0]?.country) ??
    countryCodeFromName(businessCountry) ??
    sources.map((store) => countryCodeFromName(store.country)).find((code) => !!code)
  );
}

function buildDefaultValues(
  mode: StoreFormMode,
  store: Partial<Store> | undefined,
  sources: Store[],
  businessCountry: string | null | undefined
): StoreFormInput {
  if (mode === "edit") {
    // A stored country the list recognises pre-fills the picker; anything
    // else is kept as text (shown as the current value, never overwritten
    // unless the owner picks a country).
    const code = countryCodeFromName(store?.country);
    return {
      name: store?.name ?? "",
      countryCode: code ?? "",
      city: store?.city ?? "",
      currency: undefined,
      country: code ? "" : (store?.country ?? ""),
      address: store?.address ?? "",
      phone: store?.phone ?? "",
      email: store?.email ?? "",
      image: store?.image ?? "",
      copyFinance: false,
      copyFromStoreId: undefined,
    };
  }
  return {
    name: "",
    countryCode: defaultCreateCountryCode(sources, businessCountry) ?? "",
    city: "",
    currency: undefined,
    country: "",
    address: "",
    phone: "",
    email: "",
    image: "",
    copyFinance: sources.length > 0,
    copyFromStoreId: sources[0]?.id,
  };
}

const trimmed = (value: string | undefined) => value?.trim() || undefined;

/**
 * POST /api/stores body. Always sends `countryCode`; `financeSource` copies
 * the chosen store's settings when the switch is on, else starts from the
 * country's defaults (with the picked currency for "Other country").
 */
export function buildCreateStorePayload(
  values: StoreFormValues,
  sources: Store[]
): CreateStoreInput {
  const isOther = values.countryCode === OTHER_COUNTRY_CODE;
  const source =
    sources.length > 0 && values.copyFinance
      ? (sources.find((store) => store.id === values.copyFromStoreId) ?? sources[0])
      : undefined;
  const city = trimmed(values.city);
  const country = isOther ? trimmed(values.country) : undefined;
  const address = trimmed(values.address);
  return {
    name: values.name,
    countryCode: values.countryCode,
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ...(address ? { address } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.email ? { email: values.email } : {}),
    ...(values.image ? { image: values.image } : {}),
    financeSource: source
      ? { mode: "copy", storeId: source.id }
      : { mode: "country", ...(isOther && values.currency ? { currency: values.currency } : {}) },
  };
}

/**
 * PATCH /api/stores/[id] body. The country is only sent when the owner
 * changed it, so an unknown legacy value (or an old spelling the list
 * recognises) is never rewritten behind their back. Never a financeSource:
 * finance settings live in Profile → Fees & Taxes.
 */
export function buildEditStorePayload(
  values: StoreFormValues,
  initial: { countryCode: string; country?: string }
): CreateStoreInput {
  const payload: CreateStoreInput = {
    name: values.name,
    city: values.city?.trim() ?? "",
    address: values.address?.trim() ?? "",
    phone: values.phone ?? "",
    email: values.email ?? "",
    image: values.image ?? "",
  };
  const isOther = values.countryCode === OTHER_COUNTRY_CODE;
  const countryText = values.country?.trim() ?? "";
  const changed =
    values.countryCode !== initial.countryCode ||
    (isOther && countryText !== (initial.country ?? "").trim());
  if (values.countryCode && changed) {
    payload.countryCode = values.countryCode;
    if (isOther) payload.country = countryText;
  }
  return payload;
}

export interface StoreFormProps {
  /** Defaults to "edit" when `defaultValues` is given, else "create". */
  mode?: StoreFormMode;
  /** The <form> id an external submit button points at. */
  formId?: string;
  /** The store being edited (edit mode). */
  defaultValues?: Partial<Store>;
  /**
   * Create mode: the stores this account can see (staff-only ones are
   * ignored). With at least one, the "same currency and payment settings
   * as <store>" switch is shown, on by default, copying from the oldest.
   */
  existingStores?: Store[];
  /** Create mode: the business's own country, the default after the stores'. */
  businessCountry?: string | null;
  /**
   * Create mode: the business timezone, shown in the market summary (every
   * store runs on it; creating a store never changes it).
   */
  businessTimezone?: string | null;
  /**
   * Create mode: each copy source's current currency by store id (GET
   * /api/stores/overview). The "different currency" warning compares against
   * it; a store missing here falls back to its country's currency.
   */
  sourceCurrencyById?: Readonly<Record<string, string>>;
  onSubmit: (data: CreateStoreInput) => void;
  /** Loading state (e.g., during API call). */
  isLoading?: boolean;
  /** Inline submit button text (only with showActions). */
  submitText?: string;
  onCancel?: () => void;
  /** Whether to show action buttons (if false, buttons are handled externally). */
  showActions?: boolean;
  /** Told whenever the store image starts or stops uploading. */
  onUploadStateChange?: (isUploading: boolean) => void;
}

/**
 * Shared form for creating and editing a store (CreateStoreDialog and
 * EditStoreDialog).
 *
 * The essentials come first — name, country, city — then, when creating,
 * "Currency & payments" (copy another store's settings, or start from the
 * country's defaults), then an optional "More details" section (image,
 * address, phone, email), closed by default when creating. Editing never
 * touches finance settings; a hint points to Profile → Fees & Taxes.
 */
export function StoreForm({
  mode: modeProp,
  formId: formIdProp,
  defaultValues,
  existingStores,
  businessCountry,
  businessTimezone,
  sourceCurrencyById,
  onSubmit,
  isLoading = false,
  submitText,
  onCancel,
  showActions = true,
  onUploadStateChange,
}: StoreFormProps) {
  const { t } = useI18n();
  const mode: StoreFormMode = modeProp ?? (defaultValues ? "edit" : "create");
  const isCreate = mode === "create";
  const sources = useMemo(
    () => (isCreate ? copySourceStores(existingStores) : []),
    [isCreate, existingStores]
  );
  const schema = useMemo(() => createStoreFormSchema(t, mode), [t, mode]);
  // Computed once: the form keeps what the owner typed even if the props change.
  const [initialValues] = useState(() =>
    buildDefaultValues(mode, defaultValues, sources, businessCountry)
  );
  const form = useForm<StoreFormInput, unknown, StoreFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const { control, getValues, setValue } = form;

  const [detailsOpen, setDetailsOpen] = useState(!isCreate);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const detailsId = useId();
  const financeTitleId = useId();
  const guessedCountry = useDefaultCountryCode();

  const countryCode = useWatch({ control, name: "countryCode" });
  const currency = useWatch({ control, name: "currency" });
  const copyFinance = useWatch({ control, name: "copyFinance" });
  const copyFromStoreId = useWatch({ control, name: "copyFromStoreId" });
  const isOther = countryCode === OTHER_COUNTRY_CODE;
  const copying = isCreate && sources.length > 0 && copyFinance;
  const selectedSource = sources.find((store) => store.id === copyFromStoreId) ?? sources[0];
  // The currency the source really uses (a legacy store often has no country,
  // or one that isn't its currency's), else the one its country implies.
  const sourceCurrency =
    (selectedSource ? sourceCurrencyById?.[selectedSource.id] : undefined) ??
    getCountry(countryCodeFromName(selectedSource?.country))?.currency;
  // The copied currency would not be the chosen country's.
  const currencyMismatch =
    copying &&
    !!sourceCurrency &&
    !!countryCode &&
    getCountry(countryCode)?.currency !== sourceCurrency;
  const legacyCountry =
    !isCreate && !initialValues.countryCode && initialValues.country ? initialValues.country : null;

  // Create: suggest the browser's country when neither a store nor the
  // business gave one. Never replaces a country already chosen.
  useEffect(() => {
    if (!isCreate || !guessedCountry || getValues("countryCode")) return;
    setValue("countryCode", guessedCountry, { shouldDirty: false });
  }, [isCreate, guessedCountry, getValues, setValue]);

  // "Other country" always carries a currency, so what the picker shows is what gets saved.
  useEffect(() => {
    if (isCreate && isOther && !currency) {
      setValue("currency", OTHER_COUNTRY_DEFAULT_CURRENCY, { shouldDirty: false });
    }
  }, [isCreate, isOther, currency, setValue]);

  const handleUploadState = useCallback(
    (uploading: boolean) => {
      setIsImageUploading(uploading);
      onUploadStateChange?.(uploading);
    },
    [onUploadStateChange]
  );

  const formId =
    formIdProp ?? (showActions ? undefined : isCreate ? CREATE_STORE_FORM_ID : EDIT_STORE_FORM_ID);

  const handleValid = (values: StoreFormValues) => {
    // The image lands in the form only once its upload finishes.
    if (isImageUploading) return;
    onSubmit(
      isCreate
        ? buildCreateStorePayload(values, sources)
        : buildEditStorePayload(values, {
            countryCode: initialValues.countryCode,
            country: initialValues.country,
          })
    );
  };

  // A mistake inside the closed "More details" section would otherwise be invisible.
  const handleInvalid = (errors: FieldErrors<StoreFormInput>) => {
    if (errors.address || errors.phone || errors.email || errors.image) setDetailsOpen(true);
  };

  const optional = (
    <span className="text-muted-foreground font-normal">{t("storeEssentials.optionalSuffix")}</span>
  );
  const required = (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleValid, handleInvalid)}
        className="space-y-4"
        noValidate
      >
        {/* Store name - required */}
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("storeEssentials.name.label")} {required}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={t("storeEssentials.name.placeholder")}
                  autoFocus={isCreate}
                  autoComplete="organization"
                  maxLength={STORE_NAME_MAX_LENGTH}
                  aria-required
                  disabled={isLoading}
                  className="h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Country - required to create; edit keeps an unknown legacy value */}
        <FormField
          control={control}
          name="countryCode"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>
                {t("storeEssentials.country.label")} {isCreate ? required : null}
              </FormLabel>
              <FormControl>
                <CountrySelect
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  disabled={isLoading}
                  // The saved free text stands in for the empty picker.
                  placeholder={legacyCountry ?? undefined}
                  onChange={(next) => {
                    field.onChange(next);
                    // A listed country implies its own currency; drop an "Other" pick.
                    if (next !== OTHER_COUNTRY_CODE && getValues("currency")) {
                      setValue("currency", undefined, { shouldDirty: true });
                    }
                  }}
                />
              </FormControl>
              {legacyCountry && !field.value ? (
                <FormDescription className="text-xs">
                  {t("stores.form.legacyCountry").replace("{country}", legacyCountry)}
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* "Other country": its name, stored as the store's country text */}
        {isOther ? (
          <FormField
            control={control}
            name="country"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>
                  {t("stores.form.otherCountryName")} {isCreate ? optional : required}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={t("stores.form.otherCountryNamePlaceholder")}
                    autoComplete="country-name"
                    maxLength={COUNTRY_NAME_MAX_LENGTH}
                    aria-required={!isCreate}
                    disabled={isLoading}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {/* City - optional */}
        <FormField
          control={control}
          name="city"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>
                {t("storeEssentials.city.label")} {optional}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={t("storeEssentials.city.placeholder")}
                  autoComplete="address-level2"
                  maxLength={STORE_CITY_MAX_LENGTH}
                  disabled={isLoading}
                  className="h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCreate ? (
          /* Currency & payments: copy another store's, or the country's defaults */
          <section aria-labelledby={financeTitleId} className="space-y-3">
            <h3 id={financeTitleId} className="text-sm font-semibold">
              {t("stores.form.currencyAndPayments")}
            </h3>

            {sources.length > 0 ? (
              <FormField
                control={control}
                name="copyFinance"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 space-y-1">
                      {/* The label toggles the switch too: a big touch target. */}
                      <FormLabel className="cursor-pointer leading-snug">
                        {t("stores.form.copySettings").replace(
                          "{store}",
                          selectedSource?.name ?? ""
                        )}
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {t("stores.form.copySettingsHint")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={isLoading}
                        className="mt-0.5"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}

            {copying && sources.length > 1 ? (
              <FormField
                control={control}
                name="copyFromStoreId"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>{t("stores.form.copyFrom")}</FormLabel>
                    <Select
                      value={field.value ?? sources[0]?.id}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 w-full min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sources.map((store) => (
                          <SelectItem key={store.id} value={store.id} className="min-h-10">
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {currencyMismatch && selectedSource && sourceCurrency ? (
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 size-3.5 shrink-0 text-[var(--epi-gold-600)]"
                />
                <span>
                  {t("stores.form.copyCurrencyMismatch")
                    .replace("{store}", selectedSource.name)
                    .replace("{currency}", sourceCurrency)}
                </span>
              </p>
            ) : null}

            {!copying && countryCode ? (
              isOther ? (
                <FormField
                  control={control}
                  name="currency"
                  render={({ field, fieldState }) => (
                    <FormItem className="gap-1">
                      <MarketSummary
                        countryCode={countryCode}
                        currency={field.value}
                        onCurrencyChange={field.onChange}
                        timezone={businessTimezone ?? null}
                        currencySelectProps={{
                          ref: field.ref,
                          name: field.name,
                          onBlur: field.onBlur,
                          disabled: isLoading,
                          "aria-invalid": fieldState.invalid,
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                // The timezone is the business's, shared by every store (Store
                // has no timezone column), so show that one instead of the
                // zone the country would imply; unknown hides the row.
                <MarketSummary countryCode={countryCode} timezone={businessTimezone ?? null} />
              )
            ) : null}
          </section>
        ) : (
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{t("stores.form.financeInProfile")}</span>
          </p>
        )}

        {/* More details - optional, closed by default when creating */}
        <div className="rounded-lg border">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
            className="focus-visible:ring-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {t("stores.form.moreDetails")} {optional}
              </span>
              <span className="text-muted-foreground block text-xs">
                {t("stores.form.moreDetailsHint")}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn("size-4 shrink-0 transition-transform", detailsOpen && "rotate-180")}
            />
          </button>
          {/* Hidden, not unmounted: an upload in progress and typed values survive a collapse. */}
          <div id={detailsId} hidden={!detailsOpen} className="space-y-4 border-t px-3 py-3">
            {/* Store image. The storefront's cover image outranks it on the /stores card. */}
            <FormField
              control={control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("stores.storeImage")}</FormLabel>
                  <FormDescription className="text-xs">
                    {t("stores.storeImageHint")}
                  </FormDescription>
                  <ImageUpload
                    value={field.value || undefined}
                    onChange={(url) => field.onChange(url ?? "")}
                    onUploadStateChange={handleUploadState}
                    disabled={isLoading}
                    aspectRatio="16/9"
                    compact
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address - optional */}
            <FormField
              control={control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.address")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={t("stores.addressPlaceholder")}
                      autoComplete="street-address"
                      maxLength={ADDRESS_MAX_LENGTH}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone - optional */}
            <FormField
              control={control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.phone")}</FormLabel>
                  <FormControl>
                    <PhoneInput
                      placeholder={t("stores.phonePlaceholder")}
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value ?? "")}
                      onBlur={field.onBlur}
                      defaultCountry={getCountry(countryCode) ? countryCode : "FR"}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email - optional */}
            <FormField
              control={control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t("stores.emailPlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Form Actions - Only show if showActions is true */}
        {showActions && (
          <div className="flex gap-3 pt-4 sm:justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading || isImageUploading}
                className="min-h-10 flex-1 sm:flex-none"
              >
                {t("actions.cancel")}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || isImageUploading}
              className="min-h-10 flex-1 sm:flex-none"
            >
              {isImageUploading
                ? t("stores.form.uploadingImage")
                : isLoading
                  ? t("actions.saving")
                  : (submitText ?? t("actions.save"))}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
