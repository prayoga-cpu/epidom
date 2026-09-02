import { describe, it, expect } from "vitest";
import { en, getLocaleMessages, isLocaleLoaded, loadLocale, type Lang } from "../index";
import { en as enDirect } from "../en";
import { fr as frDirect } from "../fr";
import { id as idDirect } from "../id";

/**
 * Guards the code-splitting of the locale dictionaries. The whole point of
 * that change was to stop shipping 687KB of translations to every visitor —
 * it is only safe if NOTHING was lost on the way. These tests assert exactly
 * that: the lazily loaded dictionaries are byte-for-byte the same objects the
 * old static barrel exported.
 */

/** Every dotted key path in a dictionary, so two dictionaries can be compared. */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe("locale registry", () => {
  it("has English resident synchronously, with no loading step", () => {
    // t()'s missing-key fallback and every SSR first paint depend on this.
    expect(isLocaleLoaded("en")).toBe(true);
    expect(getLocaleMessages("en")).toBe(enDirect);
    expect(en).toBe(enDirect);
  });

  it("loads fr and id on demand, yielding the identical dictionary", async () => {
    await loadLocale("fr");
    await loadLocale("id");
    expect(getLocaleMessages("fr")).toEqual(frDirect);
    expect(getLocaleMessages("id")).toEqual(idDirect);
  });

  it("loses not one key of any language", async () => {
    await Promise.all([loadLocale("fr"), loadLocale("id")]);
    for (const [locale, direct] of [
      ["en", enDirect],
      ["fr", frDirect],
      ["id", idDirect],
    ] as const) {
      const loaded = keyPaths(getLocaleMessages(locale as Lang)).sort();
      expect(loaded).toEqual(keyPaths(direct).sort());
      expect(loaded.length).toBeGreaterThan(1000);
    }
  });

  it("shares one in-flight request rather than fetching a locale twice", async () => {
    const a = loadLocale("fr");
    const b = loadLocale("fr");
    expect(await a).toBe(await b);
  });

  it("resolves immediately for an already-resident locale", async () => {
    await loadLocale("fr");
    expect(await loadLocale("fr")).toBe(getLocaleMessages("fr"));
  });
});
