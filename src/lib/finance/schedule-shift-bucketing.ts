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
      // Lexicographic "HH:mm" comparison is safe here — both are zero-padded 24h strings.
      const crossesMidnight = block.endTime <= block.startTime;
      const start = businessLocalToUTC(dateKey, block.startTime, timeZone);
      const endDateKey = crossesMidnight ? addDaysToDateKey(dateKey, 1) : dateKey;
      const end = businessLocalToUTC(endDateKey, block.endTime, timeZone);

      let orderCount = 0;
      let revenue = 0;
      for (const order of orderInstants) {
        if (order.time >= start.getTime() && order.time < end.getTime()) {
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
