import { describe, expect, it } from "vitest";
import { DICTS, translatorFor } from "@/features/stores/shared/__tests__/helpers";

/** Every leaf key under `path` in a dictionary, as dotted paths. */
function leafKeys(node: unknown, prefix: string): string[] {
  if (typeof node === "string") return [prefix];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, `${prefix}.${key}`)
  );
}

function subtree(locale: keyof typeof DICTS, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      DICTS[locale]
    );
}

// The copy the Create/Edit store dialogs, the /stores empty state and the
// Profile business timezone read.
const KEYS = [
  "stores.activateFreePlan",
  "stores.createSubtitleFirst",
  "stores.createSubtitleAnother",
  ...leafKeys(subtree("en", "stores.form"), "stores.form"),
  "storeEssentials.marketSummary.changeLater",
  "storeEssentials.marketSummary.changeTimezoneLater",
  "profile.business.timezone",
  "profile.business.timezoneHint",
  "profile.business.timezonePlaceholder",
  "profile.business.timezoneSearchPlaceholder",
  "profile.business.timezoneEmpty",
  "profile.business.countryLegacy",
  "profile.business.otherCountryName",
  "profile.business.otherCountryNamePlaceholder",
];

describe("stores / profile timezone copy", () => {
  it("covers the stores.form keys", () => {
    expect(KEYS).toContain("stores.form.copySettings");
    expect(KEYS).toContain("stores.form.validation.emailInvalid");
    expect(KEYS).toContain("stores.form.validation.otherCountryNameRequired");
    expect(KEYS).toContain("stores.form.copyCurrencyMismatch");
  });

  it.each(["en", "fr", "id"] as const)("every key has a %s string", (locale) => {
    const t = translatorFor(locale);
    for (const key of KEYS) {
      const value = t(key);
      expect(value, `${locale}: ${key}`).not.toBe(key);
      expect(value.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
    }
  });

  it.each(["fr", "id"] as const)("%s keeps every placeholder the English copy has", (locale) => {
    const en = translatorFor("en");
    const t = translatorFor(locale);
    for (const key of KEYS) {
      const placeholders = en(key).match(/\{\w+\}/g) ?? [];
      for (const placeholder of placeholders) {
        expect(t(key), `${locale}: ${key}`).toContain(placeholder);
      }
    }
  });

  it("French and Indonesian are actually translated, not English copies", () => {
    const en = translatorFor("en");
    for (const locale of ["fr", "id"] as const) {
      const t = translatorFor(locale);
      const untranslated = KEYS.filter((key) => t(key) === en(key));
      expect(untranslated, locale).toEqual([]);
    }
  });
});
