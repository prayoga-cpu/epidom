/**
 * Totals and subtotals for the Finance report tables — shared by the on-screen
 * report, its Excel export and the PDF print view so the three can never show
 * different totals for the same rows. Pure: rows in, figures out.
 *
 * A total is only printed where adding the rows up is meaningful. Where it is
 * not (order counts across categories, overlapping shift blocks) the server
 * sends a once-per-order figure instead, and these helpers never sum it.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Adds up the given numeric columns of a table, rounded to the cent. */
export function sumColumns<Row, Key extends keyof Row>(
  rows: Row[],
  keys: readonly Key[]
): Record<Key, number> {
  const totals = {} as Record<Key, number>;
  for (const key of keys) {
    totals[key] = round2(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));
  }
  return totals;
}

/** `part` as a percentage of `whole`, one decimal place; 0 when there's no whole. */
export function sharePct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Revenue per order (or per guest), or 0 with nothing to divide by. */
export function averageTicket(revenue: number, count: number): number {
  return count > 0 ? round2(revenue / count) : 0;
}

// ─── P&L statement ───

export interface PnlSource {
  grossRevenue: number;
  discountAmount: number;
  revenue: number;
  refundAmount: number;
  taxCollected: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  processingFee: number;
  platformCommission: number;
  wasteLoss: number;
  netProfit: number;
}

export type PnlLineKind = "line" | "subtotal" | "total";

export interface PnlLine {
  /** The summary field the figure comes from (also the delta-badge key). */
  key: keyof PnlSource;
  labelKey: string;
  /** Signed as printed: deductions are negative. */
  value: number;
  kind: PnlLineKind;
}

/**
 * The P&L as printed, top to bottom. Every subtotal is the line above it
 * minus the deductions in between — deriveStoreSummary guarantees that to the
 * cent — so the statement can be checked with a pencil. A store that never
 * sells through a delivery app has no commission line.
 */
export function buildPnlLines(s: PnlSource): PnlLine[] {
  const line = (
    key: keyof PnlSource,
    labelKey: string,
    value: number,
    kind: PnlLineKind = "line"
  ): PnlLine => ({ key, labelKey, value, kind });

  return [
    line("grossRevenue", "pages.financeGrossRevenue", s.grossRevenue),
    line("discountAmount", "pages.financeDiscount", -s.discountAmount),
    line("revenue", "pages.financeRevenue", s.revenue, "subtotal"),
    line("refundAmount", "pages.financeRefund", -s.refundAmount),
    line("taxCollected", "pages.financeTax", -s.taxCollected),
    line("netSales", "pages.financeNetSales", s.netSales, "subtotal"),
    line("cogs", "pages.financeCogs", -s.cogs),
    line("grossProfit", "pages.financeGrossProfit", s.grossProfit, "subtotal"),
    line("processingFee", "pages.financeProcessingFee", -s.processingFee),
    ...(s.platformCommission
      ? [line("platformCommission", "pages.financePlatformCommission", -s.platformCommission)]
      : []),
    line("wasteLoss", "pages.financeWasteLoss", -s.wasteLoss),
    line("netProfit", "pages.financeNetProfit", s.netProfit, "total"),
  ];
}

// ─── Top items ───

export interface TopItemsAllTotals {
  itemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopItemsBreakdown {
  /** The rows on screen. */
  shown: TopItemsAllTotals;
  /** Everything the top-N cut leaves out, or null when nothing is left out
   * (or the all-items figure isn't known). */
  other: TopItemsAllTotals | null;
  /** Every item sold, when the server sent it. */
  all: TopItemsAllTotals | null;
}

/** "Top N" subtotal, the remainder, and the grand total of every item sold. */
export function topItemsBreakdown(
  items: { totalQuantity: number; totalRevenue: number }[],
  all: TopItemsAllTotals | null | undefined
): TopItemsBreakdown {
  const shown = {
    itemCount: items.length,
    ...sumColumns(items, ["totalQuantity", "totalRevenue"] as const),
  };
  if (!all) return { shown, other: null, all: null };
  const otherCount = all.itemCount - shown.itemCount;
  return {
    shown,
    other:
      otherCount > 0
        ? {
            itemCount: otherCount,
            totalQuantity: round2(all.totalQuantity - shown.totalQuantity),
            totalRevenue: round2(all.totalRevenue - shown.totalRevenue),
          }
        : null,
    all,
  };
}

// ─── Item margin ───

export interface ItemMarginTotalsInput {
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number | null;
}

export interface ItemMarginTotals {
  totalQuantity: number;
  totalRevenue: number;
  /** Revenue, cost and margin of the items whose cost is known. */
  costedRevenue: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  /** Items shown as "—": counted and summed separately rather than treated
   * as free, which would make the total margin look better than it is. */
  uncostedCount: number;
  uncostedRevenue: number;
}

export function itemMarginTotals(rows: ItemMarginTotalsInput[]): ItemMarginTotals {
  const costed = rows.filter((r) => r.totalCost != null);
  const uncosted = rows.filter((r) => r.totalCost == null);
  const costedRevenue = round2(costed.reduce((sum, r) => sum + r.totalRevenue, 0));
  const totalCost = round2(costed.reduce((sum, r) => sum + (r.totalCost ?? 0), 0));
  const margin = round2(costedRevenue - totalCost);
  return {
    ...sumColumns(rows, ["totalQuantity", "totalRevenue"] as const),
    costedRevenue,
    totalCost,
    margin,
    marginPct: sharePct(margin, costedRevenue),
    uncostedCount: uncosted.length,
    uncostedRevenue: round2(uncosted.reduce((sum, r) => sum + r.totalRevenue, 0)),
  };
}

/**
 * Menu engineering (Kasavana & Smith): each costed item is placed by how
 * well it sells and how much it earns per unit, against the menu's own
 * averages.
 *
 * - popular: its share of units sold is at least 70% of an even share
 *   (1 / number of items) — the method's standard threshold;
 * - profitable: its margin per unit is at least the menu's average margin
 *   per unit (total margin / total units).
 *
 * star = popular + profitable · plowhorse = popular only ·
 * puzzle = profitable only · dog = neither.
 */
export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export function classifyMenuItems(
  rows: { name: string; totalQuantity: number; margin: number | null }[]
): Map<string, MenuClass> {
  const costed = rows.filter((r) => r.margin != null && r.totalQuantity > 0);
  const result = new Map<string, MenuClass>();
  if (costed.length < 2) return result;

  const totalQuantity = costed.reduce((sum, r) => sum + r.totalQuantity, 0);
  const totalMargin = costed.reduce((sum, r) => sum + (r.margin ?? 0), 0);
  const popularityThreshold = (1 / costed.length) * 0.7;
  const averageUnitMargin = totalMargin / totalQuantity;

  for (const row of costed) {
    const popular = row.totalQuantity / totalQuantity >= popularityThreshold;
    const profitable = (row.margin ?? 0) / row.totalQuantity >= averageUnitMargin;
    result.set(
      row.name,
      popular && profitable ? "star" : popular ? "plowhorse" : profitable ? "puzzle" : "dog"
    );
  }
  return result;
}

// ─── Shift blocks ───

export interface ScheduleBlockRowInput {
  scheduleShiftId: string;
  name: string;
  color?: string | null;
  orderCount: number;
  revenue: number;
}

export interface ScheduleBlockSubtotal {
  scheduleShiftId: string;
  name: string;
  color: string | null;
  /** Days in the range on which the block took at least one order. */
  activeDays: number;
  orderCount: number;
  revenue: number;
}

/**
 * One subtotal per block across the whole range. Adding a block's own days up
 * is sound — a block never overlaps itself — even though adding different
 * blocks together is not (see schedule-shift-bucketing.ts).
 */
export function scheduleBlockSubtotals(rows: ScheduleBlockRowInput[]): ScheduleBlockSubtotal[] {
  const blocks = new Map<string, ScheduleBlockSubtotal>();
  for (const row of rows) {
    const block = blocks.get(row.scheduleShiftId) ?? {
      scheduleShiftId: row.scheduleShiftId,
      name: row.name,
      color: row.color ?? null,
      activeDays: 0,
      orderCount: 0,
      revenue: 0,
    };
    if (row.orderCount > 0) block.activeDays += 1;
    block.orderCount += row.orderCount;
    block.revenue = round2(block.revenue + row.revenue);
    blocks.set(row.scheduleShiftId, block);
  }
  return Array.from(blocks.values()).sort((a, b) => b.revenue - a.revenue);
}
