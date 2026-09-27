/**
 * Store essentials UI shared by the setup wizard's first step (/onboarding) and
 * the Your Stores Create/Edit store dialogs: name, country (which drives the
 * currency, payment market, timezone…), city and business type.
 */
export { CountrySelect, buildCountryOptions, type CountrySelectProps } from "./country-select";
export {
  BusinessTypePicker,
  BUSINESS_TYPE_ICONS,
  type BusinessTypePickerProps,
} from "./business-type-picker";
export { MarketSummary, buildCurrencyOptions, type MarketSummaryProps } from "./market-summary";
export { StoreEssentialsFields, type StoreEssentialsFieldsProps } from "./store-essentials-fields";
export {
  useDefaultCountryCode,
  useBrowserTimezone,
  getBrowserTimezone,
} from "./use-default-country-code";
export {
  storeEssentialsSchema,
  createStoreEssentialsSchema,
  storeEssentialsDefaultValues,
  storeEssentialsPayload,
  STORE_NAME_MIN_LENGTH,
  STORE_NAME_MAX_LENGTH,
  STORE_CITY_MAX_LENGTH,
  type StoreEssentialsValues,
  type StoreEssentialsInput,
} from "./schema";
