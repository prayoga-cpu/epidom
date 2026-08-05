import { describe, it, expect } from "vitest";
import {
  bucketOrdersByScheduleShift,
  enumerateDateKeys,
  type ScheduleShiftBucketDef,
} from "../schedule-shift-bucketing";

const TZ = "Asia/Jakarta"; // UTC+7

const shift1: ScheduleShiftBucketDef = { id: "s1", name: "Shift 1", startTime: "08:00", endTime: "16:00" };
const shift2Middle: ScheduleShiftBucketDef = {
  id: "s2",
  name: "Shift 2 Middle",
  startTime: "12:00",
  endTime: "20:00",
};
const shift4: ScheduleShiftBucketDef = { id: "s4", name: "Shift 4", startTime: "20:00", endTime: "04:00" };

describe("enumerateDateKeys", () => {
  it("includes both endpoints", () => {
    expect(enumerateDateKeys("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("returns a single day when from equals to", () => {
    expect(enumerateDateKeys("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
  });
});

describe("bucketOrdersByScheduleShift", () => {
  it("counts an order that falls inside a single block's window", () => {
    const orders = [{ total: 100, orderDate: "2026-08-10T03:00:00.000Z" }]; // 10:00 WIB
    const rows = bucketOrdersByScheduleShift(orders, [shift1], ["2026-08-10"], TZ);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ scheduleShiftId: "s1", orderCount: 1, revenue: 100 });
  });

  it("double-counts an order inside an intentional overlap between two blocks", () => {
    // 14:00 WIB falls inside both Shift 1 (08-16) and Shift 2 Middle (12-20).
    const orders = [{ total: 50, orderDate: "2026-08-10T07:00:00.000Z" }];
    const rows = bucketOrdersByScheduleShift(orders, [shift1, shift2Middle], ["2026-08-10"], TZ);
    const shift1Row = rows.find((r) => r.scheduleShiftId === "s1")!;
    const shift2Row = rows.find((r) => r.scheduleShiftId === "s2")!;
    expect(shift1Row.orderCount).toBe(1);
    expect(shift2Row.orderCount).toBe(1);
    // Both rows counted the same order — totals across rows exceed the actual order count, by design.
  });

  it("excludes an order outside every block's window", () => {
    const orders = [{ total: 100, orderDate: "2026-08-10T18:00:00.000Z" }]; // 01:00 WIB next day
    const rows = bucketOrdersByScheduleShift(orders, [shift1], ["2026-08-10"], TZ);
    expect(rows[0].orderCount).toBe(0);
  });

  it("correctly anchors a cross-midnight block's window to the next day", () => {
    // Shift 4 on 2026-08-10 runs 20:00 WIB Aug10 -> 04:00 WIB Aug11.
    // An order at 02:00 WIB Aug11 (19:00Z Aug10) should count toward the Aug10 row.
    const orders = [{ total: 75, orderDate: "2026-08-10T19:00:00.000Z" }];
    const rows = bucketOrdersByScheduleShift(orders, [shift4], ["2026-08-10"], TZ);
    expect(rows[0].orderCount).toBe(1);
    expect(rows[0].revenue).toBe(75);
  });

  it("does not count a cross-midnight block's order against the following day's row", () => {
    const orders = [{ total: 75, orderDate: "2026-08-10T19:00:00.000Z" }];
    const rows = bucketOrdersByScheduleShift(orders, [shift4], ["2026-08-11"], TZ);
    expect(rows[0].orderCount).toBe(0);
  });
});
