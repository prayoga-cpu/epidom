/**
 * Pure aggregation for the "revenue per named shift-block" Finance report.
 * Kept separate from report-aggregation.ts — interval/midnight-wrap math is
 * a distinct, trickier domain worth isolating and testing on its own.
 *
 * IMPORTANT: named shift blocks (e.g. a merchant's "Shift 1" 08:00–16:00 and
 * "Shift 2 Middle" 12:00–20:00) can legitimately overlap by design, for
 * staggered handover coverage. This is therefore a *coverage-window* query,
 * not a partition — each (date, block) pair independently sums every order
 * whose timestamp falls inside that block's window. An order occurring
 * during an overlap is deliberately counted in more than one block's total,
 * so totals across blocks are NOT expected to sum to the grand total. The
 * UI must disclose this rather than let it look like double-counting.
 */

import { businessLocalToUTC, addDaysToDateKey } from "@/lib/attendance/business-date";

export interface ScheduleShiftBucketDef {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm" — may be <= startTime, meaning the block crosses midnight
}

export interface BucketableOrder {
  total: number | string | { toString(): string };
  orderDate: Date | string;
}

export interface ScheduleShiftBucketRow {
  scheduleShiftId: string;
  name: string;
  date: string;
  orderCount: number;
  revenue: number;
}

/**
 * Buckets orders into every (date, ScheduleShift) coverage window they fall
 * into. `dateKeys` and `scheduleShifts` are the full cartesian product to
 * report on — callers typically pass every date in the requested range and
 * every active block for the store.
 */
/** One block's [start, end) window on one business date, in epoch ms. */
function blockWindow(
  dateKey: string,
  block: ScheduleShiftBucketDef,
  timeZone: string
): { start: number; end: number } {
  // Lexicographic "HH:mm" comparison is safe here — both are zero-padded 24h strings.
  const crossesMidnight = block.endTime <= block.startTime;
  const start = businessLocalToUTC(dateKey, block.startTime, timeZone);
  const endDateKey = crossesMidnight ? addDaysToDateKey(dateKey, 1) : dateKey;
  const end = businessLocalToUTC(endDateKey, block.endTime, timeZone);
  return { start: start.getTime(), end: end.getTime() };
}

export function bucketOrdersByScheduleShift(
  orders: BucketableOrder[],
  scheduleShifts: ScheduleShiftBucketDef[],
  dateKeys: string[],
  timeZone: string
): ScheduleShiftBucketRow[] {
  const orderInstants = orders.map((o) => ({
    time: new Date(o.orderDate).getTime(),
    total: Number(o.total),
  }));

  const rows: ScheduleShiftBucketRow[] = [];

  for (const dateKey of dateKeys) {
    for (const block of scheduleShifts) {
      const { start, end } = blockWindow(dateKey, block, timeZone);

      let orderCount = 0;
      let revenue = 0;
      for (const order of orderInstants) {
        if (order.time >= start && order.time < end) {
          orderCount += 1;
          revenue += order.total;
        }
      }

      rows.push({
        scheduleShiftId: block.id,
        name: block.name,
        date: dateKey,
        orderCount,
        revenue: Math.round(revenue * 100) / 100,
      });
    }
  }

  return rows;
}

export interface ScheduleShiftCoverageTotals {
  /** Every order in the window, each counted once. */
  orderCount: number;
  revenue: number;
  /** Orders that fall inside no block at all (before opening, a gap between
   * blocks, a day with no blocks) — the part of the period the rows can't show. */
  outsideOrderCount: number;
  outsideRevenue: number;
}

/**
 * The honest total for the coverage report. The rows overlap by design, so
 * summing them double-counts handovers; this counts every order once and says
 * how much of the period fell outside every block.
 */
export function summarizeScheduleShiftCoverage(
  orders: BucketableOrder[],
  scheduleShifts: ScheduleShiftBucketDef[],
  dateKeys: string[],
  timeZone: string
): ScheduleShiftCoverageTotals {
  // Windows of the day before the range too: a block crossing midnight on
  // that day covers the first hours of the range.
  const keys = dateKeys.length ? [addDaysToDateKey(dateKeys[0], -1), ...dateKeys] : [];
  const windows = keys.flatMap((dateKey) =>
    scheduleShifts.map((block) => blockWindow(dateKey, block, timeZone))
  );

  let orderCount = 0;
  let revenue = 0;
  let outsideOrderCount = 0;
  let outsideRevenue = 0;
  for (const order of orders) {
    const time = new Date(order.orderDate).getTime();
    const total = Number(order.total);
    orderCount += 1;
    revenue += total;
    if (!windows.some((w) => time >= w.start && time < w.end)) {
      outsideOrderCount += 1;
      outsideRevenue += total;
    }
  }

  return {
    orderCount,
    revenue: Math.round(revenue * 100) / 100,
    outsideOrderCount,
    outsideRevenue: Math.round(outsideRevenue * 100) / 100,
  };
}

/** Every "YYYY-MM-DD" key from `fromKey` to `toKey`, inclusive. */
export function enumerateDateKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard < 3660) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
    guard += 1;
  }
  return keys;
}
