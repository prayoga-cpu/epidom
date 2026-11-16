import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  MaterialFields,
  ProductFields,
  RecipeFields,
  SupplierFields,
} from "@/lib/ai/import-schema";
import { importCatalogEntity } from "@/lib/services/catalog-import.service";
import { storefrontService } from "@/lib/services/storefront.service";
import { baseToOwner } from "@/lib/services/linked-price";
import { parseGlobalNumber, parseImportedMoney } from "@/lib/utils/import-number";
import { getCurrencyDecimals } from "@/features/pos/lib/currency-decimals";
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

const str = (value: unknown) => String(value ?? "").trim();
const given = (value: unknown) => str(value) !== "";

/** What a commit would do with one row, in the importer's own matching rules. */
interface RowVerdict {
  row: number;
  name: string;
  action: "create" | "update" | "skip";
  matchedBy?: "name" | "sku";
  matches?: { id: string; name: string; sku?: string };
  /** For an update: each value that would change, in the store's currency for money. */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** For an update: columns this row doesn't carry, which stay as they are. */
  leftAsIs?: string[];
  alsoUpdatesMenuItems?: number;
  note?: string;
}

/**
 * Say, row by row, whether a commit would update the matching record, skip it
 * or create another one. Mirrors importCatalogEntity (catalog-import.service):
 * products and recipes are matched by name (products then by SKU) and UPDATED;
 * materials are only created, and a SKU already taken is skipped; suppliers
 * are always created.
 */
async function describeRows(
  storeId: string,
  entity: Entity,
  rows: Array<Record<string, unknown>>,
  owner: { currency: string; rate: number }
): Promise<RowVerdict[]> {
  const names = [...new Set(rows.map((row) => str(row.name)).filter(Boolean))];
  const skus = [...new Set(rows.map((row) => str(row.sku)).filter(Boolean))];
  const byName = <T extends { name: string }>(list: T[]) =>
    new Map(list.map((item) => [item.name.trim().toLowerCase(), item]));
  const nameWhere = { storeId, name: { in: names, mode: "insensitive" as const } };
  const verdicts: RowVerdict[] = [];

  if (entity === "product") {
    const found = await prisma.product.findMany({
      where: {
        storeId,
        OR: [{ name: nameWhere.name }, ...(skus.length ? [{ sku: { in: skus } }] : [])],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        minStock: true,
        costPrice: true,
        sellingPrice: true,
        _count: { select: { menuItems: true } },
      },
    });
    const nameMap = byName(found);
    const skuMap = new Map(found.map((p) => [p.sku, p]));
    const decimals = getCurrencyDecimals(owner.currency);
    const price = (stored: unknown) => baseToOwner(Number(stored), owner.rate).toFixed(2);
    const typed = (value: unknown) => (parseImportedMoney(value, decimals) || 0).toFixed(2);

    rows.forEach((row, index) => {
      const name = str(row.name);
      if (!name) return;
      const byNameHit = nameMap.get(name.toLowerCase());
      const bySkuHit = !byNameHit && given(row.sku) ? skuMap.get(str(row.sku)) : undefined;
      const hit = byNameHit ?? bySkuHit;
      if (!hit) {
        verdicts.push({ row: index + 1, name, action: "create" });
        return;
      }
      const changes: RowVerdict["changes"] = {};
      const leftAsIs: string[] = [];
      const money = (field: "sellingPrice" | "costPrice") => {
        if (!given(row[field])) return leftAsIs.push(field);
        const from = price(hit[field]);
        const to = typed(row[field]);
        if (from !== to) changes![field] = { from, to };
      };
      money("sellingPrice");
      money("costPrice");
      if (!given(row.unit)) leftAsIs.push("unit");
      else if (str(row.unit) !== hit.unit) changes.unit = { from: hit.unit, to: str(row.unit) };
      if (!given(row.minStock)) leftAsIs.push("minStock");
      else if ((parseGlobalNumber(row.minStock) || 0) !== Number(hit.minStock)) {
        changes.minStock = { from: Number(hit.minStock), to: parseGlobalNumber(row.minStock) || 0 };
      }
      if (given(row.category) && str(row.category) !== (hit.category ?? "")) {
        changes.category = { from: hit.category, to: str(row.category) };
      }
      verdicts.push({
        row: index + 1,
        name,
        action: "update",
        matchedBy: byNameHit ? "name" : "sku",
        matches: { id: hit.id, name: hit.name, sku: hit.sku },
        changes,
        leftAsIs,
        alsoUpdatesMenuItems:
          changes.sellingPrice && hit._count.menuItems > 0 ? hit._count.menuItems : undefined,
        note: "Updates this product; no second product is created.",
      });
    });
    return verdicts;
  }

  if (entity === "recipe") {
    const found = byName(
      await prisma.recipe.findMany({ where: nameWhere, select: { id: true, name: true } })
    );
    rows.forEach((row, index) => {
      const name = str(row.name);
      if (!name) return;
      const hit = found.get(name.toLowerCase());
      verdicts.push(
        hit
          ? {
              row: index + 1,
              name,
              action: "update",
              matchedBy: "name",
              matches: { id: hit.id, name: hit.name },
              note: "Updates the recipe with this name.",
            }
          : { row: index + 1, name, action: "create" }
      );
    });
    return verdicts;
  }

  if (entity === "material") {
    const foundRows = await prisma.material.findMany({
      where: {
        storeId,
        OR: [{ name: nameWhere.name }, ...(skus.length ? [{ sku: { in: skus } }] : [])],
      },
      select: { id: true, name: true, sku: true },
    });
    const nameMap = byName(foundRows);
    const skuMap = new Map(foundRows.map((m) => [m.sku, m]));
    rows.forEach((row, index) => {
      const name = str(row.name);
      if (!name) return;
      const skuHit = given(row.sku) ? skuMap.get(str(row.sku)) : undefined;
      const nameHit = nameMap.get(name.toLowerCase());
      if (skuHit) {
        verdicts.push({
          row: index + 1,
          name,
          action: "skip",
          matchedBy: "sku",
          matches: { id: skuHit.id, name: skuHit.name, sku: skuHit.sku },
          note: "That SKU is already taken, so this row is skipped and the existing material is NOT changed.",
        });
      } else if (nameHit) {
        verdicts.push({
          row: index + 1,
          name,
          action: "create",
          matchedBy: "name",
          matches: { id: nameHit.id, name: nameHit.name, sku: nameHit.sku },
          note: "A material with this name exists, but materials are only ever created: this would add a SECOND one with the same name. Leave the row out to keep one.",
        });
      } else {
        verdicts.push({ row: index + 1, name, action: "create" });
      }
    });
    return verdicts;
  }

  // supplier
  const found = byName(
    await prisma.supplier.findMany({ where: nameWhere, select: { id: true, name: true } })
  );
  rows.forEach((row, index) => {
    const name = str(row.name);
    if (!name) return;
    const hit = found.get(name.toLowerCase());
    verdicts.push(
      hit
        ? {
            row: index + 1,
            name,
            action: "create",
            matchedBy: "name",
            matches: { id: hit.id, name: hit.name },
            note: "A supplier with this name exists, but suppliers are only ever created: this would add a SECOND one. Leave the row out to keep one.",
          }
        : { row: index + 1, name, action: "create" }
    );
  });
  return verdicts;
}

const COMMIT_RULES: Record<Entity, string> = {
  product:
    "A commit UPDATES the products already in Epidom (matched by name, then SKU) and creates the rest; " +
    "no duplicate is made. Columns you don't give stay as they are on an existing product (a new " +
    "product starts with 0 for cost, price and reorder level, unit pcs). A changed selling price also " +
    "updates the menu items linked to the product. To change just one product's price, cost or SKU, " +
    "update_product is simpler.",
  material:
    "A commit only CREATES materials. A row whose SKU is already taken is skipped (the existing one is " +
    "not changed); a row with the same name but a new or no SKU creates a second material.",
  supplier: "A commit only CREATES suppliers: a name that already exists is added again.",
  recipe: "A commit UPDATES the recipe with the same name and creates the rest.",
};

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
    "store's currency. Products and recipes already in Epidom are UPDATED (columns you leave out stay as " +
    "they are); materials and suppliers are only ever created. The preview says, per row, whether a " +
    "commit would update, skip or create it (commitWill, rowsInEpidom). Always run mode: preview first " +
    "and show the person the rows; commit only after they confirm. Never invent prices or quantities " +
    "you couldn't read. To change one existing product's price, cost or SKU, use update_product.",
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
      const owner = await storefrontService.getOwnerCurrencyAndRate(ctx.storeId);
      const verdicts = await describeRows(ctx.storeId, input.kind, rows, owner);
      const count = (action: RowVerdict["action"]) =>
        verdicts.filter((v) => v.action === action).length;
      const matched = verdicts.filter((v) => v.matches);
      return {
        mode: "preview",
        kind: input.kind,
        currency: owner.currency,
        rows: rows.length,
        rowsWithoutName: nameless,
        // What a commit does, so nobody has to guess whether "already in Epidom"
        // means update, skip or duplicate.
        commitWill: COMMIT_RULES[input.kind],
        wouldCreate: count("create"),
        wouldUpdate: count("update"),
        wouldSkip: count("skip"),
        alreadyInEpidom: matched.map((v) => v.name),
        rowsInEpidom: matched.slice(0, 100),
        ignoredColumns: [...unknown],
        columns: FIELDS[input.kind],
        sample: rows.slice(0, 5),
        next: "Show these rows and what happens to each to the person. If they confirm, call again with mode: commit and the same rows.",
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
