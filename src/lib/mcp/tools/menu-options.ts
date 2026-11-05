import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { modifierSchema } from "@/lib/validation/storefront.schemas";
import { getMergedOptionGroups, type MergedOptionGroup } from "@/lib/utils/menu-item-options";
import { McpToolError } from "../errors";
import { money } from "./shared";

/**
 * Option groups ("à composer" / Build Your Own) as the connector shows and
 * accepts them.
 *
 * How Epidom stores them, which decides what a tool can promise:
 * - A menu item's OWN groups are `MenuItem.modifiers` (price-only choices).
 * - A linked product's groups are `ProductOptionGroup`/`ProductOption`; only
 *   those can link a choice to a raw MATERIAL (with a quantity) so selling it
 *   deducts stock. Both sets are shown together on the till and the storefront.
 * - A group has `isRequired` (at least one pick) and `maxSelections` (a whole
 *   number, at least 1). There is no "pick at least two", no "unlimited", no
 *   per-choice sold-out flag and no pre-selected choice.
 */

/** One choice, as a tool takes it. Either typed, or copied from an existing menu item. */
export const optionInput = z.object({
  name: z.string().min(1).max(100).optional().describe("Label. Optional with fromMenuItemId."),
  priceDelta: z
    .number()
    .min(0)
    .optional()
    .describe(
      "Extra price in the store's currency. With fromMenuItemId it replaces that item's price."
    ),
  fromMenuItemId: z
    .string()
    .optional()
    .describe(
      "Copy name and price from an existing menu item (from get_menu). Only name and price are " +
        "copied: the choice does NOT inherit that item's inventory link."
    ),
});

export const optionGroupInput = z.object({
  name: z.string().min(1).max(100).describe('e.g. "Base", "Protein".'),
  required: z.boolean().optional().describe("The customer must pick at least one. Default false."),
  minSelect: z
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe("0 or 1 only (same as required). Epidom can't require two or more picks."),
  maxSelect: z
    .number()
    .int()
    .min(1)
    .max(50)
    .nullable()
    .optional()
    .describe("How many choices may be picked. Default 1. null = as many as the group has."),
  options: z.array(optionInput).min(1).max(60),
});

export type OptionGroupInput = z.infer<typeof optionGroupInput>;

export interface ResolvedGroups {
  /** The `MenuItem.modifiers` value. */
  modifiers: Array<{
    name: string;
    isRequired: boolean;
    maxSelections: number;
    options: Array<{ name: string; priceAdd: number }>;
  }>;
  warnings: string[];
}

/** Groups and choices shaped as a tool returns them (and get_menu shows them). */
export function describeGroups(groups: MergedOptionGroup[]) {
  return groups.map((group) => ({
    name: group.name,
    required: group.isRequired,
    maxSelect: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceDelta: money(option.priceAdjustment),
      stockLinked: Boolean(option.materialId && option.materialQty) || undefined,
    })),
  }));
}

/** The groups a menu item sells with: its linked product's plus its own. */
export function mergedGroupsOf(item: {
  modifiers: unknown;
  product?: {
    optionGroups: Array<{
      name: string;
      isRequired: boolean;
      maxSelections: number;
      options: Array<{
        name: string;
        priceAdjustment: unknown;
        materialId: string | null;
        materialQty: unknown;
      }>;
    }>;
  } | null;
}): MergedOptionGroup[] {
  return getMergedOptionGroups(
    { modifiers: item.modifiers },
    item.product
      ? {
          optionGroups: item.product.optionGroups.map((group) => ({
            ...group,
            options: group.options.map((option) => ({
              name: option.name,
              priceAdjustment: option.priceAdjustment as number,
              materialId: option.materialId,
              materialQty: option.materialQty as number | null,
            })),
          })),
        }
      : null
  );
}

/**
 * Turn the groups a person described into `MenuItem.modifiers`, copying
 * name and price from the menu items named by fromMenuItemId. Refuses what
 * Epidom can't represent instead of quietly approximating it.
 */
export async function resolveOptionGroups(
  storefrontId: string,
  groups: OptionGroupInput[]
): Promise<ResolvedGroups> {
  const wanted = [
    ...new Set(
      groups.flatMap((g) => g.options.map((o) => o.fromMenuItemId).filter(Boolean) as string[])
    ),
  ];
  const sources = wanted.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: wanted }, storefrontId },
        select: { id: true, name: true, price: true, productId: true },
      })
    : [];
  const byId = new Map(sources.map((item) => [item.id, item]));
  const missing = wanted.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new McpToolError(
      "NOT_FOUND",
      `No menu item with id ${missing.slice(0, 5).join(", ")} in this store. Use get_menu for the ids.`
    );
  }

  const warnings: string[] = [];
  const seenGroups = new Set<string>();
  const modifiers: ResolvedGroups["modifiers"] = groups.map((group) => {
    const groupKey = group.name.trim().toLowerCase();
    if (seenGroups.has(groupKey)) {
      throw new McpToolError("INVALID_INPUT", `Two groups are called "${group.name}".`);
    }
    seenGroups.add(groupKey);

    if ((group.minSelect ?? 0) > 1) {
      throw new McpToolError(
        "UNSUPPORTED",
        `Group "${group.name}": Epidom can only require "at least one" pick (required: true), not ` +
          `${group.minSelect}. Make it required, or leave it optional.`
      );
    }
    const required = group.required ?? (group.minSelect ?? 0) >= 1;

    const seenOptions = new Set<string>();
    const options = group.options.map((option) => {
      const source = option.fromMenuItemId ? byId.get(option.fromMenuItemId) : undefined;
      const name = (option.name ?? source?.name ?? "").trim();
      if (!name) {
        throw new McpToolError(
          "INVALID_INPUT",
          `Group "${group.name}": every choice needs a name or a fromMenuItemId.`
        );
      }
      const key = name.toLowerCase();
      if (seenOptions.has(key)) {
        throw new McpToolError(
          "INVALID_INPUT",
          `Group "${group.name}" lists "${name}" twice. Choice names must be unique within a group.`
        );
      }
      seenOptions.add(key);
      if (source?.productId) {
        warnings.push(
          `"${name}" was copied from a menu item linked to inventory. As a choice it is price-only: ` +
            "selling it will NOT deduct that stock until it is linked to a raw material " +
            "(set_product_options)."
        );
      }
      return {
        name,
        priceAdd: option.priceDelta ?? (source ? Number(source.price) : 0),
      };
    });

    return {
      name: group.name.trim(),
      isRequired: required,
      maxSelections: group.maxSelect === null ? options.length : (group.maxSelect ?? 1),
      options,
    };
  });

  const parsed = z.array(modifierSchema).safeParse(modifiers);
  if (!parsed.success) {
    throw new McpToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
  }
  return { modifiers, warnings: [...new Set(warnings)] };
}
