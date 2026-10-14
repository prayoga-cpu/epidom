import { LOCALE_PREF_COOKIE } from "@/lib/i18n-routing";

/** The site's languages, in the order every language picker offers them. */
export const LANGUAGE_OPTIONS = [
  { label: "Français", value: "fr", short: "FR", flag: "🇫🇷" },
  { label: "Indonesia", value: "id", short: "ID", flag: "🇮🇩" },
  { label: "English", value: "en", short: "EN", flag: "🇺🇸" },
] as const;

/**
 * Remembers a language picked on the marketing site in a real HTTP cookie
 * (not the localStorage preference setLocale writes), so the Edge proxy honors
 * it on every later unprefixed visit — see src/lib/i18n-routing.ts.
 */
export function rememberLocaleChoice(value: (typeof LANGUAGE_OPTIONS)[number]["value"]) {
  try {
    document.cookie = `${LOCALE_PREF_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
  } catch {}
}
