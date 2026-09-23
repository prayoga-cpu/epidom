import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Copy that belongs to a data file (a customer quote, a job title) rather than
 * to the locale dictionaries. A plain string is shown as written in every
 * locale; a per-locale map lets the operator supply real translations.
 */
export type LocalizedText = string | Partial<Record<Locale, string>>;

const FALLBACK_ORDER: readonly Locale[] = ["fr", "en", "id"];

/** The text for `locale`, else the first available in fr, en, id order, else "". */
export function resolveLocalizedText(text: LocalizedText, locale: Locale): string {
  if (typeof text === "string") return text.trim();
  for (const l of [locale, ...FALLBACK_ORDER]) {
    const value = text[l]?.trim();
    if (value) return value;
  }
  return "";
}

/** True when the text resolves to something non-empty in at least one locale. */
export function hasLocalizedText(text: LocalizedText | undefined): boolean {
  if (text === undefined) return false;
  return resolveLocalizedText(text, "fr") !== "";
}
