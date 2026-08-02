/**
 * Pure aggregation/bucketing helpers for the finance report routes. Kept
 * DB-free (plain data in, plain data out) so they're directly unit-testable
 * without mocking Prisma — see __tests__/by-category.test.ts and
 * __tests__/by-shift.test.ts.
 */

export interface CategoryBucketInput {
  total: number | string;
  quantity: number | string;
  menuItem: { category: { id: string; name: string } | null } | null;
}

export interface CategoryBucket {
  categoryId: string | null;
  categoryName: string;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

/**
 * Buckets order items by menu category. Items with no menuItem at all
 * (aggregator-email orders never set one) or a menuItem with no category
 * assigned both fall under "Uncategorized" rather than being dropped.
 */
export function bucketItemsByCategory(items: CategoryBucketInput[]): CategoryBucket[] {
  const buckets = new Map<string, CategoryBucket>();

  for (const item of items) {
    const category = item.menuItem?.category ?? null;
    const key = category?.id ?? "none";
    const bucket = buckets.get(key) ?? {
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? "Uncategorized",
      orderItemCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
    };
    bucket.orderItemCount += 1;
    bucket.totalQuantity += Number(item.quantity);
    bucket.totalRevenue += Number(item.total);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((b) => ({ ...b, totalRevenue: Math.round(b.totalRevenue * 100) / 100 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export type DepartmentValue = "KITCHEN" | "BAR";

export interface DepartmentBucketInput {
  total: number | string;
  quantity: number | string;
  menuItem: { department: DepartmentValue | null } | null;
}

export interface DepartmentBucket {
  department: DepartmentValue | null;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

/**
 * Buckets order items by Kitchen/Bar department. Items with no menuItem at
 * all (aggregator-email orders) or a menuItem with no department assigned
 * both fall under the `null` "Unassigned" bucket rather than being dropped.
 */
export function bucketItemsByDepartment(items: DepartmentBucketInput[]): DepartmentBucket[] {
  const buckets = new Map<string, DepartmentBucket>();

  for (const item of items) {
    const department = item.menuItem?.department ?? null;
    const key = department ?? "UNASSIGNED";
    const bucket = buckets.get(key) ?? {
      department,
      orderItemCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
    };
    bucket.orderItemCount += 1;
    bucket.totalQuantity += Number(item.quantity);
    bucket.totalRevenue += Number(item.total);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((b) => ({ ...b, totalRevenue: Math.round(b.totalRevenue * 100) / 100 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface ShiftGroupInput {
  shiftId: string | null;
  _sum: { total: number | string | null };
  _count: { id: number };
}

export interface ShiftLookup {
  id: string;
  openedAt: Date | string;
  closedAt: Date | string | null;
  staffMember: { id: string; name: string };
}

export interface ShiftRow {
  shiftId: string | null;
  staffName: string;
  staffId: string | null;
  openedAt: string | null;
  closedAt: string | null;
  isOpen: boolean;
  orderCount: number;
  revenue: number;
}

/**
 * Attaches staff/session info to a per-shift order-groupBy result. Orders
 * with no shiftId (storefront/online sales, never tied to a POS session)
 * are kept as a single "Unassigned" row (shiftId: null) rather than dropped.
 */
export function buildShiftRows(grouped: ShiftGroupInput[], shifts: ShiftLookup[]): ShiftRow[] {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));

  const rows = grouped.map((g) => {
    const shift = g.shiftId ? shiftMap.get(g.shiftId) : undefined;
    return {
      shiftId: g.shiftId,
      staffName: shift?.staffMember.name ?? "Unassigned",
      staffId: shift?.staffMember.id ?? null,
      openedAt: shift ? new Date(shift.openedAt).toISOString() : null,
      closedAt: shift?.closedAt ? new Date(shift.closedAt).toISOString() : null,
      isOpen: shift ? shift.closedAt === null : false,
      orderCount: g._count.id,
      revenue: Math.round(Number(g._sum.total ?? 0) * 100) / 100,
    };
  });

  return rows.sort((a, b) => b.revenue - a.revenue);
}
