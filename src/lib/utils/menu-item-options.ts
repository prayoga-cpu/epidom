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
