import { describe, it, expect } from "vitest";
import type { ShiftReportCashDrawer, ShiftReportData } from "@/lib/finance/shift-report";
import {
  buildCashDetailRows,
  buildOtherPayments,
  cashDifference,
  differenceTone,
} from "../shift-summary";

function drawer(overrides: Partial<ShiftReportCashDrawer> = {}): ShiftReportCashDrawer {
  return {
    scope: "SHIFT",
    staffName: "Sam",
    openedAt: "2026-09-11T11:00:00.000Z",
    closedAt: null,
    tillCount: 1,
    hasOpenTill: true,
    openingCash: 100_000,
    cashSales: 80_000,
    cashRefunds: 0,
    tips: 0,
    pettyIn: 0,
    pettyOut: 0,
    drops: 0,
    tipPayouts: 0,
    unlinkedCashSales: 0,
    expectedCash: 180_000,
    closingCash: null,
    cashDifference: null,
    ...overrides,
  };
}

describe("buildCashDetailRows", () => {
  it("always lists the float and cash sales, even when a shift took no cash", () => {
    const rows = buildCashDetailRows(drawer({ openingCash: 0, cashSales: 0, expectedCash: 0 }));
    expect(rows.map((r) => r.key)).toEqual(["openingCash", "cashSales"]);
    expect(rows.every((r) => r.amount === 0)).toBe(true);
  });

  it("skips a movement category nothing happened in, like the printed report", () => {
    const rows = buildCashDetailRows(drawer({ tips: 5_000, drops: 20_000 }));
    expect(rows.map((r) => r.key)).toEqual(["openingCash", "cashSales", "tips", "safeDrop"]);
  });

  it("keeps every amount a positive magnitude and says which way it moves the drawer", () => {
    const rows = buildCashDetailRows(
      drawer({
        cashRefunds: 1,
        tips: 2,
        pettyIn: 3,
        pettyOut: 4,
        drops: 5,
        tipPayouts: 6,
      })
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.cashRefunds).toMatchObject({ amount: 1, direction: "out" });
    expect(byKey.tips).toMatchObject({ amount: 2, direction: "in" });
    expect(byKey.floatTopUp).toMatchObject({ amount: 3, direction: "in" });
    expect(byKey.paidOut).toMatchObject({ amount: 4, direction: "out" });
    expect(byKey.safeDrop).toMatchObject({ amount: 5, direction: "out" });
    expect(byKey.tipsPaidOut).toMatchObject({ amount: 6, direction: "out" });
    expect(rows.every((r) => r.amount > 0)).toBe(true);
  });

  it("the rows reproduce the expected total the server computed", () => {
    const d = drawer({
      openingCash: 100_000,
      cashSales: 80_000,
      cashRefunds: 10_000,
      tips: 5_000,
      pettyIn: 20_000,
      pettyOut: 7_000,
      drops: 30_000,
      tipPayouts: 3_000,
      expectedCash: 155_000,
    });
    const signed = buildCashDetailRows(d).reduce(
      (acc, r) => acc + (r.direction === "in" ? r.amount : -r.amount),
      0
    );
    expect(signed).toBe(d.expectedCash);
  });
});

describe("buildOtherPayments", () => {
  const report = {
    byPaymentMethod: [
      { paymentMethod: "CASH", orderCount: 4, revenue: 80_000, percentOfTotal: 54 },
      { paymentMethod: "QRIS", orderCount: 2, revenue: 60_000.5, percentOfTotal: 40 },
      { paymentMethod: "STRIPE_CARD", orderCount: 1, revenue: 7_800.25, percentOfTotal: 6 },
    ],
  } as unknown as ShiftReportData;

  it("leaves cash out — it lives in the drawer section", () => {
    const { rows } = buildOtherPayments(report);
    expect(rows.map((r) => r.paymentMethod)).toEqual(["QRIS", "STRIPE_CARD"]);
  });

  it("totals the non-cash methods to the cent", () => {
    expect(buildOtherPayments(report).total).toBe(67_800.75);
  });

  it("an all-cash shift has no other payments and a zero total", () => {
    const allCash = {
      byPaymentMethod: [{ paymentMethod: "CASH", orderCount: 1, revenue: 5, percentOfTotal: 100 }],
    } as unknown as ShiftReportData;
    expect(buildOtherPayments(allCash)).toEqual({ rows: [], total: 0 });
  });
});

describe("cashDifference", () => {
  it("is counted minus expected — negative when the drawer is short", () => {
    expect(cashDifference(0, 80_000)).toBe(-80_000);
    expect(cashDifference(80_500, 80_000)).toBe(500);
    expect(cashDifference(80_000, 80_000)).toBe(0);
  });

  it("an empty field is 'not counted yet', never 'counted zero'", () => {
    expect(cashDifference(undefined, 80_000)).toBeNull();
    expect(cashDifference(Number.NaN, 80_000)).toBeNull();
  });

  it("does not leak floating-point noise into a money figure", () => {
    expect(cashDifference(0.3, 0.1)).toBe(0.2);
  });
});

describe("differenceTone", () => {
  it("maps the sign to a tone", () => {
    expect(differenceTone(null)).toBe("pending");
    expect(differenceTone(0)).toBe("balanced");
    expect(differenceTone(1)).toBe("over");
    expect(differenceTone(-1)).toBe("short");
  });
});
