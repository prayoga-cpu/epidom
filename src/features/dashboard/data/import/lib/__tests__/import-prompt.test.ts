import { describe, expect, it } from "vitest";
import {
  ENTITY_UNIQUE_FIELDS,
  MaterialFields,
  ProductFields,
  RecipeFields,
  SupplierFields,
} from "@/lib/ai/import-schema";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import {
  buildImportPrompt,
  IMPORT_PROMPT_COLUMNS,
  IMPORT_PROMPT_FILE,
  IMPORT_PROMPT_TYPES,
} from "../import-prompt";

/** The provider's lookup, minus React: a dot path into the locale, the key itself when missing. */
const translator = (locale: unknown) => (key: string) => {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);
  return typeof value === "string" ? value : key;
};

const SCHEMA_FIELDS = {
  product: ProductFields.options,
  material: MaterialFields.options,
  supplier: SupplierFields.options,
  recipe: RecipeFields.options,
} as const;

describe("import prompt columns", () => {
  it.each(IMPORT_PROMPT_TYPES)("%s: every column is a field the importer knows", (type) => {
    const known: readonly string[] = SCHEMA_FIELDS[type];
    for (const column of IMPORT_PROMPT_COLUMNS[type]) expect(known).toContain(column);
    expect(IMPORT_PROMPT_COLUMNS[type][0]).toBe("name");
  });

  // Smart Import decides what a sheet is from its headers. A prompt whose
  // header carried no type-specific column would import a menu as suppliers.
  it.each(IMPORT_PROMPT_TYPES)("%s: the header identifies the record type", (type) => {
    const unique: readonly string[] = ENTITY_UNIQUE_FIELDS[type];
    expect(IMPORT_PROMPT_COLUMNS[type].some((column) => unique.includes(column))).toBe(true);
  });

  it("no header carries another type's identifying column ahead of its own", () => {
    // Detection order is recipe > material > product > supplier.
    const has = (type: keyof typeof IMPORT_PROMPT_COLUMNS, of: keyof typeof ENTITY_UNIQUE_FIELDS) =>
      IMPORT_PROMPT_COLUMNS[type].some((c) =>
        (ENTITY_UNIQUE_FIELDS[of] as readonly string[]).includes(c)
      );
    expect(has("material", "recipe")).toBe(false);
    expect(has("product", "recipe")).toBe(false);
    expect(has("product", "material")).toBe(false);
    expect(has("supplier", "recipe")).toBe(false);
    expect(has("supplier", "material")).toBe(false);
    expect(has("supplier", "product")).toBe(false);
  });
});

describe.each([
  ["en", en],
  ["id", id],
  ["fr", fr],
])("buildImportPrompt (%s)", (_name, locale) => {
  const t = translator(locale);

  it.each(IMPORT_PROMPT_TYPES)(
    "%s: complete, with the English header and the file name",
    (type) => {
      const prompt = buildImportPrompt(type, t);

      // A missing translation would leave its key path in the text.
      expect(prompt).not.toContain("import.aiPrompt");
      expect(prompt).not.toContain("{file}");
      expect(prompt.split("\n")).toContain(IMPORT_PROMPT_COLUMNS[type].join(","));
      expect(prompt).toContain(IMPORT_PROMPT_FILE[type]);
    }
  );

  it("a recipe is one row per ingredient, never 'one row per item'", () => {
    const perItem = t("import.aiPrompt.rules.rows");
    expect(buildImportPrompt("recipe", t)).not.toContain(perItem);
    expect(buildImportPrompt("recipe", t)).toContain(t("import.aiPrompt.recipe.rows"));
    expect(buildImportPrompt("product", t)).toContain(perItem);
  });
});
