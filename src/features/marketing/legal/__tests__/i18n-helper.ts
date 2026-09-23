import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

export type TestLocale = "en" | "fr" | "id";

export const DICTIONARIES: Record<TestLocale, unknown> = { en, fr, id };

function lookup(dict: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined;
  }, dict);
}

/**
 * A `t()` that reads the real dictionaries. `strict` skips the English fallback
 * the production provider applies, so a key missing from fr or id shows up in
 * the DOM as `MISSING(<key>)` instead of quietly rendering English.
 */
export function makeT(locale: TestLocale, strict = false) {
  return (key: string): string => {
    let value = lookup(DICTIONARIES[locale], key);
    if (value === undefined && !strict && locale !== "en") value = lookup(en, key);
    if (typeof value === "string" || typeof value === "number") return String(value);
    return strict ? `MISSING(${key})` : key;
  };
}
