import { z } from "zod";
import { Prisma, type Department } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services/storefront.service";
import { createMenuItemSchema } from "@/lib/validation/storefront.schemas";
import { isBuildYourOwnItem } from "@/lib/utils/menu-item-options";
import { productRepository } from "@/lib/repositories/product.repository";
import { recordAction } from "@/lib/audit/record";
import {
  readOptionGroups,
  toGroupState,
  toItemState,
  type MenuItemState,
} from "@/lib/audit/menu-undo";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import type { McpStoreContext } from "../authorize";
import { defineStoreTool } from "../define-tool";
import { McpToolError, relayKnownError } from "../errors";
import {
  describeGroups,
  mergedGroupsOf,
  optionGroupInput,
  resolveOptionGroups,
  type OptionGroupInput,
  type ResolvedGroups,
} from "./menu-options";
import { money, PAGES, storeIdInput } from "./shared";

/**
 * Menu items (what the till and the storefront sell). MenuItem.price is a
 * literal amount in the store's own currency — never converted.
 *
 * Every tool that changes the menu takes `mode: "preview" | "commit"`:
 * preview validates everything and returns exactly what would change without
 * writing a thing (not even a new category), so the person can check it on a
 * published store before it goes live.
 */

const access = { pages: PAGES.menu } as const;

const MENU_ITEM_ERRORS = [
  [
    /not found or does not belong/i,
    "NOT_FOUND",
    "No such menu item in this store. Use get_menu for the ids.",
  ],
] as const;

const modeInput = {
  mode: z
    .enum(["preview", "commit"])
    .default("commit")
    .describe(
      "preview = check and show what would change, write nothing. commit = apply it. " +
        "Run preview first on a store that is live, show the person, commit after a clear yes."
    ),
};

function menuChanged(storeId: string, action: "created" | "updated" | "deleted", entityId: string) {
  publishStoreEvent(storeId, REALTIME_EVENTS.MENU_CHANGED, { action, entityId });
}

/** "Changed 3 menu items: A, B, C" — the line the change history shows. */
function itemsSummary(verb: string, names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return `${verb} ${names.length} menu item${names.length === 1 ? "" : "s"}: ${shown}${more}`;
}

/** A menu item's department is KITCHEN or BAR; a product's may also be BOTH. */
const menuDepartment = (department: Department): "KITCHEN" | "BAR" =>
  department === "BAR" ? "BAR" : "KITCHEN";

interface StorefrontView {
  id: string;
  menuCategories: Array<{ id: string; name: string }>;
}

/**
 * The store's storefront with its categories. Commit may create the draft
 * storefront (as the app does); preview only reads, so it never writes.
 */
async function loadStorefront(
  ctx: McpStoreContext,
  mode: "preview" | "commit"
): Promise<StorefrontView | null> {
  if (mode === "commit") {
    const storefront = await storefrontService.getStorefrontByStoreId(ctx.storeId);
    return { id: storefront.id, menuCategories: storefront.menuCategories };
  }
  return prisma.storefront.findUnique({
    where: { storeId: ctx.storeId },
    select: {
      id: true,
      menuCategories: { orderBy: { displayOrder: "asc" }, select: { id: true, name: true } },
    },
  });
}

interface ProductView {
  id: string;
  name: string;
  department: Department;
  hasOptionGroups: boolean;
}

/** This store's products among `ids`; a foreign or unknown id is simply absent. */
async function loadProducts(storeId: string, ids: string[]): Promise<Map<string, ProductView>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.product.findMany({
    where: { id: { in: [...new Set(ids)] }, storeId },
    select: { id: true, name: true, department: true, optionGroups: { select: { id: true } } },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        department: row.department,
        hasOptionGroups: row.optionGroups.length > 0,
      },
    ])
  );
}

const OPTION_GROUPS_DESCRIPTION =
  "Choice groups the customer builds the item from (e.g. Base, Protein, Sauce). Each group has " +
  "required / maxSelect and a list of choices (name + priceDelta, or fromMenuItemId to copy an " +
  "existing item's name and price). These are price-only choices stored on the item; choices that must " +
  "deduct raw-material stock go on the linked product (set_product_options).";

export const getMenu = defineStoreTool({
  name: "get_menu",
  title: "Menu",
  description:
    "The store's menu by category, in display order (empty categories included): each item's id, price " +
    "(store currency), description, department, whether it is available (on sale today), shown on the " +
    "till, featured, the inventory product it is linked to (so selling it deducts stock), and, for " +
    'composable ("à composer" / Build Your Own) items, `composable: true` with its optionGroups ' +
    "(name, required, maxSelect, and each choice with priceDelta; stockLinked marks a choice that " +
    "deducts a raw material). Choices are identified by name within their group.",
  input: z.object({
    ...storeIdInput,
    availableOnly: z.boolean().optional().describe("Leave out items marked unavailable."),
  }),
  kind: "read",
  access,
  handler: async (input, ctx) => {
    const [storefront, finance] = await Promise.all([
      // A plain read: getStorefrontByStoreId would create a draft storefront.
      prisma.storefront.findUnique({
        where: { storeId: ctx.storeId },
        select: {
          id: true,
          menuCategories: { orderBy: { displayOrder: "asc" }, select: { id: true, name: true } },
        },
      }),
      getFinanceSettings(ctx.storeId),
    ]);
    if (!storefront) return { currency: finance.currency, categories: [], note: "No menu yet." };

    const items = await prisma.menuItem.findMany({
      where: {
        storefrontId: storefront.id,
        ...(input.availableOnly && { isAvailable: true }),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        categoryId: true,
        department: true,
        isAvailable: true,
        showOnCashier: true,
        isFeatured: true,
        productId: true,
        buildYourOwn: true,
        modifiers: true,
        product: {
          select: {
            buildYourOwn: true,
            optionGroups: {
              orderBy: { displayOrder: "asc" },
              select: {
                name: true,
                isRequired: true,
                maxSelections: true,
                options: {
                  orderBy: { displayOrder: "asc" },
                  select: {
                    name: true,
                    priceAdjustment: true,
                    materialId: true,
                    materialQty: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const shape = (item: (typeof items)[number]) => {
      const groups = mergedGroupsOf(item);
      const composable = isBuildYourOwnItem(item, item.product) || undefined;
      return {
        itemId: item.id,
        name: item.name,
        price: money(item.price),
        description: item.description || undefined,
        department: item.department,
        available: item.isAvailable,
        onTill: item.showOnCashier,
        featured: item.isFeatured || undefined,
        linkedProductId: item.productId ?? undefined,
        composable,
        optionGroups: groups.length > 0 ? describeGroups(groups) : undefined,
      };
    };

    const categories = storefront.menuCategories.map((category) => {
      const inCategory = items.filter((item) => item.categoryId === category.id);
      return {
        categoryId: category.id,
        name: category.name,
        itemCount: inCategory.length,
        items: inCategory.map(shape),
      };
    });
    const uncategorized = items.filter((item) => item.categoryId === null);
    if (uncategorized.length > 0) {
      categories.push({
        categoryId: "",
        name: "Uncategorized",
        itemCount: uncategorized.length,
        items: uncategorized.map(shape),
      });
    }
    return { currency: finance.currency, categories };
  },
});

const newItem = z.object({
  name: z.string().min(1).max(100),
  price: z
    .number()
    .min(0)
    .describe("In the store's currency. A composable item can be 0 when its price is the choices."),
  category: z.string().max(100).optional().describe("Category name; created if it doesn't exist."),
  description: z.string().max(300).optional(),
  department: z
    .enum(["KITCHEN", "BAR"])
    .optional()
    .describe(
      "Where it is prepared (kitchen ticket or bar). Defaults to the linked product's, else KITCHEN."
    ),
  available: z.boolean().optional().describe("Default true."),
  featured: z.boolean().optional(),
  linkedProductId: z
    .string()
    .optional()
    .describe(
      "Inventory product this item sells (an id from list_inventory type products), so selling it " +
        "deducts stock."
    ),
  composable: z
    .boolean()
    .optional()
    .describe(
      'Sell it as "à composer" / Build Your Own: the customer builds it from the option groups, ' +
        "shown as numbered steps. Needs optionGroups (or a linked product that has them)."
    ),
  optionGroups: z.array(optionGroupInput).max(12).optional().describe(OPTION_GROUPS_DESCRIPTION),
});

/** What a group list looks like in a preview, shaped like get_menu's. */
function previewGroups(modifiers: ResolvedGroups["modifiers"]) {
  return describeGroups(
    modifiers.map((group) => ({
      name: group.name,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections,
      options: group.options.map((option) => ({
        name: option.name,
        priceAdjustment: option.priceAdd,
      })),
    }))
  );
}

export const createMenuItems = defineStoreTool({
  name: "create_menu_items",
  title: "Add menu items",
  description:
    "Add up to 50 items to the menu in one call (e.g. read from a menu photo). Each needs a name and a " +
    "price in the store's currency; a category name is matched case-insensitively or created. An item " +
    'can be composable: give optionGroups (and composable: true) to create a "build your own" item in ' +
    "one go, copying choices from existing items with fromMenuItemId. Items whose name already exists " +
    "on the menu are skipped unless allowDuplicates is true. An item is standalone (selling it does not " +
    "touch stock) unless you pass linkedProductId, an inventory product id from list_inventory " +
    "(type: products); to create new products, use import_catalog (kind: product), which also puts " +
    "them on the menu. Use mode: preview first, then commit.",
  input: z.object({
    ...storeIdInput,
    items: z.array(newItem).min(1).max(50),
    allowDuplicates: z.boolean().default(false),
    ...modeInput,
  }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const preview = input.mode === "preview";
    const storefront = await loadStorefront(ctx, input.mode);
    const existing = new Set(
      storefront
        ? (
            await prisma.menuItem.findMany({
              where: { storefrontId: storefront.id },
              select: { name: true },
            })
          ).map((item) => item.name.trim().toLowerCase())
        : []
    );
    const knownCategories = new Map(
      (storefront?.menuCategories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id])
    );
    const products = await loadProducts(
      ctx.storeId,
      input.items.flatMap((item) => (item.linkedProductId ? [item.linkedProductId] : []))
    );

    const created: Array<{ itemId: string; name: string; price: string; category: string | null }> =
      [];
    const createdStates: MenuItemState[] = [];
    const wouldCreate: Array<Record<string, unknown>> = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    const warnings: string[] = [];
    const categoryIds = new Map<string, string | null>();

    for (const item of input.items) {
      const key = item.name.trim().toLowerCase();
      if (!input.allowDuplicates && existing.has(key)) {
        skipped.push({ name: item.name, reason: "already on the menu" });
        continue;
      }

      const product = item.linkedProductId ? products.get(item.linkedProductId) : undefined;
      if (item.linkedProductId && !product) {
        skipped.push({
          name: item.name,
          reason:
            "linkedProductId isn't a product of this store (see list_inventory, type: products)",
        });
        continue;
      }

      let resolved: ResolvedGroups | null = null;
      if (item.optionGroups && item.optionGroups.length > 0) {
        resolved = await resolveOptionGroups(
          storefront?.id ?? "",
          item.optionGroups as OptionGroupInput[]
        );
        warnings.push(...resolved.warnings);
      }
      if (item.composable && !resolved && !product?.hasOptionGroups) {
        skipped.push({
          name: item.name,
          reason: "composable needs optionGroups (or a linked product that has option groups)",
        });
        continue;
      }

      const categoryName = item.category?.trim() || null;
      const categoryKey = categoryName?.toLowerCase() ?? "";
      const department =
        item.department ?? (product ? menuDepartment(product.department) : "KITCHEN");

      if (preview) {
        wouldCreate.push({
          name: item.name.trim(),
          price: money(item.price),
          category: categoryName
            ? { name: categoryName, exists: knownCategories.has(categoryKey) }
            : null,
          department,
          linkedProduct: product ? { id: product.id, name: product.name } : undefined,
          composable: item.composable || undefined,
          optionGroups: resolved ? previewGroups(resolved.modifiers) : undefined,
        });
        existing.add(key);
        continue;
      }

      if (!categoryIds.has(categoryKey)) {
        categoryIds.set(
          categoryKey,
          await storefrontService.resolveMenuCategoryId(ctx.storeId, categoryName)
        );
      }

      const parsed = createMenuItemSchema.safeParse({
        name: item.name.trim(),
        price: item.price,
        categoryId: categoryIds.get(categoryKey) ?? null,
        productId: product?.id ?? null,
        description: item.description ?? "",
        department,
        isAvailable: item.available ?? true,
        isFeatured: item.featured ?? false,
        modifiers: resolved?.modifiers,
        buildYourOwn: item.composable ?? false,
      });
      if (!parsed.success) {
        skipped.push({
          name: item.name,
          reason: parsed.error.issues.map((i) => i.message).join("; "),
        });
        continue;
      }

      const row = await storefrontService.createMenuItem(storefront!.id, parsed.data);
      createdStates.push(toItemState(row));
      existing.add(key);
      menuChanged(ctx.storeId, "created", row.id);
      created.push({
        itemId: row.id,
        name: row.name,
        price: money(row.price),
        category: categoryName,
      });
    }

    const uniqueWarnings = [...new Set(warnings)];
    if (preview) {
      return {
        mode: "preview",
        wouldCreate,
        skipped,
        warnings: uniqueWarnings,
        next: "Show the person this list. If they confirm, call again with mode: commit and the same items.",
      };
    }
    let changeId: string | null = null;
    if (createdStates.length > 0) {
      changeId = await recordAction({
        actionType: "menu.items.change",
        storeId: ctx.storeId,
        payload: {
          storeId: ctx.storeId,
          storefrontId: storefront!.id,
          summary: itemsSummary(
            "Added",
            createdStates.map((state) => state.name)
          ),
          updated: [],
          created: createdStates,
        },
      });
    }
    return { created, skipped, warnings: uniqueWarnings, changeId: changeId ?? undefined };
  },
});

// ---------------------------------------------------------------------------
// Changing items: one, or up to 50 at once (all or nothing)
// ---------------------------------------------------------------------------

const patchFields = {
  name: z.string().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  description: z.string().max(300).optional(),
  category: z
    .string()
    .max(100)
    .nullable()
    .optional()
    .describe("Category name (created if new), or null for none."),
  available: z.boolean().optional().describe("false = sold out / hidden from the storefront."),
  onTill: z.boolean().optional().describe("Whether it shows on the till."),
  featured: z.boolean().optional(),
  department: z.enum(["KITCHEN", "BAR"]).optional().describe("Where it is prepared."),
  linkedProductId: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Inventory product it sells (list_inventory type products), or null to unlink. Linking " +
        "also moves the department to the product's unless you give one."
    ),
  composable: z
    .boolean()
    .optional()
    .describe('Sell it as "à composer" (numbered build steps). Needs option groups.'),
  optionGroups: z
    .array(optionGroupInput)
    .max(12)
    .optional()
    .describe(
      "REPLACES the item's own option groups with this list ([] removes them). " +
        OPTION_GROUPS_DESCRIPTION
    ),
};

const patchInput = z.object(patchFields);
type PatchFields = z.infer<typeof patchInput>;

const ITEM_SELECT = {
  id: true,
  name: true,
  price: true,
  description: true,
  categoryId: true,
  department: true,
  isAvailable: true,
  showOnCashier: true,
  isFeatured: true,
  productId: true,
  buildYourOwn: true,
  modifiers: true,
  product: {
    select: {
      name: true,
      buildYourOwn: true,
      optionGroups: {
        select: {
          name: true,
          isRequired: true,
          maxSelections: true,
          options: {
            select: { name: true, priceAdjustment: true, materialId: true, materialQty: true },
          },
        },
      },
    },
  },
} satisfies Prisma.MenuItemSelect;

type ItemRow = Prisma.MenuItemGetPayload<{ select: typeof ITEM_SELECT }>;

interface PlannedUpdate {
  itemId: string;
  name: string;
  data: Prisma.MenuItemUncheckedUpdateInput;
  /** A category to create at commit (preview never creates one). */
  newCategory: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Validates one item's change against what is stored and says what it would do. */
async function planUpdate(
  storefront: StorefrontView,
  row: ItemRow,
  fields: PatchFields,
  products: Map<string, ProductView>,
  warnings: string[]
): Promise<PlannedUpdate> {
  const given = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (given.length === 0) {
    throw new McpToolError(
      "INVALID_INPUT",
      `Nothing to change on "${row.name}": give at least one field.`
    );
  }

  const data: Prisma.MenuItemUncheckedUpdateInput = {};
  const changes: PlannedUpdate["changes"] = {};
  const categoryName = (id: string | null) =>
    id ? (storefront.menuCategories.find((c) => c.id === id)?.name ?? id) : null;
  const note = (field: string, from: unknown, to: unknown) => {
    if (!sameJson(from, to)) changes[field] = { from, to };
  };

  if (fields.name !== undefined) {
    data.name = fields.name.trim();
    note("name", row.name, data.name);
  }
  if (fields.price !== undefined) {
    data.price = new Prisma.Decimal(fields.price);
    note("price", money(row.price), money(fields.price));
  }
  if (fields.description !== undefined) {
    data.description = fields.description;
    note("description", row.description ?? "", fields.description);
  }
  if (fields.available !== undefined) {
    data.isAvailable = fields.available;
    note("available", row.isAvailable, fields.available);
  }
  if (fields.onTill !== undefined) {
    data.showOnCashier = fields.onTill;
    note("onTill", row.showOnCashier, fields.onTill);
  }
  if (fields.featured !== undefined) {
    data.isFeatured = fields.featured;
    note("featured", row.isFeatured, fields.featured);
  }

  let newCategory: string | null = null;
  if (fields.category !== undefined) {
    const name = fields.category?.trim() || null;
    if (name === null) {
      data.categoryId = null;
    } else {
      const match = storefront.menuCategories.find(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (match) data.categoryId = match.id;
      else newCategory = name;
    }
    const to = name ? (newCategory ? `${name} (new)` : name) : null;
    note("category", categoryName(row.categoryId), to);
  }

  if (fields.linkedProductId !== undefined) {
    if (fields.linkedProductId === null) {
      data.productId = null;
      note("linkedProduct", row.product?.name ?? row.productId, null);
    } else {
      const product = products.get(fields.linkedProductId);
      if (!product) {
        throw new McpToolError(
          "NOT_FOUND",
          `"${row.name}": linkedProductId ${fields.linkedProductId} isn't a product of this store. ` +
            "Use list_inventory (type: products)."
        );
      }
      data.productId = product.id;
      if (fields.department === undefined) data.department = menuDepartment(product.department);
      note("linkedProduct", row.product?.name ?? row.productId, product.name);
    }
  }
  if (fields.department !== undefined) data.department = fields.department;
  if (data.department !== undefined) note("department", row.department, data.department);

  let modifiers: ResolvedGroups["modifiers"] | null = null;
  if (fields.optionGroups !== undefined) {
    const resolved = await resolveOptionGroups(
      storefront.id,
      fields.optionGroups as OptionGroupInput[]
    );
    modifiers = resolved.modifiers;
    data.modifiers = modifiers as Prisma.InputJsonValue;
    warnings.push(...resolved.warnings);
    note(
      "optionGroups",
      mergedGroupsOf({ modifiers: row.modifiers, product: null }).map((g) => g.name),
      modifiers.map((g) => g.name)
    );
  }

  if (fields.composable !== undefined) {
    if (fields.composable) {
      const ownGroups = modifiers ?? (Array.isArray(row.modifiers) ? row.modifiers : []);
      const linkedGroups =
        fields.linkedProductId === null ? 0 : (row.product?.optionGroups.length ?? 0);
      const newProduct = fields.linkedProductId ? products.get(fields.linkedProductId) : undefined;
      if (
        ownGroups.length === 0 &&
        linkedGroups === 0 &&
        !(newProduct && newProduct.hasOptionGroups)
      ) {
        throw new McpToolError(
          "INVALID_INPUT",
          `"${row.name}" can't be composable without option groups: pass optionGroups.`
        );
      }
    }
    data.buildYourOwn = fields.composable;
    note("composable", row.buildYourOwn, fields.composable);
  }

  return { itemId: row.id, name: row.name, data, newCategory, changes };
}

/**
 * Plan and, in commit mode, apply changes to one or several items. Several
 * go through one database transaction: if any change is refused or fails,
 * none is applied. (A category the changes name that doesn't exist yet is
 * created just before the transaction; if the transaction then fails it stays
 * behind, empty.)
 */
async function changeItems(
  ctx: McpStoreContext,
  updates: Array<{ itemId: string } & PatchFields>,
  mode: "preview" | "commit"
) {
  const ids = updates.map((u) => u.itemId);
  if (new Set(ids).size !== ids.length) {
    throw new McpToolError("INVALID_INPUT", "The same itemId appears twice. Merge those changes.");
  }

  const storefront = await loadStorefront(ctx, mode);
  if (!storefront) throw new McpToolError("NOT_FOUND", "This store has no menu yet.");

  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids }, storefrontId: storefront.id },
    select: ITEM_SELECT,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new McpToolError(
      "NOT_FOUND",
      `No menu item with id ${missing.slice(0, 5).join(", ")} in this store. Use get_menu for the ids.`
    );
  }

  const products = await loadProducts(
    ctx.storeId,
    updates.flatMap((u) => (typeof u.linkedProductId === "string" ? [u.linkedProductId] : []))
  );

  const warnings: string[] = [];
  const plans: PlannedUpdate[] = [];
  for (const { itemId, ...fields } of updates) {
    plans.push(await planUpdate(storefront, byId.get(itemId)!, fields, products, warnings));
  }
  const newCategories = [...new Set(plans.flatMap((p) => (p.newCategory ? [p.newCategory] : [])))];

  if (mode === "preview") {
    return {
      mode: "preview" as const,
      changes: plans.map((p) => ({ itemId: p.itemId, name: p.name, changes: p.changes })),
      newCategories: newCategories.length > 0 ? newCategories : undefined,
      warnings: [...new Set(warnings)],
      next: "Show the person what changes. If they confirm, call again with mode: commit and the same input.",
    };
  }

  const createdIds = new Map<string, string | null>();
  for (const name of newCategories) {
    createdIds.set(name, await storefrontService.resolveMenuCategoryId(ctx.storeId, name));
  }
  for (const plan of plans) {
    if (plan.newCategory) plan.data.categoryId = createdIds.get(plan.newCategory) ?? null;
  }

  try {
    const { updated, changeId } = await prisma.$transaction(async (tx) => {
      const before = new Map(
        (
          await tx.menuItem.findMany({ where: { id: { in: ids }, storefrontId: storefront.id } })
        ).map((row) => [row.id, toItemState(row)])
      );
      const rows = [];
      for (const plan of plans) {
        rows.push(await tx.menuItem.update({ where: { id: plan.itemId }, data: plan.data }));
      }
      const changeId = await recordAction(
        {
          actionType: "menu.items.change",
          storeId: ctx.storeId,
          payload: {
            storeId: ctx.storeId,
            storefrontId: storefront.id,
            summary: itemsSummary(
              "Changed",
              rows.map((row) => row.name)
            ),
            updated: rows.map((row) => ({ before: before.get(row.id)!, after: toItemState(row) })),
            created: [],
          },
        },
        { tx }
      );
      return { updated: rows, changeId };
    });
    for (const row of updated) menuChanged(ctx.storeId, "updated", row.id);
    return {
      mode: "commit" as const,
      updated: updated.map((row, index) => ({
        itemId: row.id,
        name: row.name,
        price: money(row.price),
        available: row.isAvailable,
        onTill: row.showOnCashier,
        featured: row.isFeatured,
        department: row.department,
        composable: row.buildYourOwn || undefined,
        changes: plans[index].changes,
      })),
      warnings: [...new Set(warnings)],
      changeId: changeId ?? undefined,
    };
  } catch (error) {
    relayKnownError(error, MENU_ITEM_ERRORS);
  }
}

export const updateMenuItem = defineStoreTool({
  name: "update_menu_item",
  title: "Change a menu item",
  description:
    "Change one menu item: name, price (store currency), description, category, availability (mark " +
    "sold out or back on sale), whether it shows on the till, featured, department (KITCHEN or BAR), " +
    "the inventory product it is linked to, and, for composable items, composable and optionGroups " +
    "(which REPLACE the item's own groups). Only the fields given change. Use mode: preview to see " +
    "the before and after, then commit. For several items at once use update_menu_items.",
  input: z.object({ ...storeIdInput, itemId: z.string(), ...patchFields, ...modeInput }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    const { storeId: _storeId, itemId, mode, ...fields } = input;
    return changeItems(ctx, [{ itemId, ...fields }], mode);
  },
});

export const updateMenuItems = defineStoreTool({
  name: "update_menu_items",
  title: "Change several menu items",
  description:
    "Change up to 50 menu items in one call, all or nothing: if any item is refused (unknown id, " +
    "bad option group, product not in this store) nothing is changed. Each entry has the same fields " +
    "as update_menu_item. Use it to hide many items at once (available: false, onTill: false), move a " +
    "batch to another category or fix departments. Hiding keeps past orders and stock links intact; " +
    "prefer it to delete_menu_item. Use mode: preview first.",
  input: z.object({
    ...storeIdInput,
    updates: z
      .array(z.object({ itemId: z.string(), ...patchFields }))
      .min(1)
      .max(50),
    ...modeInput,
  }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => changeItems(ctx, input.updates, input.mode),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const manageCategory = defineStoreTool({
  name: "manage_category",
  title: "Manage menu categories",
  description:
    "Rename, reorder, merge or remove menu categories. actions: rename (categoryId, name); reorder " +
    "(orderedCategoryIds: the categories in the order they should appear, any not listed follow in " +
    "their current order); merge_into (categoryId, targetCategoryId: every item moves to the target, " +
    "then the emptied category is removed); delete_if_empty (categoryIds: only categories with no " +
    "items are removed, the rest are reported and left alone). Ids come from get_menu. Never deletes " +
    "items. Use mode: preview first, then commit.",
  input: z.object({
    ...storeIdInput,
    action: z.enum(["rename", "reorder", "merge_into", "delete_if_empty"]),
    categoryId: z.string().optional(),
    name: z.string().min(1).max(100).optional(),
    orderedCategoryIds: z.array(z.string()).max(200).optional(),
    targetCategoryId: z.string().optional(),
    categoryIds: z.array(z.string()).min(1).max(50).optional(),
    ...modeInput,
  }),
  kind: "write",
  access,
  hints: { destructiveHint: true, idempotentHint: false },
  handler: async (input, ctx) => {
    const preview = input.mode === "preview";
    const storefront = await loadStorefront(ctx, input.mode);
    if (!storefront) throw new McpToolError("NOT_FOUND", "This store has no menu yet.");

    const categories = await prisma.menuCategory.findMany({
      where: { storefrontId: storefront.id },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, displayOrder: true, _count: { select: { items: true } } },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));
    const need = (id: string | undefined, label: string) => {
      if (!id) throw new McpToolError("INVALID_INPUT", `${input.action} needs ${label}.`);
      const found = byId.get(id);
      if (!found) {
        throw new McpToolError(
          "NOT_FOUND",
          `No category with id ${id} in this store. Use get_menu for the ids.`
        );
      }
      return found;
    };

    const beforeStates = categories.map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
    }));
    const record = (
      tx: Prisma.TransactionClient,
      action: "rename" | "reorder" | "merge_into" | "delete_if_empty",
      summary: string,
      after: typeof beforeStates,
      removed: Array<(typeof beforeStates)[number] & { itemIds: string[] }> = [],
      movedTo: string | null = null
    ) =>
      recordAction(
        {
          actionType: "menu.categories.change",
          storeId: ctx.storeId,
          payload: {
            storeId: ctx.storeId,
            storefrontId: storefront.id,
            action,
            summary,
            before: beforeStates,
            after,
            removed,
            movedTo,
          },
        },
        { tx }
      );

    switch (input.action) {
      case "rename": {
        const category = need(input.categoryId, "a categoryId");
        const name = input.name?.trim();
        if (!name) throw new McpToolError("INVALID_INPUT", "rename needs a name.");
        const clash = categories.find(
          (c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (clash) {
          throw new McpToolError(
            "CONFLICT",
            `A category called "${clash.name}" already exists. Use merge_into to combine them.`
          );
        }
        let changeId: string | null = null;
        if (!preview) {
          changeId = await prisma.$transaction(async (tx) => {
            await tx.menuCategory.update({ where: { id: category.id }, data: { name } });
            return record(
              tx,
              "rename",
              `Renamed category ${category.name} to ${name}`,
              beforeStates.map((c) => (c.id === category.id ? { ...c, name } : c))
            );
          });
          menuChanged(ctx.storeId, "updated", category.id);
        }
        return {
          mode: input.mode,
          action: "rename",
          from: category.name,
          to: name,
          changeId: changeId ?? undefined,
        };
      }

      case "reorder": {
        const listed = input.orderedCategoryIds ?? [];
        if (listed.length === 0) {
          throw new McpToolError("INVALID_INPUT", "reorder needs orderedCategoryIds.");
        }
        listed.forEach((id) => need(id, "valid category ids"));
        if (new Set(listed).size !== listed.length) {
          throw new McpToolError("INVALID_INPUT", "orderedCategoryIds lists a category twice.");
        }
        const rest = categories.map((c) => c.id).filter((id) => !listed.includes(id));
        const finalOrder = [...listed, ...rest];
        let changeId: string | null = null;
        if (!preview) {
          changeId = await prisma.$transaction(async (tx) => {
            for (const [index, id] of finalOrder.entries()) {
              await tx.menuCategory.update({ where: { id }, data: { displayOrder: index } });
            }
            return record(
              tx,
              "reorder",
              "Reordered the menu categories",
              finalOrder.map((id, index) => ({ id, name: byId.get(id)!.name, displayOrder: index }))
            );
          });
          menuChanged(ctx.storeId, "updated", storefront.id);
        }
        return {
          mode: input.mode,
          action: "reorder",
          order: finalOrder.map((id) => byId.get(id)!.name),
          changeId: changeId ?? undefined,
        };
      }

      case "merge_into": {
        const source = need(input.categoryId, "a categoryId");
        const target = need(input.targetCategoryId, "a targetCategoryId");
        if (source.id === target.id) {
          throw new McpToolError("INVALID_INPUT", "Pick a different target category.");
        }
        let changeId: string | null = null;
        if (!preview) {
          changeId = await prisma.$transaction(async (tx) => {
            const itemIds = (
              await tx.menuItem.findMany({
                where: { categoryId: source.id, storefrontId: storefront.id },
                select: { id: true },
              })
            ).map((item) => item.id);
            await tx.menuItem.updateMany({
              where: { categoryId: source.id, storefrontId: storefront.id },
              data: { categoryId: target.id },
            });
            await tx.menuCategory.delete({ where: { id: source.id } });
            return record(
              tx,
              "merge_into",
              `Merged category ${source.name} into ${target.name}`,
              beforeStates.filter((c) => c.id !== source.id),
              [
                {
                  id: source.id,
                  name: source.name,
                  displayOrder: source.displayOrder,
                  itemIds,
                },
              ],
              target.id
            );
          });
          menuChanged(ctx.storeId, "updated", target.id);
        }
        return {
          mode: input.mode,
          action: "merge_into",
          moved: source._count.items,
          from: source.name,
          into: target.name,
          changeId: changeId ?? undefined,
        };
      }

      case "delete_if_empty": {
        const wanted = input.categoryIds ?? (input.categoryId ? [input.categoryId] : []);
        if (wanted.length === 0) {
          throw new McpToolError("INVALID_INPUT", "delete_if_empty needs categoryIds.");
        }
        const targets = wanted.map((id) => need(id, "valid category ids"));
        const empty = targets.filter((c) => c._count.items === 0);
        const kept = targets
          .filter((c) => c._count.items > 0)
          .map((c) => ({ name: c.name, items: c._count.items, reason: "still has items" }));
        let changeId: string | null = null;
        if (!preview && empty.length > 0) {
          changeId = await prisma.$transaction(async (tx) => {
            await tx.menuCategory.deleteMany({
              where: { id: { in: empty.map((c) => c.id) }, storefrontId: storefront.id },
            });
            const gone = new Set(empty.map((c) => c.id));
            return record(
              tx,
              "delete_if_empty",
              `Removed ${empty.length} empty categor${empty.length === 1 ? "y" : "ies"}: ${empty.map((c) => c.name).join(", ")}`,
              beforeStates.filter((c) => !gone.has(c.id)),
              empty.map((c) => ({
                id: c.id,
                name: c.name,
                displayOrder: c.displayOrder,
                itemIds: [],
              }))
            );
          });
          for (const category of empty) menuChanged(ctx.storeId, "deleted", category.id);
        }
        return {
          mode: input.mode,
          action: "delete_if_empty",
          removed: empty.map((c) => c.name),
          left: kept,
          changeId: changeId ?? undefined,
        };
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Stock-linked choices on a product
// ---------------------------------------------------------------------------

const productChoice = z.object({
  name: z.string().min(1).max(100),
  priceDelta: z.number().min(0).optional().describe("Extra price in the store's currency."),
  materialId: z
    .string()
    .optional()
    .describe("Raw material this choice uses up (list_inventory, type: materials)."),
  materialQty: z
    .number()
    .positive()
    .optional()
    .describe("How much of that material, in the material's own unit, per unit sold."),
});

export const setProductOptions = defineStoreTool({
  name: "set_product_options",
  title: "Set a product's option groups (stock-linked)",
  description:
    "REPLACE the option groups of an inventory product: the choices a customer picks (Size, Protein, " +
    "Sauce...), each with an extra price and, optionally, a raw material and quantity that selling " +
    "that choice deducts from stock. This is how a composable item deducts ingredient stock. Menu items " +
    "linked to the product (get_menu: linkedProductId) then offer these groups on the till and " +
    "storefront. Pass the product's whole set; [] removes them all. composable: true shows them as " +
    "numbered Build Your Own steps. Materials must belong to this store. Use mode: preview first.",
  input: z.object({
    ...storeIdInput,
    productId: z
      .string()
      .describe("From list_inventory (type: products) or get_menu linkedProductId."),
    groups: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          required: z.boolean().optional(),
          maxSelect: z.number().int().min(1).max(50).nullable().optional(),
          options: z.array(productChoice).min(1).max(60),
        })
      )
      .max(12),
    composable: z.boolean().optional(),
    ...modeInput,
  }),
  kind: "write",
  access: { pages: PAGES.catalog },
  hints: { destructiveHint: true, idempotentHint: true },
  handler: async (input, ctx) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, storeId: ctx.storeId },
      select: { id: true, name: true, buildYourOwn: true },
    });
    if (!product) {
      throw new McpToolError(
        "NOT_FOUND",
        "No such product in this store. Use list_inventory (type: products) for the ids."
      );
    }

    const materialIds = [
      ...new Set(
        input.groups.flatMap((g) => g.options.flatMap((o) => (o.materialId ? [o.materialId] : [])))
      ),
    ];
    const materials = materialIds.length
      ? await prisma.material.findMany({
          where: { id: { in: materialIds }, storeId: ctx.storeId },
          select: { id: true, name: true, unit: true },
        })
      : [];
    const materialById = new Map(materials.map((m) => [m.id, m]));
    const unknown = materialIds.filter((id) => !materialById.has(id));
    if (unknown.length > 0) {
      throw new McpToolError(
        "NOT_FOUND",
        `No raw material with id ${unknown.slice(0, 5).join(", ")} in this store. Use list_inventory (type: materials).`
      );
    }

    const seen = new Set<string>();
    const groups = input.groups.map((group) => {
      const key = group.name.trim().toLowerCase();
      if (seen.has(key)) {
        throw new McpToolError("INVALID_INPUT", `Two groups are called "${group.name}".`);
      }
      seen.add(key);
      const names = new Set<string>();
      const options = group.options.map((option) => {
        const optionKey = option.name.trim().toLowerCase();
        if (names.has(optionKey)) {
          throw new McpToolError(
            "INVALID_INPUT",
            `Group "${group.name}" lists "${option.name}" twice.`
          );
        }
        names.add(optionKey);
        if (Boolean(option.materialId) !== Boolean(option.materialQty)) {
          throw new McpToolError(
            "INVALID_INPUT",
            `"${option.name}": give both materialId and materialQty, or neither.`
          );
        }
        return {
          name: option.name.trim(),
          priceAdjustment: option.priceDelta ?? 0,
          materialId: option.materialId,
          materialQty: option.materialQty,
        };
      });
      return {
        name: group.name.trim(),
        isRequired: group.required ?? false,
        maxSelections: group.maxSelect === null ? options.length : (group.maxSelect ?? 1),
        options,
      };
    });

    const summary = groups.map((group) => ({
      name: group.name,
      required: group.isRequired,
      maxSelect: group.maxSelections,
      options: group.options.map((option) => ({
        name: option.name,
        priceDelta: money(option.priceAdjustment),
        deducts: option.materialId
          ? `${option.materialQty} ${materialById.get(option.materialId)!.unit} of ${materialById.get(option.materialId)!.name}`
          : undefined,
      })),
    }));

    if (input.mode === "preview") {
      return {
        mode: "preview",
        product: product.name,
        replacesExistingGroups: true,
        groups: summary,
        composable: input.composable,
        next: "Show the person. If they confirm, call again with mode: commit and the same groups.",
      };
    }

    const beforeGroups = await readOptionGroups(prisma, product.id);
    await productRepository.updateOptionGroups(product.id, ctx.storeId, groups);
    if (input.composable !== undefined && input.composable !== product.buildYourOwn) {
      await prisma.product.update({
        where: { id: product.id },
        data: { buildYourOwn: input.composable },
      });
    }
    publishStoreEvent(ctx.storeId, REALTIME_EVENTS.PRODUCT_CHANGED, {
      action: "updated",
      entityId: product.id,
    });
    menuChanged(ctx.storeId, "updated", product.id);
    const changeId = await recordAction({
      actionType: "menu.product_options.change",
      storeId: ctx.storeId,
      targetId: product.id,
      payload: {
        storeId: ctx.storeId,
        productId: product.id,
        productName: product.name,
        before: beforeGroups,
        after: toGroupState(groups),
        beforeBuildYourOwn: product.buildYourOwn,
        afterBuildYourOwn: input.composable ?? product.buildYourOwn,
      },
    });
    return {
      mode: "commit",
      product: product.name,
      groups: summary,
      changeId: changeId ?? undefined,
    };
  },
});

export const deleteMenuItem = defineStoreTool({
  name: "delete_menu_item",
  title: "Remove a menu item",
  description:
    "Remove an item from the menu for good (past orders keep their lines). To take it off sale for a " +
    "while, use update_menu_item with available: false instead. Confirm with the person first.",
  input: z.object({ ...storeIdInput, itemId: z.string() }),
  kind: "write",
  access,
  severity: "CRITICAL",
  hints: { destructiveHint: true, idempotentHint: true },
  handler: async (input, ctx) => {
    const storefront = await storefrontService.getStorefrontByStoreId(ctx.storeId);
    try {
      const row = await storefrontService.deleteMenuItem(input.itemId, storefront.id);
      menuChanged(ctx.storeId, "deleted", row.id);
      return { removed: row.name };
    } catch (error) {
      relayKnownError(error, MENU_ITEM_ERRORS);
    }
  },
});
