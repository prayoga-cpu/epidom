"use client";

import * as React from "react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import {
  COUNTRIES,
  OTHER_COUNTRY_CODE,
  countryDisplayName,
  countryFlag,
  type CountryDefinition,
} from "@/lib/onboarding/markets";
import { SearchSelect, type SearchSelectOption } from "./search-select";

/** Countries listed first, in COUNTRIES order: the primary markets. */
const PRIMARY_COUNTRY_CODES = ["FR", "ID"];

export interface CountrySelectProps {
  /** ISO code from COUNTRY_CODES (OTHER_COUNTRY_CODE for "Other country"); empty shows the placeholder. */
  value?: string | null;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

/**
 * The picker's options in display order: France and Indonesia first, then every
 * other listed country sorted by its name in `locale`, then "Other country".
 * Each option searches by its localized name, its English name and its code.
 */
export function buildCountryOptions(locale: Locale, otherLabel: string): SearchSelectOption[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const toOption = (code: string, englishName: string, section: number): SearchSelectOption => ({
    value: code,
    label: countryDisplayName(code, locale),
    leading: countryFlag(code),
    keywords: [englishName, code],
    section,
  });

  const primary = PRIMARY_COUNTRY_CODES.map((code) => COUNTRIES.find((c) => c.code === code))
    .filter((country): country is CountryDefinition => country !== undefined)
    .map((country) => toOption(country.code, country.name, 0));
  const rest = COUNTRIES.filter((country) => !PRIMARY_COUNTRY_CODES.includes(country.code))
    .map((country) => toOption(country.code, country.name, 1))
    .sort((a, b) => collator.compare(a.label, b.label));

  return [
    ...primary,
    ...rest,
    {
      value: OTHER_COUNTRY_CODE,
      label: otherLabel,
      keywords: ["Other", "Other country"],
      section: 2,
      pinned: true,
    },
  ];
}

/**
 * Searchable country picker for the store essentials. Shows the flag and the
 * localized name; search is accent-insensitive and matches the localized or
 * English name ("indonesie", "Indonésie" and "Indonesia" all find ID). "Other
 * country" stays listed whatever the search.
 *
 * Works inside a react-hook-form <FormControl>: it forwards `id`,
 * `aria-invalid`, `aria-describedby`, `onBlur` and `ref` to the trigger.
 */
export function CountrySelect({ value, onChange, placeholder, ...rest }: CountrySelectProps) {
  const { t, locale } = useI18n();
  const otherLabel = t("storeEssentials.country.other");
  const options = React.useMemo(
    () => buildCountryOptions(locale, otherLabel),
    [locale, otherLabel]
  );

  return (
    <SearchSelect
      {...rest}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? t("storeEssentials.country.placeholder")}
      searchPlaceholder={t("storeEssentials.country.searchPlaceholder")}
      emptyText={t("storeEssentials.country.empty")}
    />
  );
}
