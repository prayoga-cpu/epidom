import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

/**
 * Locale hygiene for the "soft pages" namespaces (partners, careers, press
 * and the public changelog chrome). t() silently falls back to English
 * when a key is missing, so an omission in fr or id never fails loudly — this is
 * the loud version.
 */
const NAMESPACES = ["partners", "careers", "press", "changelogPage"] as const;

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? ([[`${prefix}${key}`, value]] as Array<[string, string]>)
      : leaves(value, `${prefix}${key}.`)
  );
}

const dictionaries = {
  en: en as unknown as Tree,
  fr: fr as unknown as Tree,
  id: id as unknown as Tree,
};

describe.each(NAMESPACES)("locale namespace %s", (namespace) => {
  const byLocale = {
    en: leaves(dictionaries.en[namespace] as Tree),
    fr: leaves(dictionaries.fr[namespace] as Tree),
    id: leaves(dictionaries.id[namespace] as Tree),
  };

  it("has the same keys in en, fr and id", () => {
    const keys = (l: Array<[string, string]>) => l.map(([k]) => k).sort();
    expect(byLocale.en.length).toBeGreaterThan(0);
    expect(keys(byLocale.fr)).toEqual(keys(byLocale.en));
    expect(keys(byLocale.id)).toEqual(keys(byLocale.en));
  });

  it("has no empty string in any locale", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      for (const [key, value] of byLocale[locale]) {
        expect(value.trim(), `${locale}.${namespace}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps the {emails} placeholder in every locale or none", () => {
    const enMap = new Map(byLocale.en);
    for (const locale of ["fr", "id"] as const) {
      for (const [key, value] of byLocale[locale]) {
        expect(value.includes("{emails}"), `${locale}.${namespace}.${key}`).toBe(
          enMap.get(key)!.includes("{emails}")
        );
      }
    }
  });

  it("never types a mail address: the support inbox comes from contact.ts only", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      for (const [key, value] of byLocale[locale]) {
        expect(value, `${locale}.${namespace}.${key}`).not.toMatch(/@|prionation\.io/i);
      }
    }
  });

  it("uses a non-breaking space before French : ; ? ! (no plain space)", () => {
    for (const [key, value] of byLocale.fr) {
      expect(value, `fr.${namespace}.${key}`).not.toMatch(/ [:;?!]/);
    }
  });

  it("addresses the Indonesian reader as Anda, never the casual kamu / -mu", () => {
    // The pricing dialog, FAQ, legal pages and these pages' own metadata all use
    // "Anda"; a stray "kamu" on a B2B page reads as a different voice. The
    // negative lookahead skips real words that merely end in "mu".
    const INFORMAL_YOU =
      /\b(?:kamu|kalian)\b|\b(?!(?:tamu|ilmu|bertemu|ketemu|bersemu)\b)[a-z]{2,}mu\b/i;
    for (const [key, value] of byLocale.id) {
      expect(value, `id.${namespace}.${key}`).not.toMatch(INFORMAL_YOU);
    }
  });

  it("spells English the American way (the English locale is American)", () => {
    const BRITISH =
      /programme|organis|colour|behaviour|centre|licence|catalogue|favour|recognis|personalis|customis|optimis|whilst|analyse/i;
    for (const [key, value] of byLocale.en) {
      expect(value, `en.${namespace}.${key}`).not.toMatch(BRITISH);
    }
  });

  it("is really translated: no French or Indonesian string is a copy of the English one", () => {
    const enMap = new Map(byLocale.en);
    // Words that are genuinely identical in the target language.
    const SAME_AS_ENGLISH = new Set([
      "fr.changelogPage.tagInfra",
      "id.changelogPage.tagInfra",
      "fr.changelogPage.tagUx",
      "id.changelogPage.tagUx",
      "id.partners.integrations.xendit", // brand names and "(Indonesia)"
    ]);
    for (const locale of ["fr", "id"] as const) {
      for (const [key, value] of byLocale[locale]) {
        const path = `${locale}.${namespace}.${key}`;
        if (SAME_AS_ENGLISH.has(path)) continue;
        expect(value, path).not.toBe(enMap.get(key));
      }
    }
  });
});

describe("about.teamBody", () => {
  it("does not calque 'F&B ownership' in Indonesian (kepemilikan F&B)", () => {
    expect(id.about.teamBody).not.toMatch(/kepemilikan/i);
    expect(id.about.teamBody).toMatch(/menjalankan bisnis F&B/);
  });
});

describe("soft pages source files", () => {
  const files = [
    "src/app/(marketing)/partners/client.tsx",
    "src/app/(marketing)/partners/supplier-application.tsx",
    "src/app/(marketing)/careers/client.tsx",
    "src/app/(marketing)/press/client.tsx",
    "src/features/marketing/changelog/changelog-view.tsx",
  ];

  it.each(files)("%s does not hardcode a support address", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/prionation\.io/);
  });
});
