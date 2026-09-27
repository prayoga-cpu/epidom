import { describe, it, expect } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { SETUP_ITEM_IDS, SETUP_SECTIONS } from "@/lib/guide/contracts";

type Tree = { [key: string]: string | Tree };

/** Every leaf path under `node`, e.g. "tour.skip". */
function leafPaths(node: Tree, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leafPaths(value, `${prefix}${key}.`)
  );
}

function leaf(node: Tree, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object" ? (current as Tree)[part] : undefined,
      node
    );
}

const locales = { en, fr, id } as unknown as Record<"en" | "fr" | "id", { setupGuide: Tree }>;

describe("setupGuide locale namespace", () => {
  const enPaths = leafPaths(locales.en.setupGuide).sort();

  it.each(["fr", "id"] as const)("%s has exactly the English keys", (lang) => {
    expect(leafPaths(locales[lang].setupGuide).sort()).toEqual(enPaths);
  });

  it.each(["en", "fr", "id"] as const)("%s has no empty strings", (lang) => {
    for (const path of enPaths) {
      const value = leaf(locales[lang].setupGuide, path);
      expect(typeof value === "string" && value.trim().length > 0, `${lang}: ${path}`).toBe(true);
    }
  });

  it.each(["en", "fr", "id"] as const)("%s keeps every {placeholder}", (lang) => {
    for (const path of enPaths) {
      const placeholders = (text: unknown) =>
        String(text)
          .match(/\{[a-z]+\}/gi)
          ?.sort() ?? [];
      expect(placeholders(leaf(locales[lang].setupGuide, path)), `${lang}: ${path}`).toEqual(
        placeholders(leaf(locales.en.setupGuide, path))
      );
    }
  });

  // The tour also opens where no checklist is shown (an established store, a
  // hidden checklist, a staff persona replaying it), so its last card mustn't
  // point at one.
  it.each([
    ["en", /checklist/i],
    ["fr", /liste/i],
    ["id", /daftar/i],
  ] as const)("%s: the tour's last card never promises the setup checklist", (lang, word) => {
    expect(leaf(locales[lang].setupGuide, "tour.backOffice.footer")).not.toMatch(word);
  });

  // No plural rules in the i18n layer: "Show {count} done" must read right at 1.
  it("fr: 'Show N done' reads correctly for one finished step", () => {
    const one = String(leaf(locales.fr.setupGuide, "checklist.showDone")).replace("{count}", "1");
    expect(one).not.toMatch(/\bles 1\b/);
    expect(one).toBe("Afficher les étapes terminées (1)");
  });

  it("covers every checklist item and section the server can send", () => {
    for (const itemId of SETUP_ITEM_IDS) {
      for (const field of ["title", "why", "action"]) {
        expect(enPaths).toContain(`checklist.items.${itemId}.${field}`);
      }
    }
    for (const section of SETUP_SECTIONS) {
      expect(enPaths).toContain(`checklist.sections.${section}`);
    }
    for (const section of SETUP_SECTIONS.filter((s) => s !== "storefront")) {
      expect(enPaths).toContain(`checklist.upsell.${section}.body`);
      expect(enPaths).toContain(`checklist.upsell.${section}.cta`);
    }
  });
});
