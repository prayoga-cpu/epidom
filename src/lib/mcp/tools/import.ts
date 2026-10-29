import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  MaterialFields,
  ProductFields,
  RecipeFields,
  SupplierFields,
} from "@/lib/ai/import-schema";
import { importCatalogEntity } from "@/lib/services/catalog-import.service";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { defineStoreTool } from "../define-tool";
import { McpToolError } from "../errors";
import { PAGES, storeIdInput } from "./shared";

/**
 * Bulk import from anything Claude can read (a photo of a menu or price list,
 * a supplier invoice, a pasted spreadsheet): Claude extracts the rows on the
 * person's own Claude plan and this tool hands them to the same importer the
 * Data page uses. It replaces Smart Import's "copy our prompt into an AI
 * assistant, download a CSV, upload it" loop, and never calls OpenAI.
 */

const FIELDS = {
  product: ProductFields.options,
  material: MaterialFields.options,
  supplier: SupplierFields.options,
  recipe: RecipeFields.options,
} as const;

type Entity = keyof typeof FIELDS;

const MAX_ROWS = 200;

async function existingNames(
  storeId: string,
  entity: Entity,
  names: string[]
): Promise<Set<string>> {
  const where = { storeId, name: { in: names, mode: "insensitive" as const } };
  const rows =
    entity === "product"
      ? await prisma.product.findMany({ where, select: { name: true } })
      : entity === "material"
        ? await prisma.material.findMany({ where, select: { name: true } })
        : entity === "supplier"
          ? await prisma.supplier.findMany({ where, select: { name: true } })
          : await prisma.recipe.findMany({ where, select: { name: true } });
  return new Set(rows.map((row) => row.name.trim().toLowerCase()));
}

export const importCatalog = defineStoreTool({
  name: "import_catalog",
  title: "Import products, materials, suppliers or recipes",
  description:
    "Import up to 200 rows of one kind at once, the way the Data page's import does. Use it after " +
    "reading a menu, price list or invoice the person shares. Kinds and their columns: product " +
    "(menu dishes and goods: name, sellingPrice, costPrice, category, sku, unit, currentStock, " +
    "minStock — products also appear on the menu), material (ingredients and packaging: name, unit, " +
    "unitCost, currentStock, minStock, maxStock, supplierName, supplierPrice, sku, category), supplier " +
    "(name, contactPerson, phone, email, address, city, country, notes), recipe (name, yieldQuantity, " +
    "yieldUnit, ingredients_text like 'Flour 1kg, Sugar 200g', instructions, category). Money is in the " +
    "store's currency. Always run mode: preview first and show the person the rows; commit only after " +
    "they confirm. Never invent prices or quantities you couldn't read.",
  input: z.object({
    ...storeIdInput,
    mode: z.enum(["preview", "commit"]),
    kind: z.enum(["product", "material", "supplier", "recipe"]),
    rows: z
      .array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .min(1)
      .max(MAX_ROWS),
  }),
  kind: "write",
  access: { pages: ["/data"] },
  severity: "NOTICE",
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const allowed = new Set<string>(FIELDS[input.kind]);
    const unknown = new Set<string>();
    const rows = input.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key, value]) => {
          if (!allowed.has(key)) {
            unknown.add(key);
            return false;
          }
          return value !== null && value !== "";
        })
      )
    );
    const nameless = rows.filter((row) => !String(row.name ?? "").trim()).length;
    if (nameless === rows.length) {
      throw new McpToolError(
        "INVALID_INPUT",
        "No row has a name. Every row needs at least `name`."
      );
    }

    if (input.mode === "preview") {
      const names = rows.map((row) => String(row.name ?? "").trim()).filter(Boolean);
      const [existing, { currency }] = await Promise.all([
        existingNames(ctx.storeId, input.kind, names),
        getFinanceSettings(ctx.storeId),
      ]);
      return {
        mode: "preview",
        kind: input.kind,
        currency,
        rows: rows.length,
        rowsWithoutName: nameless,
        alreadyInEpidom: names.filter((name) => existing.has(name.toLowerCase())),
        ignoredColumns: [...unknown],
        columns: FIELDS[input.kind],
        sample: rows.slice(0, 5),
        next: "Show these rows to the person. If they confirm, call again with mode: commit and the same rows.",
      };
    }

    // Writes nothing to the AI import session tables: those track the Data
    // page's OpenAI pipeline, which this path doesn't use.
    const result = await importCatalogEntity(ctx.storeId, input.kind, rows);
    if (!result.success && !result.count) {
      throw new McpToolError("IMPORT_FAILED", result.error ?? "Nothing could be imported.");
    }
    return {
      mode: "commit",
      kind: input.kind,
      imported: result.count ?? 0,
      attempted: result.details?.attempted ?? rows.length,
      failed: (result.details?.errors ?? [])
        .slice(0, 10)
        .map((e) => ({ row: e.index, reason: e.message })),
      ignoredColumns: [...unknown],
    };
  },
});
