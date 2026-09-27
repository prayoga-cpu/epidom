"use client";

import * as React from "react";
import { useI18n } from "@/components/lang/i18n-provider";
// The store essentials' searchable picker: its modal popover scrolls inside a
// Dialog on touch devices, which the shared <Combobox> can't.
import { SearchSelect } from "@/features/stores/shared/search-select";
import { buildTimezoneOptions } from "../lib/timezone-options";

export interface BusinessTimezoneSelectProps {
  /** IANA zone ("Europe/Paris"); empty shows the placeholder. */
  value?: string | null;
  onChange: (timezone: string) => void;
  /** Listed first (e.g. the business country's zones). */
  suggested?: readonly string[];
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

/**
 * Searchable picker over every IANA timezone the browser knows, labelled
 * "Europe/Paris (UTC+02:00)". Search matches the zone, its city and its
 * offset. Works inside a react-hook-form <FormControl> (forwards id, aria-*,
 * onBlur and ref to the trigger).
 */
export function BusinessTimezoneSelect({
  value,
  onChange,
  suggested,
  ...rest
}: BusinessTimezoneSelectProps) {
  const { t } = useI18n();
  const suggestedKey = (suggested ?? []).join("|");
  // ~400 zones, each with its offset: built once per suggestion list, not per pick.
  const baseOptions = React.useMemo(
    () => buildTimezoneOptions({ suggested: suggestedKey ? suggestedKey.split("|") : [] }),
    [suggestedKey]
  );
  // A saved zone the runtime's list lacks (an old alias) still shows as selected.
  const options = React.useMemo(
    () =>
      value && !baseOptions.some((option) => option.value === value)
        ? [...buildTimezoneOptions({ zones: [value] }), ...baseOptions]
        : baseOptions,
    [baseOptions, value]
  );

  return (
    <SearchSelect
      {...rest}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("profile.business.timezonePlaceholder")}
      searchPlaceholder={t("profile.business.timezoneSearchPlaceholder")}
      emptyText={t("profile.business.timezoneEmpty")}
    />
  );
}
