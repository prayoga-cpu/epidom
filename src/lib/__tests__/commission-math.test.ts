import { describe, it, expect } from "vitest";
import {
  addCalendarMonths,
  calendarMonthsBetween,
  commissionOf,
  commissionWindow,
  commissionableAmount,
  lineShareInWindow,
  refundAdjustment,
  type CommissionLine,
} from "@/lib/partners/commission-math";

const s = (iso: string) => Date.parse(iso) / 1000;

const line = (
  start: string,
  end: string,
  amount: number,
  over: Partial<CommissionLine> = {}
): CommissionLine => ({
  amount,
  discountAmount: 0,
  inclusiveTax: 0,
  periodStart: s(start),
  periodEnd: s(end),
  ...over,
});

describe("calendar months", () => {
  it("adds months, clamping to the month's last day", () => {
    expect(addCalendarMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z"
    );
    expect(addCalendarMonths(new Date("2026-10-20T08:00:00Z"), 3).toISOString()).toBe(
      "2027-01-20T08:00:00.000Z"
    );
  });

  it("counts whole and partial months", () => {
    expect(calendarMonthsBetween(s("2026-10-20T00:00:00Z"), s("2027-10-20T00:00:00Z"))).toBe(12);
    expect(calendarMonthsBetween(s("2026-01-31T00:00:00Z"), s("2026-03-31T00:00:00Z"))).toBe(2);
    expect(calendarMonthsBetween(s("2026-10-01T00:00:00Z"), s("2026-10-16T12:00:00Z"))).toBeCloseTo(
      0.5,
      5
    );
    expect(calendarMonthsBetween(10, 10)).toBe(0);
  });
});

describe("commissionableAmount: 30% for the first 3 months", () => {
  const window = commissionWindow(s("2026-10-20T08:00:00Z"), 3);

  it("a monthly plan: invoices 1, 2 and 3 count in full, the 4th counts nothing", () => {
    const invoices = [
      ["2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z"],
      ["2026-11-20T08:00:00Z", "2026-12-20T08:00:00Z"],
      ["2026-12-20T08:00:00Z", "2027-01-20T08:00:00Z"],
      ["2027-01-20T08:00:00Z", "2027-02-20T08:00:00Z"],
    ].map(([a, b]) =>
      commissionableAmount({ lines: [line(a, b, 1399)], amountPaid: 1399, total: 1399 }, window)
    );
    expect(invoices).toEqual([1399, 1399, 1399, 0]);
    expect(invoices.map((x) => commissionOf(x, 30))).toEqual([419, 419, 419, 0]);
  });

  it("a yearly plan: 3/12 of the yearly payment", () => {
    const yearly = 11.49 * 12 * 100; // EUR 137.88
    const amount = commissionableAmount(
      {
        lines: [line("2026-10-20T08:00:00Z", "2027-10-20T08:00:00Z", yearly)],
        amountPaid: yearly,
        total: yearly,
      },
      window
    );
    expect(amount).toBe(Math.floor(yearly / 4));
    expect(commissionOf(amount, 30)).toBe(1034); // EUR 10.34
  });

  it("the 10% referral discount is taken off before the commission", () => {
    const amount = commissionableAmount(
      {
        lines: [
          line("2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z", 1399, { discountAmount: 140 }),
        ],
        amountPaid: 1259,
        total: 1259,
      },
      window
    );
    expect(amount).toBe(1259);
  });

  it("a prorated upgrade counts for the part inside the window", () => {
    // Upgrade on Jan 5: proration lines run to Jan 20 (inside) for a credit and a charge.
    const amount = commissionableAmount(
      {
        lines: [
          line("2027-01-05T08:00:00Z", "2027-01-20T08:00:00Z", -700),
          line("2027-01-05T08:00:00Z", "2027-01-20T08:00:00Z", 1400),
        ],
        amountPaid: 700,
        total: 700,
      },
      window
    );
    expect(amount).toBe(700);
  });

  it("a line half inside the window counts half", () => {
    const share = lineShareInWindow(
      line("2027-01-05T08:00:00Z", "2027-02-05T08:00:00Z", 1000),
      window
    );
    expect(share).toBeCloseTo(15 / 31, 2);
  });

  it("nothing for a $0 invoice (a free trial) or an unpaid one", () => {
    expect(
      commissionableAmount(
        {
          lines: [line("2026-10-06T08:00:00Z", "2026-10-20T08:00:00Z", 0)],
          amountPaid: 0,
          total: 0,
        },
        window
      )
    ).toBe(0);
  });

  it("only the part the customer paid when their balance covered the rest", () => {
    expect(
      commissionableAmount(
        {
          lines: [line("2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z", 2000)],
          amountPaid: 500,
          total: 2000,
        },
        window
      )
    ).toBe(500);
  });

  it("works in rupiah's minor units like any other currency", () => {
    // Rp 229.000 = 22900000 on Stripe.
    const amount = commissionableAmount(
      {
        lines: [line("2026-10-20T08:00:00Z", "2026-11-20T08:00:00Z", 22900000)],
        amountPaid: 22900000,
        total: 22900000,
      },
      window
    );
    expect(commissionOf(amount, 30)).toBe(6870000); // Rp 68.700
  });
});

describe("refundAdjustment", () => {
  it("takes back the refunded share of the commission, never more than it", () => {
    expect(refundAdjustment(419, 1399, 1399)).toBe(-419);
    expect(refundAdjustment(419, 1399, 700)).toBe(-210);
    expect(refundAdjustment(419, 1399, 5000)).toBe(-419);
    expect(refundAdjustment(0, 1399, 1399)).toBe(0);
  });
});
