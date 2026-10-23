// Normalizes two independent sources of selectable variants into one shape
// for display/selection: a Product's material-linked option groups
// (ProductOptionGroup/ProductOption — stock-accurate) and a MenuItem's own
// price-only modifier groups (MenuItem.modifiers Json, legacy
// {name, priceAdd} shape). Merged additively — a menu item shows both its
// linked product's options AND its own modifiers.

export interface MergedOptionValue {
  name: string;
  priceAdjustment: number;
  materialId?: string;
  materialQty?: number;
}

export interface MergedOptionGroup {
  name: string;
  isRequired: boolean;
  maxSelections: number;
  options: MergedOptionValue[];
}

// `{ toString(): string }` (not just number | string) so a Prisma Decimal —
// which serialize* below always resolves through Number()/toString() rather
// than assuming a primitive — can be passed straight from a Prisma query
// result without the caller needing to convert it first.
interface ProductOptionLike {
  name: string;
  priceAdjustment: number | string | { toString(): string };
  materialId?: string | null;
  materialQty?: number | string | { toString(): string } | null;
}

interface ProductOptionGroupLike {
  name: string;
  isRequired: boolean;
  maxSelections: number;
  options: ProductOptionLike[];
}

interface ProductLike {
  optionGroups?: ProductOptionGroupLike[] | null;
}

interface MenuItemLike {
  modifiers?: unknown;
}

import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";

/**
 * MenuItem.modifiers (Json) stores option price deltas under `priceAdd`
 * (see storefront.schemas.ts modifierOptionSchema), while the
 * OptionGroupsEditor/ProductOption shape uses `priceAdjustment`. These two
 * converters translate between them so the Menu Editor can reuse the same
 * editor component as the Product editor.
 */
export function modifiersJsonToOptionGroups(modifiers: unknown): ProductOptionGroupInput[] {
  const raw = Array.isArray(modifiers) ? (modifiers as unknown[]) : [];
  return raw.map((entry) => {
    const group = entry as {
      name?: string;
      isRequired?: boolean;
      maxSelections?: number;
      options?: Array<{ name?: string; priceAdd?: number }>;
    };
    return {
      name: group.name ?? "",
      isRequired: !!group.isRequired,
      maxSelections: group.maxSelections || 1,
      options: (group.options ?? []).map((option) => ({
        name: option.name ?? "",
        priceAdjustment: Number(option.priceAdd) || 0,
      })),
    };
  });
}

/** At least one step with a name and a named choice: what a BYO item needs. */
export function hasBuildStep(groups: ProductOptionGroupInput[]): boolean {
  return groups.some((g) => g.name.trim() && g.options.some((o) => o.name.trim()));
}

/** Whether any choice takes a raw material from stock when it is sold. */
export function hasLinkedMaterial(groups: ProductOptionGroupInput[]): boolean {
  return groups.some((g) => g.options.some((o) => o.materialId && o.materialQty));
}

export function optionGroupsToModifiersJson(groups: ProductOptionGroupInput[]) {
  return groups
    .filter((group) => group.name.trim() && group.options.some((o) => o.name.trim()))
    .map((group) => ({
      name: group.name,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections,
      options: group.options
        .filter((option) => option.name.trim())
        .map((option) => ({ name: option.name, priceAdd: option.priceAdjustment })),
    }));
}

/**
 * Converts a Product's optionGroups straight off Prisma (Decimal
 * priceAdjustment/materialQty) into plain-number form, for passing from a
 * Server Component into a Client Component prop — mirrors the existing
 * `price: Number(item.price)` conversion already done alongside it.
 */
export function serializeProductOptionGroups(
  optionGroups: ProductOptionGroupLike[] | null | undefined
) {
  return (optionGroups ?? []).map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceAdjustment: Number(option.priceAdjustment) || 0,
      materialId: option.materialId ?? null,
      materialQty: option.materialQty != null ? Number(option.materialQty) : null,
    })),
  }));
}

/**
 * Whether an item is sold as "Build Your Own": its option groups are shown as
 * numbered steps. Set by the owner (off by default). A menu item linked to a
 * product takes its option groups from that product, so either flag counts.
 */
export function isBuildYourOwnItem(
  menuItem: { buildYourOwn?: boolean | null } | null | undefined,
  product?: { buildYourOwn?: boolean | null } | null
): boolean {
  return !!menuItem?.buildYourOwn || !!product?.buildYourOwn;
}

/**
 * The selection after tapping `option` in a group. One shared rule for the
 * till and both storefront pickers:
 * - pick 1 groups behave like radio buttons (tap again to clear);
 * - pick N groups toggle the option. When the group is full, a Build Your
 *   Own step refuses the extra pick (`capAtMax`), so the customer sees the
 *   limit instead of losing an earlier choice; other groups drop the oldest
 *   pick, as they always have.
 */
export function toggleOptionSelection<T>(
  current: T[],
  option: T,
  isSame: (a: T, b: T) => boolean,
  maxSelections: number,
  { capAtMax = false }: { capAtMax?: boolean } = {}
): T[] {
  const isSelected = current.some((o) => isSame(o, option));
  if (maxSelections <= 1) return isSelected ? [] : [option];
  if (isSelected) return current.filter((o) => !isSame(o, option));
  if (current.length < maxSelections) return [...current, option];
  return capAtMax ? current : [...current.slice(1), option];
}

/** The first required group nothing was picked in, or null. */
export function firstMissingRequiredGroup(
  groups: Array<{ name: string; isRequired?: boolean }>,
  selectedByGroup: Record<string, unknown[] | undefined>
): string | null {
  const missing = groups.find((g) => g.isRequired && (selectedByGroup[g.name]?.length ?? 0) === 0);
  return missing?.name ?? null;
}

// A type alias, not an interface, so it can be stored as Prisma JSON.
export type SelectedOptionLike = {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
  materialId?: string;
  materialQty?: number;
};

export type OptionResolutionProblem = "UNKNOWN_OPTION" | "TOO_MANY" | "MISSING_REQUIRED";

/**
 * Rebuilds a line's selected options from the item's real option groups, so
 * an order never trusts the price or stock link the browser sent. Each option
 * is matched by group and option name; its price and material link come from
 * the menu, never from the request.
 *
 * - "strict" (public storefront orders): an option the item does not have, a
 *   group over its limit, or a required group left empty makes the line
 *   invalid (`problem`). Nothing is dropped silently.
 * - "lenient" (the till): a cashier's line is kept even when the menu changed
 *   after it was rung up (held orders, offline replay). A matched option is
 *   still repriced from the menu; an option the menu no longer has keeps the
 *   name and price that were charged but loses any stock link.
 */
export function resolveSelectedOptions(
  groups: MergedOptionGroup[],
  selected: SelectedOptionLike[] | null | undefined,
  mode: "strict" | "lenient"
): { options: SelectedOptionLike[]; problem: OptionResolutionProblem | null } {
  // Same-named groups (a product group and a menu item's own group can share
  // a name) are one group to the pickers, which key selections by name.
  const byName = new Map<string, MergedOptionGroup>();
  for (const g of groups) {
    const prev = byName.get(g.name);
    byName.set(
      g.name,
      prev
        ? {
            name: g.name,
            isRequired: prev.isRequired || g.isRequired,
            maxSelections: Math.max(prev.maxSelections, g.maxSelections),
            options: [...prev.options, ...g.options],
          }
        : g
    );
  }

  const options: SelectedOptionLike[] = [];
  const countByGroup = new Map<string, number>();
  const seen = new Set<string>();

  for (const sel of selected ?? []) {
    const key = `${sel.groupName}\u0000${sel.optionName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const group = byName.get(sel.groupName);
    const match = group?.options.find((o) => o.name === sel.optionName);
    if (!group || !match) {
      if (mode === "strict") return { options: [], problem: "UNKNOWN_OPTION" };
      options.push({
        groupName: sel.groupName,
        optionName: sel.optionName,
        priceAdjustment: sel.priceAdjustment,
      });
      continue;
    }

    countByGroup.set(group.name, (countByGroup.get(group.name) ?? 0) + 1);
    options.push({
      groupName: group.name,
      optionName: match.name,
      priceAdjustment: match.priceAdjustment,
      ...(match.materialId && match.materialQty
        ? { materialId: match.materialId, materialQty: match.materialQty }
        : {}),
    });
  }

  if (mode === "strict") {
    for (const group of byName.values()) {
      const count = countByGroup.get(group.name) ?? 0;
      if (count > Math.max(1, group.maxSelections)) return { options: [], problem: "TOO_MANY" };
      if (group.isRequired && count === 0) return { options: [], problem: "MISSING_REQUIRED" };
    }
  }

  return { options, problem: null };
}

export function getMergedOptionGroups(
  menuItem: MenuItemLike | null | undefined,
  product?: ProductLike | null
): MergedOptionGroup[] {
  const productGroups: MergedOptionGroup[] = (product?.optionGroups ?? []).map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceAdjustment: Number(option.priceAdjustment) || 0,
      materialId: option.materialId ?? undefined,
      materialQty: option.materialQty != null ? Number(option.materialQty) : undefined,
    })),
  }));

  const rawModifiers = Array.isArray(menuItem?.modifiers) ? (menuItem!.modifiers as unknown[]) : [];
  const menuItemGroups: MergedOptionGroup[] = rawModifiers.map((raw) => {
    const group = raw as {
      name: string;
      isRequired?: boolean;
      maxSelections?: number;
      options?: Array<{ name: string; priceAdd?: number; priceAdjustment?: number }>;
    };
    return {
      name: group.name,
      isRequired: !!group.isRequired,
      maxSelections: group.maxSelections || 1,
      options: (group.options ?? []).map((option) => ({
        name: option.name,
        priceAdjustment: Number(option.priceAdd ?? option.priceAdjustment) || 0,
      })),
    };
  });

  return [...productGroups, ...menuItemGroups];
}
