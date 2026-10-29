import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services/storefront.service";
import { createMenuItemSchema, updateMenuItemSchema } from "@/lib/validation/storefront.schemas";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { defineStoreTool } from "../define-tool";
import { McpToolError, relayKnownError } from "../errors";
import { money, PAGES, storeIdInput } from "./shared";

/**
 * Menu items (what the till and the storefront sell). MenuItem.price is a
 * literal amount in the store's own currency — never converted.
 */

const access = { pages: PAGES.menu } as const;

const MENU_ITEM_ERRORS = [
  [
    /not found or does not belong/i,
    "NOT_FOUND",
    "No such menu item in this store. Use get_menu for the ids.",
  ],
] as const;

function menuChanged(storeId: string, action: "created" | "updated" | "deleted", entityId: string) {
  publishStoreEvent(storeId, REALTIME_EVENTS.MENU_CHANGED, { action, entityId });
}

export const getMenu = defineStoreTool({
  name: "get_menu",
  title: "Menu",
  description:
    "The store's menu by category, in display order: each item's id, price (store currency), " +
    "description, whether it is available (in stock / on sale today), shown on the till, featured, and " +
    "whether it is linked to an inventory product (so selling it deducts stock).",
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
      },
    });

    const shape = (item: (typeof items)[number]) => ({
      itemId: item.id,
      name: item.name,
      price: money(item.price),
      description: item.description || undefined,
      department: item.department,
      available: item.isAvailable,
      onTill: item.showOnCashier,
      featured: item.isFeatured || undefined,
      linkedProductId: item.productId ?? undefined,
      buildYourOwn: item.buildYourOwn || undefined,
    });

    const categories = storefront.menuCategories.map((category) => ({
      categoryId: category.id,
      name: category.name,
      items: items.filter((item) => item.categoryId === category.id).map(shape),
    }));
    const uncategorized = items.filter((item) => item.categoryId === null).map(shape);
    if (uncategorized.length > 0) {
      categories.push({ categoryId: "", name: "Uncategorized", items: uncategorized });
    }
    return { currency: finance.currency, categories };
  },
});

const newItem = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).describe("In the store's currency."),
  category: z.string().max(100).optional().describe("Category name; created if it doesn't exist."),
  description: z.string().max(300).optional(),
  department: z
    .enum(["KITCHEN", "BAR"])
    .optional()
    .describe("Where it is prepared (kitchen ticket or bar)."),
  available: z.boolean().optional().describe("Default true."),
  featured: z.boolean().optional(),
});

export const createMenuItems = defineStoreTool({
  name: "create_menu_items",
  title: "Add menu items",
  description:
    "Add up to 50 items to the menu in one call (e.g. read from a menu photo). Each needs a name and a " +
    "price in the store's currency; a category name is matched case-insensitively or created. Items " +
    "whose name already exists on the menu are skipped unless allowDuplicates is true. New items are " +
    "standalone (not linked to inventory); to track stock, use upsert_product instead.",
  input: z.object({
    ...storeIdInput,
    items: z.array(newItem).min(1).max(50),
    allowDuplicates: z.boolean().default(false),
  }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const storefront = await storefrontService.getStorefrontByStoreId(ctx.storeId);
    const existing = new Set(
      (
        await prisma.menuItem.findMany({
          where: { storefrontId: storefront.id },
          select: { name: true },
        })
      ).map((item) => item.name.trim().toLowerCase())
    );

    const created: Array<{ itemId: string; name: string; price: string; category: string | null }> =
      [];
    const skipped: Array<{ name: string; reason: string }> = [];
    const categoryIds = new Map<string, string | null>();

    for (const item of input.items) {
      const key = item.name.trim().toLowerCase();
      if (!input.allowDuplicates && existing.has(key)) {
        skipped.push({ name: item.name, reason: "already on the menu" });
        continue;
      }

      const categoryKey = item.category?.trim().toLowerCase() ?? "";
      if (!categoryIds.has(categoryKey)) {
        categoryIds.set(
          categoryKey,
          await storefrontService.resolveMenuCategoryId(ctx.storeId, item.category?.trim() || null)
        );
      }

      const parsed = createMenuItemSchema.safeParse({
        name: item.name.trim(),
        price: item.price,
        categoryId: categoryIds.get(categoryKey) ?? null,
        description: item.description ?? "",
        department: item.department ?? "KITCHEN",
        isAvailable: item.available ?? true,
        isFeatured: item.featured ?? false,
      });
      if (!parsed.success) {
        skipped.push({
          name: item.name,
          reason: parsed.error.issues.map((i) => i.message).join("; "),
        });
        continue;
      }

      const row = await storefrontService.createMenuItem(storefront.id, parsed.data);
      existing.add(key);
      menuChanged(ctx.storeId, "created", row.id);
      created.push({
        itemId: row.id,
        name: row.name,
        price: money(row.price),
        category: item.category?.trim() || null,
      });
    }

    return { created, skipped };
  },
});

export const updateMenuItem = defineStoreTool({
  name: "update_menu_item",
  title: "Change a menu item",
  description:
    "Change one menu item: name, price (store currency), description, category, availability (mark " +
    "sold out or back on sale), whether it shows on the till, or featured. Only the fields given change.",
  input: z.object({
    ...storeIdInput,
    itemId: z.string(),
    name: z.string().min(1).max(100).optional(),
    price: z.number().min(0).optional(),
    description: z.string().max(300).optional(),
    category: z
      .string()
      .max(100)
      .nullable()
      .optional()
      .describe("Category name, or null for none."),
    available: z.boolean().optional(),
    onTill: z.boolean().optional(),
    featured: z.boolean().optional(),
  }),
  kind: "write",
  access,
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    const storefront = await storefrontService.getStorefrontByStoreId(ctx.storeId);
    const categoryId =
      input.category === undefined
        ? undefined
        : await storefrontService.resolveMenuCategoryId(
            ctx.storeId,
            input.category?.trim() || null
          );

    const parsed = updateMenuItemSchema.safeParse({
      name: input.name?.trim(),
      price: input.price,
      description: input.description,
      categoryId,
      isAvailable: input.available,
      showOnCashier: input.onTill,
      isFeatured: input.featured,
    });
    if (!parsed.success) {
      throw new McpToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
    }
    // updateMenuItemSchema is .partial() over fields with defaults, so a
    // field left out would come back as its default: keep only what was given.
    const given = Object.fromEntries(
      Object.entries({
        name: input.name?.trim(),
        price: parsed.data.price,
        description: input.description,
        categoryId,
        isAvailable: input.available,
        showOnCashier: input.onTill,
        isFeatured: input.featured,
      }).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(given).length === 0) {
      throw new McpToolError("INVALID_INPUT", "Nothing to change: give at least one field.");
    }

    try {
      const row = await storefrontService.updateMenuItem(input.itemId, storefront.id, given);
      menuChanged(ctx.storeId, "updated", row.id);
      return {
        itemId: row.id,
        name: row.name,
        price: money(row.price),
        available: row.isAvailable,
        onTill: row.showOnCashier,
        featured: row.isFeatured,
      };
    } catch (error) {
      relayKnownError(error, MENU_ITEM_ERRORS);
    }
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
