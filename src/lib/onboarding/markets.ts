import type { PaymentMarket } from "@prisma/client";
import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Where a store operates decides almost everything a new owner would
 * otherwise have to configure by hand: the currency its prices are in, the
 * payment market (payment methods, delivery platforms, fee defaults), the
 * business timezone (attendance, reports, shifts) and the language of
 * customer-facing messages. The setup wizard and the Create a store dialog ask
 * for the country once and derive the rest from this table.
 *
 * Order matters: the primary markets first (France, then Indonesia), then the
 * rest alphabetically by English name. `OTHER_COUNTRY_CODE` is the escape
 * hatch for a country not listed — it falls back to INTERNATIONAL and lets the
 * owner pick the currency.
 *
 * `name` is the English name, and is what gets stored in the free-text
 * `Business.country` / `Store.country` columns (matching the values already
 * there). Show a localized name with `countryDisplayName()` instead.
 */
export interface CountryDefinition {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** English name, stored in Business.country / Store.country. */
  name: string;
  currency: string;
  market: PaymentMarket;
  /** IANA zones used in this country; the first is the default. */
  timezones: string[];
  /** Language for customer-facing messages, when Epidom speaks it. */
  locale: Locale | null;
}

export const OTHER_COUNTRY_CODE = "ZZ";

export const COUNTRIES: CountryDefinition[] = [
  {
    code: "FR",
    name: "France",
    currency: "EUR",
    market: "FRANCE",
    timezones: [
      "Europe/Paris",
      "Indian/Reunion",
      "America/Guadeloupe",
      "America/Martinique",
      "America/Cayenne",
      "Indian/Mayotte",
      // Not French Polynesia or New Caledonia: they price in the CFP franc
      // (XPF), not EUR, so they have their own entries below.
    ],
    locale: "fr",
  },
  {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    market: "INDONESIA",
    timezones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Pontianak"],
    locale: "id",
  },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    market: "INTERNATIONAL",
    timezones: [
      "Australia/Sydney",
      "Australia/Melbourne",
      "Australia/Brisbane",
      "Australia/Adelaide",
      "Australia/Perth",
      "Australia/Hobart",
      "Australia/Darwin",
    ],
    locale: "en",
  },
  {
    code: "BE",
    name: "Belgium",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Brussels"],
    locale: "fr",
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    market: "INTERNATIONAL",
    timezones: [
      "America/Toronto",
      "America/Montreal",
      "America/Vancouver",
      "America/Edmonton",
      "America/Winnipeg",
      "America/Halifax",
      "America/St_Johns",
      "America/Regina",
    ],
    locale: "en",
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    currency: "XOF",
    market: "INTERNATIONAL",
    timezones: ["Africa/Abidjan"],
    locale: "fr",
  },
  {
    code: "PF",
    name: "French Polynesia",
    currency: "XPF",
    market: "INTERNATIONAL",
    timezones: ["Pacific/Tahiti", "Pacific/Marquesas", "Pacific/Gambier"],
    locale: "fr",
  },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Berlin"],
    locale: "en",
  },
  {
    code: "IE",
    name: "Ireland",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Dublin"],
    locale: "en",
  },
  {
    code: "IT",
    name: "Italy",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Rome"],
    locale: "en",
  },
  {
    code: "LU",
    name: "Luxembourg",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Luxembourg"],
    locale: "fr",
  },
  {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    market: "INTERNATIONAL",
    timezones: ["Asia/Kuala_Lumpur", "Asia/Kuching"],
    locale: "en",
  },
  {
    code: "MC",
    name: "Monaco",
    currency: "EUR",
    market: "FRANCE",
    timezones: ["Europe/Monaco"],
    locale: "fr",
  },
  {
    code: "MA",
    name: "Morocco",
    currency: "MAD",
    market: "INTERNATIONAL",
    timezones: ["Africa/Casablanca"],
    locale: "fr",
  },
  {
    code: "NL",
    name: "Netherlands",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Amsterdam"],
    locale: "en",
  },
  {
    code: "NC",
    name: "New Caledonia",
    currency: "XPF",
    market: "INTERNATIONAL",
    timezones: ["Pacific/Noumea"],
    locale: "fr",
  },
  {
    code: "PT",
    name: "Portugal",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"],
    locale: "en",
  },
  {
    code: "SN",
    name: "Senegal",
    currency: "XOF",
    market: "INTERNATIONAL",
    timezones: ["Africa/Dakar"],
    locale: "fr",
  },
  {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    market: "INTERNATIONAL",
    timezones: ["Asia/Singapore"],
    locale: "en",
  },
  {
    code: "ES",
    name: "Spain",
    currency: "EUR",
    market: "INTERNATIONAL",
    timezones: ["Europe/Madrid", "Atlantic/Canary"],
    locale: "en",
  },
  {
    code: "CH",
    name: "Switzerland",
    currency: "CHF",
    market: "INTERNATIONAL",
    timezones: ["Europe/Zurich"],
    locale: "fr",
  },
  {
    code: "TN",
    name: "Tunisia",
    currency: "TND",
    market: "INTERNATIONAL",
    timezones: ["Africa/Tunis"],
    locale: "fr",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    market: "INTERNATIONAL",
    timezones: ["Asia/Dubai"],
    locale: "en",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    market: "INTERNATIONAL",
    timezones: ["Europe/London"],
    locale: "en",
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    market: "INTERNATIONAL",
    timezones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Phoenix",
      "America/Anchorage",
      "Pacific/Honolulu",
    ],
    locale: "en",
  },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Country codes the wizard and the Create a store dialog accept, including "Other". */
export const COUNTRY_CODES: string[] = [...COUNTRIES.map((c) => c.code), OTHER_COUNTRY_CODE];

export function getCountry(code: string | null | undefined): CountryDefinition | undefined {
  return code ? COUNTRY_BY_CODE.get(code.toUpperCase()) : undefined;
}

/** Currency when the owner picks "Other" and doesn't choose one. */
export const OTHER_COUNTRY_DEFAULT_CURRENCY = "USD";

export interface MarketDefaults {
  countryCode: string;
  /** English country name to store, or null for "Other". */
  countryName: string | null;
  currency: string;
  market: PaymentMarket;
  timezone: string;
  locale: Locale;
}

/**
 * Everything derived from the country. `browserTimezone` wins when it is one
 * of the country's zones (an owner in Bali gets Asia/Makassar, not Jakarta);
 * otherwise the country's main zone is used. For "Other" the browser zone is
 * used as-is when valid, and `currency` picks the currency.
 */
export function resolveMarketDefaults(input: {
  countryCode: string;
  browserTimezone?: string | null;
  /** Only used for "Other": the currency the owner chose. */
  currency?: string | null;
  /** The owner's current UI language, used when Epidom doesn't speak the country's. */
  uiLocale?: Locale | null;
}): MarketDefaults {
  const country = getCountry(input.countryCode);
  const uiLocale: Locale = input.uiLocale ?? "en";
  const browserTimezone = isValidTimezone(input.browserTimezone) ? input.browserTimezone : null;

  if (!country) {
    return {
      countryCode: OTHER_COUNTRY_CODE,
      countryName: null,
      currency: input.currency?.toUpperCase() || OTHER_COUNTRY_DEFAULT_CURRENCY,
      market: "INTERNATIONAL",
      timezone: browserTimezone ?? "UTC",
      locale: uiLocale,
    };
  }

  const timezone =
    browserTimezone && country.timezones.includes(browserTimezone)
      ? browserTimezone
      : country.timezones[0];

  return {
    countryCode: country.code,
    countryName: country.name,
    currency: country.currency,
    market: country.market,
    timezone,
    locale: country.locale ?? uiLocale,
  };
}

/**
 * Best first guess for the country picker, before the owner touches it: the
 * country whose zones include the browser's timezone, else the country of the
 * UI language's primary market (fr → France, id → Indonesia), else "Other".
 */
export function guessCountryCode(input: {
  browserTimezone?: string | null;
  uiLocale?: Locale | null;
}): string {
  const tz = input.browserTimezone;
  if (tz) {
    const byZone = COUNTRIES.find((c) => c.timezones.includes(tz));
    if (byZone) return byZone.code;
  }
  if (input.uiLocale === "fr") return "FR";
  if (input.uiLocale === "id") return "ID";
  return OTHER_COUNTRY_CODE;
}

/**
 * Maps a free-text country already stored on a Business or Store ("France",
 * "indonesia", "Indonésie", "FR") back to a code, for pre-filling the picker.
 * Unknown text returns undefined; callers keep the original text in that case
 * rather than overwriting it.
 */
export function countryCodeFromName(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeCountryText(value);
  if (!normalized) return undefined;
  const direct = getCountry(normalized.toUpperCase());
  if (direct && normalized.length === 2) return direct.code;
  const byName = COUNTRIES.find((c) => normalizeCountryText(c.name) === normalized);
  if (byName) return byName.code;
  return COUNTRY_ALIASES[normalized];
}

/** French and Indonesian spellings owners have typed into the old free-text field. */
const COUNTRY_ALIASES: Record<string, string> = {
  indonesie: "ID",
  "republik indonesia": "ID",
  prancis: "FR",
  belgique: "BE",
  suisse: "CH",
  allemagne: "DE",
  espagne: "ES",
  italie: "IT",
  "royaume-uni": "GB",
  "royaume uni": "GB",
  uk: "GB",
  "etats-unis": "US",
  "etats unis": "US",
  usa: "US",
  "amerika serikat": "US",
  maroc: "MA",
  tunisie: "TN",
  senegal: "SN",
  "cote d'ivoire": "CI",
  "cote divoire": "CI",
  singapura: "SG",
  "pays-bas": "NL",
  "pays bas": "NL",
  belanda: "NL",
  inggris: "GB",
  australie: "AU",
};

function normalizeCountryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’]/g, "'")
    .trim()
    .toLowerCase();
}

/** Localized country name via Intl ("Indonésie" in French), falling back to the English name. */
export function countryDisplayName(code: string, locale: Locale): string {
  const country = getCountry(code);
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase());
    if (name && name !== code.toUpperCase()) return name;
  } catch {
    // Intl.DisplayNames unavailable or invalid code: fall through.
  }
  return country?.name ?? code;
}

/** Flag emoji from a two-letter code (regional indicator symbols); empty for "Other". */
export function countryFlag(code: string): string {
  if (code === OTHER_COUNTRY_CODE || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  );
}

export function isValidTimezone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The kind of place, asked on the wizard's first step. Stored on
 * Business.businessType; used for copy (menu placeholders) and segmentation,
 * never to gate anything.
 */
export const BUSINESS_TYPES = [
  "cafe",
  "restaurant",
  "bakery",
  "bar",
  "fastFood",
  "foodTruck",
  "homeKitchen",
  "catering",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

/**
 * Example prices for the wizard's menu placeholders, in the store's currency
 * — placeholders only, never saved as values. Zero-decimal currencies get
 * round numbers of the right magnitude.
 */
export function examplePrices(currency: string): [number, number, number] {
  switch (currency.toUpperCase()) {
    case "IDR":
      return [25000, 18000, 8000];
    case "XOF":
      return [2500, 1500, 500];
    case "XPF":
      return [1100, 500, 350];
    case "MAD":
      return [45, 25, 15];
    case "TND":
      return [12, 6, 3];
    case "AED":
      return [28, 18, 12];
    case "MYR":
      return [18, 9, 5];
    case "SGD":
    case "AUD":
    case "CAD":
      return [12, 6, 4];
    case "CHF":
      return [16, 6, 4];
    default:
      // EUR, USD, GBP and anything else priced in units of ~1.
      return [9.5, 4.5, 3];
  }
}
