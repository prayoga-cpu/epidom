import { describe, it, expect } from "vitest";
import {
  buildAdjustmentsReport,
  buildSalesPatterns,
  buildTaxRows,
  labourFromPayroll,
  type LabourPayrollInput,
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

describe("labourFromPayroll", () => {
  function person(
    over: Partial<LabourPayrollInput> & { staffMemberId: string }
  ): LabourPayrollInput {
    return {
      name: over.staffMemberId,
      payType: "HOURLY",
      payRate: 20,
      daysPresent: 1,
      workedMinutes: 480,
      incompleteDays: 0,
      base: { kind: "hourly", rate: 20, hours: 8, amount: 160 },
      allowanceTotal: 0,
      overtime: { hours: 0, rate: 20, rateSource: "payRate", amount: 0 },
      paidOvertimeMinutes: 0,
      pendingOvertimeMinutes: 0,
      total: 160,
      ...over,
    };
  }

  it("costs each person at their payroll total and sums the parts", () => {
    const report = labourFromPayroll([
      person({
        staffMemberId: "h",
        allowanceTotal: 5,
        overtime: { hours: 1, rate: 30, rateSource: "overtimeRate", amount: 30 },
        paidOvertimeMinutes: 60,
        pendingOvertimeMinutes: 90,
        total: 195,
      }),
      person({
        staffMemberId: "m",
        payType: "MONTHLY",
        payRate: 3100,
        base: { kind: "monthly", rate: 3100, monthFraction: 1 / 31, amount: 100 },
        overtime: { hours: 0, rate: null, rateSource: "none", amount: null },
        total: 100,
      }),
    ]);

    expect(report.rows.map((r) => r.staffMemberId)).toEqual(["h", "m"]);
    expect(report.rows[0]).toMatchObject({ base: 160, allowances: 5, overtimePay: 30, cost: 195 });
    expect(report.totals).toEqual({
      workedMinutes: 960,
      base: 260,
      allowances: 5,
      overtimePay: 30,
      paidOvertimeMinutes: 60,
      // Waiting for approval: reported, not costed.
      pendingOvertimeMinutes: 90,
      cost: 295,
      notEstimated: 0,
    });
  });

  it("lists someone with no pay rate, costing only what can be priced", () => {
    const report = labourFromPayroll([
      person({
        staffMemberId: "none",
        payType: "NONE",
        payRate: null,
        base: { kind: "notSet", amount: null },
        overtime: { hours: 0, rate: null, rateSource: "none", amount: null },
        total: 0,
      }),
      person({
        staffMemberId: "allowance-only",
        payType: "NONE",
        payRate: null,
        base: { kind: "notSet", amount: null },
        allowanceTotal: 15,
        overtime: { hours: 0, rate: null, rateSource: "none", amount: null },
        total: 15,
      }),
    ]);

    const byId = Object.fromEntries(report.rows.map((r) => [r.staffMemberId, r]));
    expect(byId.none.cost).toBeNull();
    expect(byId["allowance-only"].cost).toBe(15);
    expect(report.totals).toMatchObject({ cost: 15, notEstimated: 2 });
  });

  it("adds up the days still missing a clock-out", () => {
    const report = labourFromPayroll([
      person({ staffMemberId: "a", incompleteDays: 2 }),
      person({ staffMemberId: "b", incompleteDays: 1 }),
    ]);
    expect(report.incompleteDays).toBe(3);
  });
});
