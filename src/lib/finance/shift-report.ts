/**
 * Shift / daily report aggregation — the "X-report / Z-report" every F&B POS
 * prints at close: sales breakdown, invoice counts, cancellations, sale-type
 * split, guest stats, payment-method split, and a per-product breakdown
 * grouped by menu category.
 *
 * Pure (plain data in, plain data out) so the numbers are unit-testable
 * without mocking Prisma, matching report-aggregation.ts. The Prisma fetch
 * lives in services/shift-report.service.ts, which is the only caller of
 * `aggregateShiftReport`.
 *
 * ONE aggregation feeds all three render paths — the browser report page, the
 * ESC/POS thermal print, and the JSON API route — so they can never drift
 * into showing different totals for the same shift.
 */

import { bucketItemsByCategory, buildPaymentMethodRows } from "./report-aggregation";

/** Money/quantity as it arrives from either a test fixture (number) or Prisma
 * (`Decimal`, which stringifies losslessly). Same widening as
 * PaymentMethodGroupInput in report-aggregation.ts. */
export type DecimalLike = number | string | { toString(): string };

export interface ShiftReportOrderInput {
  status: string;
  orderType: string;
  paymentMethod: string;
  guestCount: number | null;
  subtotal: DecimalLike;
  discountAmount: DecimalLike;
  serviceCharge: DecimalLike;
  tax: DecimalLike;
  processingFee: DecimalLike;
  delivery: DecimalLike;
  refundAmount: DecimalLike;
  total: DecimalLike;
  orderDate: Date | string;
  items: Array<{
    name: string;
    quantity: DecimalLike;
    total: DecimalLike;
    menuItem: { name: string; category: { id: string; name: string } | null } | null;
  }>;
}

export interface ShiftReportCashDrawer {
  staffName: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
}

export interface ShiftReportProductLine {
  name: string;
  quantity: number;
  gross: number;
}

export interface ShiftReportProductCategory {
  categoryId: string | null;
  categoryName: string;
  lines: ShiftReportProductLine[];
  totalQuantity: number;
  totalGross: number;
}

export interface ShiftReportData {
  window: { from: string; to: string; isOpen: boolean };
  sales: {
    grossSales: number;
    discount: number;
    serviceCharge: number;
    tax: number;
    processingFee: number;
    delivery: number;
    refund: number;
    total: number;
  };
  invoices: { count: number; averagePerInvoice: number };
  cancellations: { invoiceCount: number; itemCount: number; total: number };
  byOrderType: Array<{ orderType: string; orderCount: number; total: number }>;
  /** Null when no order in the window recorded a pax count — the report omits
   * the whole block rather than printing zeros for a store that never tracks
   * guests. See Order.guestCount. */
  byGuest: {
    totalGuests: number;
    invoicesWithGuestCount: number;
    dayCount: number;
    averageGuestsPerDay: number;
    averageSalesPerGuest: number;
  } | null;
  byPaymentMethod: Array<{
    paymentMethod: string;
    orderCount: number;
    revenue: number;
    percentOfTotal: number;
  }>;
  byProduct: {
    categories: ShiftReportProductCategory[];
    totalQuantity: number;
    totalGross: number;
  };
  /** Only present when the report is scoped to a specific till session. */
  cashDrawer: ShiftReportCashDrawer | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: DecimalLike[]) => values.reduce<number>((a, v) => a + Number(v), 0);

/**
 * Distinct calendar days touched by the window, used for "average guests per
 * day". Counted from the orders themselves rather than `to - from` so a shift
 * that crosses midnight (20:00 → 04:00) with all its orders before midnight
 * reports 1 day, not 2. Falls back to 1 so the average is never a divide-by-zero.
 */
function countDistinctDays(orders: ShiftReportOrderInput[]): number {
  const days = new Set(orders.map((o) => new Date(o.orderDate).toDateString()));
  return Math.max(1, days.size);
}

export interface AggregateShiftReportInput {
  /** Revenue-counting orders in the window (callers exclude NON_REVENUE_STATUSES). */
  orders: ShiftReportOrderInput[];
  /** CANCELLED orders in the same window — reported separately, never as revenue. */
  cancelledOrders: ShiftReportOrderInput[];
  window: { from: Date; to: Date; isOpen: boolean };
  cashDrawer?: ShiftReportCashDrawer | null;
}

export function aggregateShiftReport({
  orders,
  cancelledOrders,
  window,
  cashDrawer = null,
}: AggregateShiftReportInput): ShiftReportData {
  // ---- Sales block -------------------------------------------------------
  // `total` is already post-discount (computeOrderCharges applies the discount
  // before subtotal/tax/total are derived), so `grossSales` and `discount` are
  // reported as separate lines rather than one being derived from the other.
  const sales = {
    grossSales: round2(sum(orders.map((o) => o.subtotal))),
    discount: round2(sum(orders.map((o) => o.discountAmount))),
    serviceCharge: round2(sum(orders.map((o) => o.serviceCharge))),
    tax: round2(sum(orders.map((o) => o.tax))),
    processingFee: round2(sum(orders.map((o) => o.processingFee))),
    delivery: round2(sum(orders.map((o) => o.delivery))),
    refund: round2(sum(orders.map((o) => o.refundAmount))),
    total: round2(sum(orders.map((o) => o.total))),
  };

  const invoices = {
    count: orders.length,
    averagePerInvoice: orders.length > 0 ? round2(sales.total / orders.length) : 0,
  };

  // ---- Cancellations -----------------------------------------------------
  const cancellations = {
    invoiceCount: cancelledOrders.length,
    itemCount: cancelledOrders.reduce(
      (acc, o) => acc + o.items.reduce((n, i) => n + Number(i.quantity), 0),
      0
    ),
    total: round2(sum(cancelledOrders.map((o) => o.total))),
  };

  // ---- By sale type ------------------------------------------------------
  const typeBuckets = new Map<string, { orderCount: number; total: number }>();
  for (const order of orders) {
    const bucket = typeBuckets.get(order.orderType) ?? { orderCount: 0, total: 0 };
    bucket.orderCount += 1;
    bucket.total += Number(order.total);
    typeBuckets.set(order.orderType, bucket);
  }
  const byOrderType = Array.from(typeBuckets.entries())
    .map(([orderType, b]) => ({ orderType, orderCount: b.orderCount, total: round2(b.total) }))
    .sort((a, b) => b.total - a.total);

  // ---- By guest ----------------------------------------------------------
  // Only orders that actually recorded a pax count contribute. A null
  // guestCount means "not recorded", never "1" — see Order.guestCount.
  const withGuests = orders.filter((o) => o.guestCount != null && o.guestCount > 0);
  const totalGuests = withGuests.reduce((acc, o) => acc + (o.guestCount ?? 0), 0);
  const dayCount = countDistinctDays(orders);
  const byGuest =
    totalGuests > 0
      ? {
          totalGuests,
          invoicesWithGuestCount: withGuests.length,
          dayCount,
          averageGuestsPerDay: round2(totalGuests / dayCount),
          // Denominated over the sales of the invoices that recorded pax, not
          // total sales — mixing "revenue from every order" over "guests from
          // some orders" would inflate the per-head figure.
          averageSalesPerGuest: round2(sum(withGuests.map((o) => o.total)) / totalGuests),
        }
      : null;

  // ---- By payment method -------------------------------------------------
  // Reshaped into the `groupBy` form buildPaymentMethodRows already consumes,
  // so the percentage/sort logic stays in one place (report-aggregation.ts).
  const paymentBuckets = new Map<string, { total: number; count: number }>();
  for (const order of orders) {
    const bucket = paymentBuckets.get(order.paymentMethod) ?? { total: 0, count: 0 };
    bucket.total += Number(order.total);
    bucket.count += 1;
    paymentBuckets.set(order.paymentMethod, bucket);
  }
  const byPaymentMethod = buildPaymentMethodRows(
    Array.from(paymentBuckets.entries()).map(([paymentMethod, b]) => ({
      paymentMethod,
      _sum: { total: b.total },
      _count: { id: b.count },
    }))
  );

  // ---- By product, grouped by menu category ------------------------------
  const allItems = orders.flatMap((o) => o.items);
  // bucketItemsByCategory owns the "no menuItem / no category → Uncategorized"
  // rule and the sort; the per-line rollup below reuses the same key so a
  // category's lines can never land under a different heading than its total.
  // Decimals are collapsed to numbers first — bucketItemsByCategory predates
  // DecimalLike and only accepts number|string.
  const categoryTotals = bucketItemsByCategory(
    allItems.map((i) => ({
      total: Number(i.total),
      quantity: Number(i.quantity),
      menuItem: i.menuItem,
    }))
  );
  const lineBuckets = new Map<string, Map<string, ShiftReportProductLine>>();
  for (const item of allItems) {
    const key = item.menuItem?.category?.id ?? "none";
    const lines = lineBuckets.get(key) ?? new Map<string, ShiftReportProductLine>();
    // Aggregator-imported items have no menuItem — fall back to the frozen
    // OrderItem.name snapshot so they still appear by name, not as blanks.
    const name = item.menuItem?.name ?? item.name;
    const line = lines.get(name) ?? { name, quantity: 0, gross: 0 };
    line.quantity += Number(item.quantity);
    line.gross += Number(item.total);
    lines.set(name, line);
    lineBuckets.set(key, lines);
  }

  const categories: ShiftReportProductCategory[] = categoryTotals.map((c) => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    lines: Array.from(lineBuckets.get(c.categoryId ?? "none")?.values() ?? [])
      .map((l) => ({ ...l, gross: round2(l.gross) }))
      .sort((a, b) => b.gross - a.gross || a.name.localeCompare(b.name)),
    totalQuantity: c.totalQuantity,
    totalGross: c.totalRevenue,
  }));

  return {
    window: {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      isOpen: window.isOpen,
    },
    sales,
    invoices,
    cancellations,
    byOrderType,
    byGuest,
    byPaymentMethod,
    byProduct: {
      categories,
      totalQuantity: categories.reduce((acc, c) => acc + c.totalQuantity, 0),
      totalGross: round2(categories.reduce((acc, c) => acc + c.totalGross, 0)),
    },
    cashDrawer,
  };
}
