import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fr } from "../fr";
import { id } from "../id";
import { th } from "../th";

/**
 * Every language has every key. `t()` falls back to English for a missing key
 * without a word, so before this test a language could fall hundreds of strings
 * behind unnoticed (French was 380 short in November 2026). A key added to one
 * dictionary must be added to all four, with the same {placeholders}: a
 * translation that drops one shows a sentence with a hole in it.
 *
 * Thai has stricter checks of its own in th-parity.test.ts.
 */

type Leaves = Map<string, string>;

function leaves(node: unknown, path = "", out: Leaves = new Map()): Leaves {
  if (typeof node === "string") out.set(path, node);
  else if (typeof node === "function") out.set(path, "__function__");
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leaves(value, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

const DICTIONARIES = { en: leaves(en), fr: leaves(fr), id: leaves(id), th: leaves(th) };
const LANGUAGES = Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[];
const UNION = new Set(LANGUAGES.flatMap((l) => [...DICTIONARIES[l].keys()]));

/** The distinct placeholders of a string; a language may repeat or reorder them. */
const placeholders = (s: string) =>
  [...new Set(s.match(/\$\{[^}]*\}|\{\{[^}]*\}\}|\{[A-Za-z0-9_.]+\}/g) ?? [])].sort().join(" ");

describe("dictionary parity across en, fr, id and th", () => {
  it.each(LANGUAGES)("%s has every key the other languages have", (language) => {
    const missing = [...UNION].filter((key) => !DICTIONARIES[language].has(key));
    expect(missing, `${language} is missing ${missing.length} key(s)`).toEqual([]);
  });

  it.each(LANGUAGES.filter((l) => l !== "en"))(
    "%s keeps the placeholders of the English string",
    (language) => {
      const differing: string[] = [];
      for (const [key, english] of DICTIONARIES.en) {
        const translated = DICTIONARIES[language].get(key);
        if (translated === undefined || english === "__function__") continue;
        if (placeholders(english) !== placeholders(translated)) differing.push(key);
      }
      expect(differing).toEqual([]);
    }
  );

  it.each(LANGUAGES)("%s has no empty namespace turned into a string (or the reverse)", (language) => {
    // A key that is a leaf in one language and a namespace in another would make
    // `t("a.b")` return an object in one of them and print the raw key.
    const paths = [...DICTIONARIES[language].keys()];
    const prefixes = new Set(paths.flatMap((p) => p.split(".").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("."))));
    const clash = [...UNION].filter((key) => prefixes.has(key));
    expect(clash).toEqual([]);
  });
});
