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

// "CUSTOM" is the optional second product line (Product.productLine) — not
// a real stored department, routed here by the call site (see
// by-department/route.ts) rather than the actual DB department field.
export type DepartmentValue = "KITCHEN" | "BAR" | "CUSTOM";

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

export interface WasteBucketInput {
  reason: string;
  customReason: string | null;
  quantity: number | string;
  totalValue: number | string;
}

export interface WasteBucket {
  reason: string;
  label: string;
  entryCount: number;
  totalQuantity: number;
  totalValue: number;
}

/**
 * Buckets waste entries by reason. OTHER entries keep their customReason as
 * the display label (falling back to "Other" if somehow blank) so distinct
 * custom reasons don't get silently merged into one bucket, while all
 * predefined reasons group normally by their enum value.
 */
export function bucketWasteByReason(entries: WasteBucketInput[]): WasteBucket[] {
  const buckets = new Map<string, WasteBucket>();

  for (const entry of entries) {
    const isOther = entry.reason === "OTHER";
    const label = isOther ? entry.customReason?.trim() || "Other" : entry.reason;
    const key = isOther ? `OTHER:${label}` : entry.reason;
    const bucket = buckets.get(key) ?? {
      reason: entry.reason,
      label,
      entryCount: 0,
      totalQuantity: 0,
      totalValue: 0,
    };
    bucket.entryCount += 1;
    bucket.totalQuantity += Number(entry.quantity);
    bucket.totalValue += Number(entry.totalValue);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((b) => ({ ...b, totalValue: Math.round(b.totalValue * 100) / 100 }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

export interface ShiftGroupInput {
  shiftId: string | null;
  // `{ toString(): string }` (not just `number | string`) so a raw Prisma
  // `Decimal` — what `prisma.order.groupBy(...)`'s `_sum.total` actually is —
  // can be passed straight through without every call site converting it
  // first; `Number(...)` below coerces via that `toString()`.
  _sum: { total: number | string | { toString(): string } | null };
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

export interface PaymentMethodGroupInput {
  paymentMethod: string;
  _sum: { total: number | string | { toString(): string } | null };
  _count: { id: number };
}

export interface PaymentMethodRow {
  paymentMethod: string;
  orderCount: number;
  revenue: number;
  /** 0-100, one decimal place. */
  percentOfTotal: number;
}

/**
 * Turns a `prisma.order.groupBy({ by: ["paymentMethod"] })` result into
 * revenue/order-count/share-of-total rows, sorted by revenue desc.
 */
export function buildPaymentMethodRows(grouped: PaymentMethodGroupInput[]): PaymentMethodRow[] {
  const rows = grouped.map((g) => ({
    paymentMethod: g.paymentMethod,
    orderCount: g._count.id,
    revenue: Math.round(Number(g._sum.total ?? 0) * 100) / 100,
  }));
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return rows
    .map((r) => ({
      ...r,
      percentOfTotal: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface ItemMarginInput {
  name: string;
  quantity: number | string;
  total: number | string;
  /** Frozen per-unit cost at sale time (OrderItem.unitCostSnapshot) — null
   * for items sold before this field existed, or with no COGS attribution
   * path (aggregator items with no productId). */
  unitCostSnapshot: number | string | null;
}

export interface ItemMarginRow {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  /** null (shown as "—") when cost is unknown for any line of this item —
   * never a silently-understated partial total. */
  totalCost: number | null;
  margin: number | null;
  /** 0-100, one decimal place, or null alongside totalCost/margin. */
  marginPct: number | null;
}

/**
 * Per-menu-item profitability, bucketed by item name (same convention as
 * the Top Items report). An item with even one line missing a cost snapshot
 * reports cost/margin as unknown for its whole bucket, rather than a total
 * that understates true cost.
 */
export function buildItemMarginRows(items: ItemMarginInput[]): ItemMarginRow[] {
  const buckets = new Map<
    string,
    {
      orderCount: number;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      hasUnknownCost: boolean;
    }
  >();

  for (const item of items) {
    const bucket = buckets.get(item.name) ?? {
      orderCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
      totalCost: 0,
      hasUnknownCost: false,
    };
    const qty = Number(item.quantity);
    bucket.orderCount += 1;
    bucket.totalQuantity += qty;
    bucket.totalRevenue += Number(item.total);
    if (item.unitCostSnapshot != null) {
      bucket.totalCost += Number(item.unitCostSnapshot) * qty;
    } else {
      bucket.hasUnknownCost = true;
    }
    buckets.set(item.name, bucket);
  }

  return Array.from(buckets.entries())
    .map(([name, b]) => {
      const totalRevenue = Math.round(b.totalRevenue * 100) / 100;
      const totalCost = b.hasUnknownCost ? null : Math.round(b.totalCost * 100) / 100;
      const margin = totalCost != null ? Math.round((totalRevenue - totalCost) * 100) / 100 : null;
      const marginPct =
        margin != null && totalRevenue > 0 ? Math.round((margin / totalRevenue) * 1000) / 10 : null;
      return {
        name,
        orderCount: b.orderCount,
        totalQuantity: Math.round(b.totalQuantity * 100) / 100,
        totalRevenue,
        totalCost,
        margin,
        marginPct,
      };
    })
    .sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
}

export interface CashShiftInput {
  id: string;
  openedAt: Date | string;
  closedAt: Date | string | null;
  staffMember: { id: string; name: string };
  openingCash: number | string | { toString(): string };
  closingCash: number | string | { toString(): string } | null;
  expectedCash: number | string | { toString(): string } | null;
  cashDifference: number | string | { toString(): string } | null;
}

export interface CashReconciliationRow {
  shiftId: string;
  staffName: string;
  staffId: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  /** true when a closed shift's drawer didn't balance (cashDifference != 0). */
  isFlagged: boolean;
}

/**
 * Cash-drawer reconciliation per cashier session — surfaces
 * Shift.openingCash/closingCash/expectedCash/cashDifference (already
 * recorded at shift close, never previously shown on a Finance report) so a
 * manager can spot over/short drawers without digging through raw shifts.
 */
export function buildCashReconciliationRows(shifts: CashShiftInput[]): CashReconciliationRow[] {
  return shifts
    .map((s) => {
      const cashDifference = s.cashDifference != null ? Number(s.cashDifference) : null;
      return {
        shiftId: s.id,
        staffName: s.staffMember.name,
        staffId: s.staffMember.id,
        openedAt: new Date(s.openedAt).toISOString(),
        closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : null,
        isOpen: s.closedAt === null,
        openingCash: Math.round(Number(s.openingCash) * 100) / 100,
        closingCash: s.closingCash != null ? Math.round(Number(s.closingCash) * 100) / 100 : null,
        expectedCash:
          s.expectedCash != null ? Math.round(Number(s.expectedCash) * 100) / 100 : null,
        cashDifference: cashDifference != null ? Math.round(cashDifference * 100) / 100 : null,
        isFlagged: cashDifference != null && Math.round(cashDifference * 100) / 100 !== 0,
      };
    })
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
}
