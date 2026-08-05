import { Department, type Prisma } from "@prisma/client";

/**
 * Shared `Order` where-clause fragment for the staff/shift filter used
 * across the finance report routes. `shiftId` (a single open-to-close
 * session) takes precedence when present; `staffId` aggregates across all
 * of that staff member's shifts in the queried range.
 */
export function shiftFilter(searchParams: URLSearchParams): Prisma.OrderWhereInput {
  const shiftId = searchParams.get("shiftId");
  if (shiftId) return { shiftId };

  const staffId = searchParams.get("staffId");
  if (staffId) return { shift: { staffMemberId: staffId } };

  return {};
}

/** Sentinel query value for "items with no menu category assigned". */
export const UNCATEGORIZED = "none";

/**
 * `OrderItem` where-clause fragment for the category filter used by
 * top-items and by-category. Items are categorized via
 * OrderItem.menuItem.category — aggregator-imported orders never set
 * menuItemId, so those (and any menu item without a category) fall under
 * the "none" sentinel rather than being silently excluded.
 */
export function categoryFilter(category: string | null): Prisma.OrderItemWhereInput {
  if (!category) return {};
  if (category === UNCATEGORIZED) {
    return { OR: [{ menuItemId: null }, { menuItem: { categoryId: null } }] };
  }
  return { menuItem: { categoryId: category } };
}

/**
 * `OrderItem` where-clause fragment for the Kitchen/Bar department filter —
 * same "none" sentinel convention as `categoryFilter`. `MenuItem.department`
 * is a required field (defaults to Kitchen), so the only way an item has no
 * department is having no linked menuItem at all (aggregator orders).
 */
export function departmentFilter(department: string | null): Prisma.OrderItemWhereInput {
  if (!department) return {};
  if (department === UNCATEGORIZED) {
    return { menuItemId: null };
  }
  return { menuItem: { department: department as Department } };
}
