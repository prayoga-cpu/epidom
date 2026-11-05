import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { Refusal } from "./catalog-types";

/**
 * Undo for menu changes (items, categories, a product's option groups): the
 * before-image each change records, and the inverse that restores it.
 *
 * The Layer 2 catalogue (catalog.ts) entries `menu.items.change`,
 * `menu.categories.change` and `menu.product_options.change` are built from
 * the schemas and handlers here. They are REVERSIBLE only while nothing has
 * touched the same rows since: each precheck compares the live rows with the
 * after-image the change left and refuses (with a reason a person can act on)
 * if they differ, so an undo never overwrites a newer edit.
 */

type Db = PrismaClient | Prisma.TransactionClient;

// Money as a plain decimal string, like the rest of the catalogue.
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, "Decimal must be a plain numeric string");

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const menuItemStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: decimalString,
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  department: z.enum(["KITCHEN", "BAR", "BOTH"]),
  isAvailable: z.boolean(),
  showOnCashier: z.boolean(),
  isFeatured: z.boolean(),
  productId: z.string().nullable(),
  buildYourOwn: z.boolean(),
  modifiers: z.unknown().nullable(),
});
export type MenuItemState = z.infer<typeof menuItemStateSchema>;

export const menuItemsChangeSchema = z.object({
  storeId: z.string(),
  storefrontId: z.string(),
  summary: z.string(),
  updated: z.array(z.object({ before: menuItemStateSchema, after: menuItemStateSchema })),
  created: z.array(menuItemStateSchema),
});
export type MenuItemsChange = z.infer<typeof menuItemsChangeSchema>;

/** A menu item row, as the fields an undo restores. */
export function toItemState(row: {
  id: string;
  name: string;
  price: { toFixed: (digits: number) => string };
  description: string | null;
  categoryId: string | null;
  department: "KITCHEN" | "BAR" | "BOTH";
  isAvailable: boolean;
  showOnCashier: boolean;
  isFeatured: boolean;
  productId: string | null;
  buildYourOwn: boolean;
  modifiers: unknown;
}): MenuItemState {
  return {
    id: row.id,
    name: row.name,
    price: row.price.toFixed(2),
    description: row.description,
    categoryId: row.categoryId,
    department: row.department,
    isAvailable: row.isAvailable,
    showOnCashier: row.showOnCashier,
    isFeatured: row.isFeatured,
    productId: row.productId,
    buildYourOwn: row.buildYourOwn,
    modifiers: row.modifiers ?? null,
  };
}

/** JSON with sorted keys, so two equal values compare equal whatever order a database returned them in. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : v
  );
}

const sameState = (a: unknown, b: unknown) => stable(a) === stable(b);

function itemData(state: MenuItemState): Prisma.MenuItemUncheckedUpdateInput {
  return {
    name: state.name,
    price: new Prisma.Decimal(state.price),
    description: state.description,
    categoryId: state.categoryId,
    department: state.department,
    isAvailable: state.isAvailable,
    showOnCashier: state.showOnCashier,
    isFeatured: state.isFeatured,
    productId: state.productId,
    buildYourOwn: state.buildYourOwn,
    modifiers:
      state.modifiers === null || state.modifiers === undefined
        ? Prisma.DbNull
        : (state.modifiers as Prisma.InputJsonValue),
  };
}

export async function precheckMenuItems(
  payload: MenuItemsChange,
  db: PrismaClient
): Promise<Refusal | null> {
  const expected = [...payload.updated.map((u) => u.after), ...payload.created];
  const live = await db.menuItem.findMany({
    where: { id: { in: expected.map((s) => s.id) }, storefrontId: payload.storefrontId },
  });
  const byId = new Map(live.map((row) => [row.id, toItemState(row)]));

  for (const state of expected) {
    const current = byId.get(state.id);
    if (!current) {
      return {
        code: "TARGET_MISSING",
        message: `"${state.name}" no longer exists on the menu, so this change can't be undone cleanly.`,
      };
    }
    if (!sameState(current, state)) {
      return {
        code: "SUPERSEDED",
        message: `"${current.name}" has been changed since. Undoing would overwrite that newer edit: change it back by hand, or undo the newer change first.`,
      };
    }
  }

  // Restoring needs the category and the product an item pointed at to still exist.
  const categoryIds = [
    ...new Set(payload.updated.flatMap((u) => (u.before.categoryId ? [u.before.categoryId] : []))),
  ];
  if (categoryIds.length > 0) {
    const found = await db.menuCategory.count({ where: { id: { in: categoryIds } } });
    if (found !== categoryIds.length) {
      return {
        code: "TARGET_MISSING",
        message:
          "A category these items used to be in has been removed since. Undo the category change first.",
      };
    }
  }
  const productIds = [
    ...new Set(payload.updated.flatMap((u) => (u.before.productId ? [u.before.productId] : []))),
  ];
  if (productIds.length > 0) {
    const found = await db.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) {
      return {
        code: "TARGET_MISSING",
        message: "A product these items used to be linked to no longer exists.",
      };
    }
  }
  return null;
}

export async function reverseMenuItems(payload: MenuItemsChange, tx: Db): Promise<void> {
  for (const { before } of payload.updated) {
    await tx.menuItem.update({ where: { id: before.id }, data: itemData(before) });
  }
  if (payload.created.length > 0) {
    await tx.menuItem.deleteMany({
      where: { id: { in: payload.created.map((c) => c.id) }, storefrontId: payload.storefrontId },
    });
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const menuCategoryStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayOrder: z.number().int(),
});

export const menuCategoriesChangeSchema = z.object({
  storeId: z.string(),
  storefrontId: z.string(),
  action: z.enum(["rename", "reorder", "merge_into", "delete_if_empty"]),
  summary: z.string(),
  before: z.array(menuCategoryStateSchema),
  after: z.array(menuCategoryStateSchema),
  /** Categories this change removed, with the items they held. */
  removed: z.array(menuCategoryStateSchema.extend({ itemIds: z.array(z.string()) })),
  /** For merge_into: where the removed category's items went. */
  movedTo: z.string().nullable(),
});
export type MenuCategoriesChange = z.infer<typeof menuCategoriesChangeSchema>;

export async function precheckMenuCategories(
  payload: MenuCategoriesChange,
  db: PrismaClient
): Promise<Refusal | null> {
  const live = await db.menuCategory.findMany({
    where: { storefrontId: payload.storefrontId },
    select: { id: true, name: true, displayOrder: true },
  });
  const liveById = new Map(live.map((c) => [c.id, c]));

  for (const category of payload.after) {
    const current = liveById.get(category.id);
    if (!current) {
      return {
        code: "TARGET_MISSING",
        message: `The category "${category.name}" no longer exists.`,
      };
    }
    if (current.name !== category.name || current.displayOrder !== category.displayOrder) {
      return {
        code: "SUPERSEDED",
        message: `The category "${current.name}" has been renamed or moved since. Undoing would overwrite that newer change.`,
      };
    }
  }
  for (const category of payload.removed) {
    if (liveById.has(category.id)) {
      return {
        code: "UNIQUE_COLLISION",
        message: `The category "${category.name}" is already back, so there is nothing to restore.`,
      };
    }
  }
  if (payload.movedTo) {
    const moved = payload.removed.flatMap((c) => c.itemIds);
    if (moved.length > 0) {
      const stillThere = await db.menuItem.count({
        where: { id: { in: moved }, categoryId: payload.movedTo },
      });
      if (stillThere !== moved.length) {
        return {
          code: "SUPERSEDED",
          message:
            "Some of the merged items have been moved or removed since, so the merge can't be undone cleanly.",
        };
      }
    }
  }
  return null;
}

export async function reverseMenuCategories(payload: MenuCategoriesChange, tx: Db): Promise<void> {
  for (const category of payload.removed) {
    await tx.menuCategory.create({
      data: {
        id: category.id,
        storefrontId: payload.storefrontId,
        name: category.name,
        displayOrder: category.displayOrder,
      },
    });
    if (category.itemIds.length > 0) {
      await tx.menuItem.updateMany({
        where: { id: { in: category.itemIds }, storefrontId: payload.storefrontId },
        data: { categoryId: category.id },
      });
    }
  }
  const removedIds = new Set(payload.removed.map((c) => c.id));
  for (const category of payload.before) {
    if (removedIds.has(category.id)) continue;
    await tx.menuCategory.update({
      where: { id: category.id },
      data: { name: category.name, displayOrder: category.displayOrder },
    });
  }
}

// ---------------------------------------------------------------------------
// A product's option groups
// ---------------------------------------------------------------------------

export const optionGroupStateSchema = z.object({
  name: z.string(),
  isRequired: z.boolean(),
  maxSelections: z.number().int(),
  options: z.array(
    z.object({
      name: z.string(),
      priceAdjustment: decimalString,
      materialId: z.string().nullable(),
      materialQty: decimalString.nullable(),
    })
  ),
});
export type OptionGroupState = z.infer<typeof optionGroupStateSchema>;

export const menuProductOptionsChangeSchema = z.object({
  storeId: z.string(),
  productId: z.string(),
  productName: z.string(),
  before: z.array(optionGroupStateSchema),
  after: z.array(optionGroupStateSchema),
  beforeBuildYourOwn: z.boolean(),
  afterBuildYourOwn: z.boolean(),
});
export type MenuProductOptionsChange = z.infer<typeof menuProductOptionsChangeSchema>;

/** A product's option groups in display order, as the fields an undo restores. */
export async function readOptionGroups(db: Db, productId: string): Promise<OptionGroupState[]> {
  const groups = await db.productOptionGroup.findMany({
    where: { productId },
    orderBy: { displayOrder: "asc" },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });
  return groups.map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceAdjustment: option.priceAdjustment.toFixed(2),
      materialId: option.materialId,
      materialQty: option.materialQty ? option.materialQty.toFixed(3) : null,
    })),
  }));
}

/** The same groups from what a tool is about to write, in the stored form. */
export function toGroupState(
  groups: Array<{
    name: string;
    isRequired: boolean;
    maxSelections: number;
    options: Array<{
      name: string;
      priceAdjustment: number;
      materialId?: string | null;
      materialQty?: number | null;
    }>;
  }>
): OptionGroupState[] {
  return groups.map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceAdjustment: new Prisma.Decimal(option.priceAdjustment).toFixed(2),
      materialId: option.materialId ?? null,
      materialQty:
        option.materialId && option.materialQty != null
          ? new Prisma.Decimal(option.materialQty).toFixed(3)
          : null,
    })),
  }));
}

export async function precheckProductOptions(
  payload: MenuProductOptionsChange,
  db: PrismaClient
): Promise<Refusal | null> {
  const product = await db.product.findFirst({
    where: { id: payload.productId, storeId: payload.storeId },
    select: { id: true, buildYourOwn: true },
  });
  if (!product) {
    return {
      code: "TARGET_MISSING",
      message: `The product "${payload.productName}" no longer exists.`,
    };
  }
  const live = await readOptionGroups(db, payload.productId);
  if (!sameState(live, payload.after) || product.buildYourOwn !== payload.afterBuildYourOwn) {
    return {
      code: "SUPERSEDED",
      message: `The options of "${payload.productName}" have been changed since. Undoing would overwrite that newer edit.`,
    };
  }
  const materialIds = [
    ...new Set(
      payload.before.flatMap((g) => g.options.flatMap((o) => (o.materialId ? [o.materialId] : [])))
    ),
  ];
  if (materialIds.length > 0) {
    const found = await db.material.count({
      where: { id: { in: materialIds }, storeId: payload.storeId },
    });
    if (found !== materialIds.length) {
      return {
        code: "TARGET_MISSING",
        message: "A raw material the previous options used no longer exists.",
      };
    }
  }
  return null;
}

export async function reverseProductOptions(
  payload: MenuProductOptionsChange,
  tx: Db
): Promise<void> {
  await tx.productOptionGroup.deleteMany({ where: { productId: payload.productId } });
  for (const [groupIndex, group] of payload.before.entries()) {
    await tx.productOptionGroup.create({
      data: {
        productId: payload.productId,
        name: group.name,
        isRequired: group.isRequired,
        maxSelections: group.maxSelections,
        displayOrder: groupIndex,
        options: {
          create: group.options.map((option, optionIndex) => ({
            name: option.name,
            priceAdjustment: new Prisma.Decimal(option.priceAdjustment),
            materialId: option.materialId,
            materialQty: option.materialQty ? new Prisma.Decimal(option.materialQty) : null,
            displayOrder: optionIndex,
          })),
        },
      },
    });
  }
  await tx.product.update({
    where: { id: payload.productId },
    data: { buildYourOwn: payload.beforeBuildYourOwn },
  });
}
