"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { OTHER_COUNTRY_CODE, OTHER_COUNTRY_DEFAULT_CURRENCY } from "@/lib/onboarding/markets";
import { CountrySelect } from "./country-select";
import { BusinessTypePicker } from "./business-type-picker";
import { MarketSummary } from "./market-summary";
import { useBrowserTimezone, useDefaultCountryCode } from "./use-default-country-code";
import { STORE_CITY_MAX_LENGTH, STORE_NAME_MAX_LENGTH, type StoreEssentialsInput } from "./schema";

export interface StoreEssentialsFieldsProps {
  /** Overrides the "Store name" label. */
  nameLabel?: string;
  /** Overrides the name placeholder. */
  namePlaceholder?: string;
  autoFocusName?: boolean;
  /** Show the business type chips (default true). */
  showBusinessType?: boolean;
  /**
   * Show what the country fills in automatically (default true). Pass false
   * when those settings come from elsewhere — e.g. the Create a store
   * dialog's "use the same currency & payment settings as <store>" switch is on.
   */
  showMarketSummary?: boolean;
  /**
   * Pre-fill an empty country with the browser's best guess (default true).
   * Never overwrites a country already in the form.
   */
  autoDetectCountry?: boolean;
  /** Overrides the browser timezone the market summary shows (default: the browser's). */
  browserTimezone?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * The store essentials, in order: name → country → city → business type →
 * what the country sets up. Rendered inside a shadcn <Form> (react-hook-form
 * context) whose values include StoreEssentialsInput — build the resolver with
 * `createStoreEssentialsSchema(t)` (it can be `.extend()`ed with more fields).
 *
 * Field names: `name`, `countryCode`, `city`, `businessType` (null once the
 * owner clears it; the schema parses that to undefined), and `currency`
 * (only for "Other country": set to OTHER_COUNTRY_DEFAULT_CURRENCY when Other is
 * picked with no currency, cleared when the owner picks a listed country).
 */
export function StoreEssentialsFields({
  nameLabel,
  namePlaceholder,
  autoFocusName,
  showBusinessType = true,
  showMarketSummary = true,
  autoDetectCountry = true,
  browserTimezone,
  disabled,
  className,
}: StoreEssentialsFieldsProps) {
  const { t } = useI18n();
  const form = useFormContext<StoreEssentialsInput>();
  const { control, setValue, getValues, formState } = form;
  const countryCode = useWatch({ control, name: "countryCode" });
  const currency = useWatch({ control, name: "currency" });
  const guessedCountry = useDefaultCountryCode();
  const detectedTimezone = useBrowserTimezone();
  const timezone = browserTimezone === undefined ? detectedTimezone : browserTimezone;
  const businessTypeLabelId = React.useId();
  const isOther = countryCode === OTHER_COUNTRY_CODE;
  const isSubmitted = formState.isSubmitted;

  // Suggest a country once the browser's guess is known, only into an empty field.
  React.useEffect(() => {
    if (!autoDetectCountry || !guessedCountry) return;
    if (getValues("countryCode")) return;
    setValue("countryCode", guessedCountry, { shouldDirty: false, shouldValidate: isSubmitted });
  }, [autoDetectCountry, guessedCountry, countryCode, getValues, setValue, isSubmitted]);

  // "Other country" always carries a currency, so what the picker shows is what gets saved.
  React.useEffect(() => {
    if (isOther && !currency) {
      setValue("currency", OTHER_COUNTRY_DEFAULT_CURRENCY, { shouldDirty: false });
    }
  }, [isOther, currency, setValue]);

  const optional = (
    <span className="text-muted-foreground font-normal">{t("storeEssentials.optionalSuffix")}</span>
  );

  return (
    <div className={className ?? "space-y-1"}>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {nameLabel ?? t("storeEssentials.name.label")}{" "}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder={namePlaceholder ?? t("storeEssentials.name.placeholder")}
                autoFocus={autoFocusName}
                autoComplete="organization"
                maxLength={STORE_NAME_MAX_LENGTH}
                aria-required
                disabled={disabled}
                className="h-11"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="countryCode"
        render={({ field }) => (
          <FormItem className="min-w-0">
            <FormLabel>
              {t("storeEssentials.country.label")}{" "}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </FormLabel>
            <FormControl>
              <CountrySelect
                ref={field.ref}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                disabled={disabled}
                onChange={(next) => {
                  field.onChange(next);
                  // A listed country implies its own currency; drop an "Other" pick.
                  if (next !== OTHER_COUNTRY_CODE && getValues("currency")) {
                    setValue("currency", undefined, { shouldDirty: true });
                  }
                }}
              />
            </FormControl>
            <FormDescription className="min-h-0 text-xs">
              {t("storeEssentials.country.hint")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

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
                disabled={disabled}
                className="h-11"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {showBusinessType ? (
        <FormField
          control={control}
          name="businessType"
          render={({ field }) => (
            <FormItem>
              <FormLabel id={businessTypeLabelId}>
                {t("storeEssentials.businessType.label")} {optional}
              </FormLabel>
              <FormControl>
                <BusinessTypePicker
                  aria-labelledby={businessTypeLabelId}
                  value={field.value}
                  // null, not undefined, for a cleared chip: useController shows
                  // the mount-time value again when a field becomes undefined.
                  onChange={(next) => field.onChange(next ?? null)}
                  onBlur={field.onBlur}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {showMarketSummary && countryCode ? (
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
                  browserTimezone={timezone}
                  currencySelectProps={{
                    ref: field.ref,
                    name: field.name,
                    onBlur: field.onBlur,
                    disabled,
                    "aria-invalid": fieldState.invalid,
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <MarketSummary countryCode={countryCode} browserTimezone={timezone} />
        )
      ) : null}
    </div>
  );
}
