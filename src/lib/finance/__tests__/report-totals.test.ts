import { describe, it, expect, vi } from "vitest";

// deriveStoreSummary is pure; its module also exports the DB loader.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import {
  averageTicket,
  buildPnlLines,
  classifyMenuItems,
  itemMarginTotals,
  scheduleBlockSubtotals,
  sharePct,
  sumColumns,
  topItemsBreakdown,
} from "../report-totals";
import { bucketOrdersByDay } from "../report-aggregation";
import { deriveStoreSummary } from "../store-summary";

describe("sumColumns", () => {
  it("adds each named column, rounded to the cent", () => {
    const rows = [
      { a: 0.1, b: 1 },
      { a: 0.2, b: 2 },
    ];
    expect(sumColumns(rows, ["a", "b"] as const)).toEqual({ a: 0.3, b: 3 });
  });

  it("is zero for no rows", () => {
    expect(sumColumns([] as { a: number }[], ["a"] as const)).toEqual({ a: 0 });
  });
});

describe("sharePct / averageTicket", () => {
  it("gives a one-decimal share, 0 with no whole", () => {
    expect(sharePct(1, 3)).toBe(33.3);
    expect(sharePct(5, 0)).toBe(0);
  });

  it("divides revenue by count, 0 with no orders", () => {
    expect(averageTicket(100, 3)).toBe(33.33);
    expect(averageTicket(100, 0)).toBe(0);
  });
});

describe("buildPnlLines", () => {
  const summary = deriveStoreSummary(
    {
      revenue: 1_110,
      orderCount: 10,
      taxCollected: 110,
      serviceCharge: 0,
      discountAmount: 90,
      refundAmount: 0,
      processingFee: 20,
      cogsBase: 400,
      unknownCostLines: 0,
      unknownCostRevenue: 0,
      wasteBase: 30,
      platformCommission: 50,
    },
    1
  );

  it("reads top to bottom so every subtotal is the sum of the lines above it", () => {
    const lines = buildPnlLines(summary);
    let running = 0;
    for (const line of lines) {
      if (line.kind === "line") {
        running = Math.round((running + line.value) * 100) / 100;
      } else {
        expect(line.value, line.key).toBe(running);
        running = line.value;
      }
    }
    expect(lines.at(-1)).toMatchObject({ key: "netProfit", kind: "total" });
  });

  it("prints deductions as negative figures", () => {
    const tax = buildPnlLines(summary).find((l) => l.key === "taxCollected");
    expect(tax?.value).toBe(-110);
  });

  it("leaves the commission line out for a store with no delivery-app sales", () => {
    const lines = buildPnlLines({ ...summary, platformCommission: 0 });
    expect(lines.some((l) => l.key === "platformCommission")).toBe(false);
  });
});

describe("topItemsBreakdown", () => {
  const items = [
    { totalQuantity: 3, totalRevenue: 30 },
    { totalQuantity: 2, totalRevenue: 20 },
  ];

  it("splits the grand total into the rows shown and the rest", () => {
    const b = topItemsBreakdown(items, { itemCount: 5, totalQuantity: 9, totalRevenue: 80 });
    expect(b.shown).toEqual({ itemCount: 2, totalQuantity: 5, totalRevenue: 50 });
    expect(b.other).toEqual({ itemCount: 3, totalQuantity: 4, totalRevenue: 30 });
  });

  it("has no remainder when every item is on screen, or the grand total is unknown", () => {
    expect(
      topItemsBreakdown(items, { itemCount: 2, totalQuantity: 5, totalRevenue: 50 }).other
    ).toBeNull();
    expect(topItemsBreakdown(items, undefined)).toMatchObject({ other: null, all: null });
  });
});

describe("itemMarginTotals", () => {
  it("totals margin over costed items only, and reports the uncosted ones apart", () => {
    const t = itemMarginTotals([
      { totalQuantity: 2, totalRevenue: 100, totalCost: 40 },
      { totalQuantity: 1, totalRevenue: 50, totalCost: 10 },
      { totalQuantity: 4, totalRevenue: 70, totalCost: null },
    ]);
    expect(t).toEqual({
      totalQuantity: 7,
      totalRevenue: 220,
      costedRevenue: 150,
      totalCost: 50,
      margin: 100,
      marginPct: 66.7,
      uncostedCount: 1,
      uncostedRevenue: 70,
    });
  });
});

describe("classifyMenuItems", () => {
  it("places items by popularity and margin per unit against the menu's averages", () => {
    const classes = classifyMenuItems([
      // average margin per unit = 160 / 40 = 4; popularity threshold = 70% of 1/4
      { name: "Star", totalQuantity: 20, margin: 100 }, // 5/unit, 50% of units
      { name: "Plowhorse", totalQuantity: 15, margin: 30 }, // 2/unit, 37.5%
      { name: "Puzzle", totalQuantity: 2, margin: 20 }, // 10/unit, 5%
      { name: "Dog", totalQuantity: 3, margin: 10 }, // 3.3/unit, 7.5%
      { name: "Unknown", totalQuantity: 9, margin: null },
    ]);
    expect(Object.fromEntries(classes)).toEqual({
      Star: "star",
      Plowhorse: "plowhorse",
      Puzzle: "puzzle",
      Dog: "dog",
    });
  });

  it("classifies nothing with fewer than two costed items", () => {
    expect(classifyMenuItems([{ name: "A", totalQuantity: 1, margin: 1 }]).size).toBe(0);
  });
});

describe("scheduleBlockSubtotals", () => {
  it("adds each block's days together and counts the days it traded", () => {
    const subtotals = scheduleBlockSubtotals([
      { scheduleShiftId: "s1", name: "Shift 1", orderCount: 2, revenue: 20 },
      { scheduleShiftId: "s1", name: "Shift 1", orderCount: 0, revenue: 0 },
      { scheduleShiftId: "s2", name: "Shift 2", orderCount: 5, revenue: 70 },
    ]);
    expect(subtotals).toEqual([
      {
        scheduleShiftId: "s2",
        name: "Shift 2",
        color: null,
        activeDays: 1,
        orderCount: 5,
        revenue: 70,
      },
      {
        scheduleShiftId: "s1",
        name: "Shift 1",
        color: null,
        activeDays: 1,
        orderCount: 2,
        revenue: 20,
      },
    ]);
  });
});

describe("bucketOrdersByDay", () => {
  it("gives each day the summary's P&L lines, net of the tax on refunds", () => {
    const days = bucketOrdersByDay([
      {
        orderDate: "2026-09-01T03:00:00Z",
        total: 110,
        tax: 10,
        discountAmount: 5,
        refundAmount: 0,
      },
      // Fully refunded: its tax comes back, so the day owes none for it.
      { orderDate: "2026-09-01T09:00:00Z", total: 55, tax: 5, refundAmount: 55 },
      { orderDate: "2026-09-02T01:00:00Z", total: 20 },
    ]);
    expect(days).toEqual([
      {
        date: "2026-09-01",
        orderCount: 2,
        revenue: 165,
        discountAmount: 5,
        refundAmount: 55,
        taxCollected: 10,
        netSales: 100,
      },
      {
        date: "2026-09-02",
        orderCount: 1,
        revenue: 20,
        discountAmount: 0,
        refundAmount: 0,
        taxCollected: 0,
        netSales: 20,
      },
    ]);
  });
});
