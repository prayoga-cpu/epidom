import { describe, it, expect } from "vitest";
import {
  buildAdjustmentsReport,
  buildSalesPatterns,
  buildTaxRows,
  estimateLabourCost,
  monthFractionOf,
} from "../insights";

describe("buildSalesPatterns", () => {
  const TZ = "Asia/Jakarta"; // UTC+7

  it("splits by order type and places each order on its business-local hour and weekday", () => {
    const patterns = buildSalesPatterns(
      [
        // Mon 31 Aug 2026, 12:30 WIB
        { orderDate: "2026-08-31T05:30:00Z", total: 100, orderType: "DINE_IN", guestCount: 2 },
        // Mon 31 Aug 2026, 12:45 WIB
        { orderDate: "2026-08-31T05:45:00Z", total: 50, orderType: "TAKEAWAY", guestCount: null },
        // Sun 30 Aug 22:10 UTC is Mon 31 Aug 05:10 WIB
        { orderDate: "2026-08-30T22:10:00Z", total: 30, orderType: "DINE_IN", guestCount: 1 },
      ],
      TZ
    );

    expect(patterns.byOrderType).toEqual([
      { orderType: "DINE_IN", orderCount: 2, revenue: 130, guests: 3 },
      { orderType: "TAKEAWAY", orderCount: 1, revenue: 50, guests: 0 },
    ]);
    expect(patterns.byHour[12]).toEqual({ hour: 12, orderCount: 2, revenue: 150 });
    expect(patterns.byHour[5]).toEqual({ hour: 5, orderCount: 1, revenue: 30 });
    expect(patterns.byWeekday[0]).toEqual({ weekday: 0, orderCount: 3, revenue: 180 });
    expect(patterns.cells).toContainEqual({ weekday: 0, hour: 12, orderCount: 2, revenue: 150 });
    expect(patterns.covers).toEqual({ guests: 3, ordersWithGuests: 2, revenueWithGuests: 130 });
  });
});

describe("buildAdjustmentsReport", () => {
  it("groups discounts by reason or coupon, merging reasons typed differently", () => {
    const report = buildAdjustmentsReport({
      discounted: [
        { discountAmount: 10, discountReason: "Staff meal", couponCode: null },
        { discountAmount: 5, discountReason: " staff meal ", couponCode: null },
        { discountAmount: 20, discountReason: null, couponCode: "WELCOME10" },
        { discountAmount: 3, discountReason: null, couponCode: null },
      ],
      refunded: [{ refundAmount: 40, refundReason: "Cold food" }],
      cancelled: { orderCount: 2, value: 70.5 },
      voidedLines: [
        { name: "Latte", quantity: 1, total: 4 },
        { name: "Latte", quantity: 2, total: 8 },
        { name: "Cake", quantity: 1, total: 6 },
      ],
    });

    expect(report.discounts).toEqual([
      { label: "WELCOME10", isCoupon: true, orderCount: 1, amount: 20 },
      { label: "Staff meal", isCoupon: false, orderCount: 2, amount: 15 },
      { label: null, isCoupon: false, orderCount: 1, amount: 3 },
    ]);
    expect(report.refunds).toEqual([
      { label: "Cold food", isCoupon: false, orderCount: 1, amount: 40 },
    ]);
    expect(report.cancelled).toEqual({ orderCount: 2, value: 70.5 });
    expect(report.voids).toMatchObject({ lineCount: 3, quantity: 4, value: 18 });
    expect(report.voids.topItems[0]).toEqual({
      name: "Latte",
      lineCount: 2,
      quantity: 3,
      value: 12,
    });
  });
});

describe("buildTaxRows", () => {
  it("groups by rate and takes the refunded share out of both base and tax", () => {
    const rows = buildTaxRows([
      // 11% exclusive: 100 + 11 tax
      { taxRate: 0.11, subtotal: 100, serviceCharge: 0, tax: 11, total: 111, refundAmount: 0 },
      // 11% with 5% service: (200 + 10) × 11% = 23.1, refunded in full
      {
        taxRate: 0.11,
        subtotal: 200,
        serviceCharge: 10,
        tax: 23.1,
        total: 233.1,
        refundAmount: 233.1,
      },
      { taxRate: 0, subtotal: 50, serviceCharge: 0, tax: 0, total: 50, refundAmount: 0 },
    ]);

    expect(rows).toEqual([
      {
        ratePct: 11,
        orderCount: 2,
        taxableBase: 100,
        taxCharged: 34.1,
        refundedTax: 23.1,
        taxOwed: 11,
      },
      { ratePct: 0, orderCount: 1, taxableBase: 50, taxCharged: 0, refundedTax: 0, taxOwed: 0 },
    ]);
  });
});

describe("estimateLabourCost", () => {
  const staff = [
    { id: "h", name: "Hourly", payType: "HOURLY" as const, payRate: 20, isActive: true },
    { id: "m", name: "Salaried", payType: "MONTHLY" as const, payRate: 3000, isActive: true },
    { id: "c", name: "Commission", payType: "SALES" as const, payRate: 5, isActive: true },
    { id: "n", name: "No rate", payType: "NONE" as const, payRate: null, isActive: true },
    { id: "gone", name: "Left", payType: "HOURLY" as const, payRate: 20, isActive: false },
  ];

  it("costs hours for hourly staff and a prorated salary, and lists what it can't cost", () => {
    // 15 of September's 30 days.
    const days = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const report = estimateLabourCost(staff, new Map([["h", { minutes: 90, days: 1 }]]), days);

    expect(report.monthFraction).toBe(0.5);
    const byId = Object.fromEntries(report.rows.map((r) => [r.staffMemberId, r]));
    expect(byId.h).toMatchObject({ basis: "hours", cost: 30, workedMinutes: 90 });
    expect(byId.m).toMatchObject({ basis: "salary", cost: 1500 });
    expect(byId.c).toMatchObject({ basis: "commission", cost: null });
    expect(byId.n).toMatchObject({ basis: "none", cost: null });
    // Inactive and never clocked in during the range: not listed at all.
    expect(byId.gone).toBeUndefined();
    expect(report.totals).toEqual({ workedMinutes: 90, cost: 1530, notEstimated: 2 });
  });

  it("still lists someone who has since left, for the hours they worked in the range", () => {
    const report = estimateLabourCost(staff, new Map([["gone", { minutes: 60, days: 1 }]]), [
      "2026-09-01",
    ]);
    expect(report.rows.find((r) => r.staffMemberId === "gone")?.cost).toBe(20);
  });
});

describe("monthFractionOf", () => {
  it("weighs each day by its own month's length", () => {
    expect(monthFractionOf(["2026-02-01"])).toBeCloseTo(1 / 28, 4);
    // All of February plus one day of March.
    const feb = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`);
    expect(monthFractionOf([...feb, "2026-03-01"])).toBeCloseTo(1 + 1 / 31, 4);
  });
});
