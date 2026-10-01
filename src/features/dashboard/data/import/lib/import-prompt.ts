import type { EntityType } from "@/lib/ai/import/types";

/**
 * The prompt a merchant pastes into any AI assistant (ChatGPT, Claude,
 * Gemini…) together with a photo or PDF of their menu, price list or supplier
 * sheet, to get back a CSV that Smart Import reads without guessing.
 *
 * The column names are the importer's own target fields (see
 * src/lib/ai/import-schema.ts), so the file maps one to one and each row is
 * recognised as the right kind of record. import-prompt.test.ts fails if a
 * column here stops being a field the importer knows.
 */

/** Header row per record type. Order is the order of the CSV columns. */
export const IMPORT_PROMPT_COLUMNS: Record<EntityType, readonly string[]> = {
  product: ["name", "category", "description", "sellingPrice", "costPrice", "sku", "unit"],
  material: [
    "name",
    "category",
    "unit",
    "unitCost",
    "currentStock",
    "minStock",
    "supplierName",
    "sku",
  ],
  supplier: ["name", "contactPerson", "phone", "email", "address", "city", "country", "notes"],
  recipe: [
    "name",
    "category",
    "yieldQuantity",
    "yieldUnit",
    "ingredient_name",
    "ingredient_qty",
    "ingredient_unit",
    "instructions",
  ],
};

/** The file name the prompt asks the assistant to use. */
export const IMPORT_PROMPT_FILE: Record<EntityType, string> = {
  product: "epidom-products.csv",
  material: "epidom-materials.csv",
  supplier: "epidom-suppliers.csv",
  recipe: "epidom-recipes.csv",
};

/** Rules every record type shares, then the ones specific to each. */
const SHARED_RULES = ["rows", "names", "numbers", "empty", "quotes"] as const;
const TYPE_RULES: Record<EntityType, readonly string[]> = {
  product: ["category", "price", "description", "optional"],
  material: ["unit", "unitCost", "stock", "supplier"],
  supplier: ["contact", "notes"],
  recipe: ["rows", "yield", "ingredients", "instructions"],
};

export const IMPORT_PROMPT_TYPES: readonly EntityType[] = [
  "product",
  "material",
  "recipe",
  "supplier",
];

/**
 * Build the prompt in the viewer's language. The header line stays in English
 * whatever the language: it is the one part the importer reads literally.
 */
export function buildImportPrompt(type: EntityType, t: (key: string) => string): string {
  const p = (key: string) => t(`import.aiPrompt.${key}`);
  // A recipe is one row per INGREDIENT (its own `rows` rule), not per item.
  const shared = type === "recipe" ? SHARED_RULES.filter((rule) => rule !== "rows") : SHARED_RULES;
  const rules = [
    ...shared.map((rule) => p(`rules.${rule}`)),
    ...TYPE_RULES[type].map((rule) => p(`${type}.${rule}`)),
  ];

  return [
    `${p("intro")} ${p(`${type}.task`)}`,
    "",
    p("headerIntro"),
    IMPORT_PROMPT_COLUMNS[type].join(","),
    "",
    p("rulesTitle"),
    ...rules.map((rule) => `- ${rule}`),
    "",
    p("output").replace("{file}", IMPORT_PROMPT_FILE[type]),
  ].join("\n");
}
