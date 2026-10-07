import { describe, expect, it } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

type Tree = { [key: string]: string | Tree };

/** Every leaf path under `node`, e.g. "chooser.import.cta". */
function leafPaths(node: Tree, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leafPaths(value, `${prefix}${key}.`)
  );
}

function leaf(node: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object" ? (current as Tree)[part] : undefined,
      node
    );
}

const locales = { en, fr, id } as unknown as Record<"en" | "fr" | "id", Tree>;

/** The Data page's first run, the POS's "needs a menu" notice and the till's empty menu. */
const NAMESPACES = ["import.setup", "pos.menuNotice"];
const EMPTY_MENU_KEYS = [
  "pos.menu.emptyMenuTitle",
  "pos.menu.emptyMenuBody",
  "pos.menu.emptyMenuAskBody",
  "pos.menu.emptyMenuCta",
];

const enPaths = [
  ...NAMESPACES.flatMap((ns) =>
    leafPaths(leaf(locales.en, ns) as Tree).map((path) => `${ns}.${path}`)
  ),
  ...EMPTY_MENU_KEYS,
].sort();

const placeholders = (text: unknown) => (String(text).match(/\{\w+\}/g) ?? []).sort();

describe("menu-first setup copy", () => {
  it.each(["fr", "id"] as const)("%s has exactly the English keys", (lang) => {
    const paths = NAMESPACES.flatMap((ns) =>
      leafPaths(leaf(locales[lang], ns) as Tree).map((path) => `${ns}.${path}`)
    );
    expect([...paths, ...EMPTY_MENU_KEYS].sort()).toEqual(enPaths);
  });

  it.each(["en", "fr", "id"] as const)(
    "%s: every string is there and keeps its {placeholders}",
    (lang) => {
      for (const path of enPaths) {
        const value = leaf(locales[lang], path);
        expect(typeof value === "string" && value.trim().length > 0, `${lang}: ${path}`).toBe(true);
        expect(placeholders(value), `${lang}: ${path}`).toEqual(
          placeholders(leaf(locales.en, path))
        );
      }
    }
  );

  it("French puts a no-break space before : ? ! ;", () => {
    for (const path of enPaths) {
      const value = String(leaf(locales.fr, path));
      expect(value, path).not.toMatch(/ [:?!;]/);
    }
  });
});
