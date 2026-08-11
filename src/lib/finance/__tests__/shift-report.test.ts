/**
 * Shift / daily report aggregation ("Z-report").
 *
 * The guest block gets the heaviest coverage: Order.guestCount is nullable on
 * purpose, and the whole point of that nullability is that "not recorded"
 * must never be silently counted as one guest.
 */
import { describe, it, expect } from "vitest";
import { aggregateShiftReport, type ShiftReportOrderInput } from "../shift-report";

const WINDOW = {
  from: new Date("2026-08-09T03:00:00.000Z"),
  to: new Date("2026-08-09T15:00:00.000Z"),
  isOpen: false,
};

function order(overrides: Partial<ShiftReportOrderInput> = {}): ShiftReportOrderInput {
  return {
    status: "DELIVERED",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    guestCount: null,
    subtotal: 100,
    discountAmount: 0,
    serviceCharge: 0,
    tax: 0,
    processingFee: 0,
    delivery: 0,
    refundAmount: 0,
    total: 100,
    orderDate: "2026-08-09T05:00:00.000Z",
    items: [],
    ...overrides,
  };
}

function item(
  name: string,
  quantity: number,
  total: number,
  category: { id: string; name: string } | null = null
) {
  return { name, quantity, total, menuItem: { name, category } };
}

const empty = (over: Partial<Parameters<typeof aggregateShiftReport>[0]> = {}) =>
  aggregateShiftReport({ orders: [], cancelledOrders: [], window: WINDOW, ...over });

describe("aggregateShiftReport — sales block", () => {
  it("reports gross sales and discount as separate lines, not one derived from the other", () => {
    const report = aggregateShiftReport({
      orders: [order({ subtotal: 1000, discountAmount: 100, total: 900 })],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.sales.grossSales).toBe(1000);
    expect(report.sales.discount).toBe(100);
    // `total` is already post-discount — it must not be re-reduced.
    expect(report.sales.total).toBe(900);
  });

  it("sums every charge line across orders", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ serviceCharge: 10, tax: 5, processingFee: 2, delivery: 3, refundAmount: 1 }),
        order({ serviceCharge: 20, tax: 7, processingFee: 4, delivery: 0, refundAmount: 0 }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.sales.serviceCharge).toBe(30);
    expect(report.sales.tax).toBe(12);
    expect(report.sales.processingFee).toBe(6);
    expect(report.sales.delivery).toBe(3);
    expect(report.sales.refund).toBe(1);
  });

  it("accepts Prisma-style Decimal objects, not just numbers", () => {
    const decimal = (v: string) => ({ toString: () => v });
    const report = aggregateShiftReport({
      orders: [order({ subtotal: decimal("1500.50"), total: decimal("1500.50") })],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.sales.total).toBe(1500.5);
  });
});

describe("aggregateShiftReport — invoices", () => {
  it("averages total over invoice count", () => {
    const report = aggregateShiftReport({
      orders: [order({ total: 100 }), order({ total: 50 })],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.invoices.count).toBe(2);
    expect(report.invoices.averagePerInvoice).toBe(75);
  });

  it("reports a zero average rather than dividing by zero on an empty window", () => {
    expect(empty().invoices).toEqual({ count: 0, averagePerInvoice: 0 });
  });
});

describe("aggregateShiftReport — cancellations", () => {
  it("counts cancelled invoices and items without folding them into revenue", () => {
    const report = aggregateShiftReport({
      orders: [order({ total: 100 })],
      cancelledOrders: [
        order({
          status: "CANCELLED",
          total: 40,
          items: [item("Latte", 2, 40)],
        }),
      ],
      window: WINDOW,
    });

    expect(report.cancellations).toEqual({ invoiceCount: 1, itemCount: 2, total: 40 });
    // The cancelled 40 must not appear in sales.
    expect(report.sales.total).toBe(100);
  });
});

describe("aggregateShiftReport — by sale type", () => {
  it("splits by orderType, sorted by revenue", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ orderType: "DINE_IN", total: 100 }),
        order({ orderType: "TAKEAWAY", total: 300 }),
        order({ orderType: "DINE_IN", total: 50 }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byOrderType).toEqual([
      { orderType: "TAKEAWAY", orderCount: 1, total: 300 },
      { orderType: "DINE_IN", orderCount: 2, total: 150 },
    ]);
  });
});

describe("aggregateShiftReport — by guest", () => {
  it("is null when no order recorded a pax count, so the block can be omitted", () => {
    const report = aggregateShiftReport({
      orders: [order({ guestCount: null }), order({ guestCount: null })],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byGuest).toBeNull();
  });

  it("never treats a null guestCount as one guest", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ guestCount: 4, total: 400 }),
        order({ guestCount: null, total: 999 }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byGuest?.totalGuests).toBe(4);
    expect(report.byGuest?.invoicesWithGuestCount).toBe(1);
    // Per-head is denominated over the invoices that recorded pax (400/4), not
    // over total sales (1399/4) — mixing the two inflates the figure.
    expect(report.byGuest?.averageSalesPerGuest).toBe(100);
  });

  it("averages guests over distinct days actually traded, not the raw window span", () => {
    // A shift crossing midnight whose orders all landed on one calendar day
    // must report 1 day, not 2.
    const report = aggregateShiftReport({
      orders: [
        order({ guestCount: 2, orderDate: "2026-08-09T05:00:00.000Z", total: 100 }),
        order({ guestCount: 3, orderDate: "2026-08-09T09:00:00.000Z", total: 150 }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byGuest?.dayCount).toBe(1);
    expect(report.byGuest?.averageGuestsPerDay).toBe(5);
  });
});

describe("aggregateShiftReport — by payment method", () => {
  it("splits revenue by method with share-of-total percentages", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ paymentMethod: "CASH", total: 250 }),
        order({ paymentMethod: "QRIS", total: 750 }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byPaymentMethod).toEqual([
      { paymentMethod: "QRIS", orderCount: 1, revenue: 750, percentOfTotal: 75 },
      { paymentMethod: "CASH", orderCount: 1, revenue: 250, percentOfTotal: 25 },
    ]);
  });
});

describe("aggregateShiftReport — by product", () => {
  const pastry = { id: "cat-1", name: "Pastry" };

  it("groups lines under their menu category and rolls up per-category totals", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ items: [item("London Cake", 5, 185, pastry), item("Tiramisu", 3, 105, pastry)] }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    const category = report.byProduct.categories.find((c) => c.categoryId === "cat-1");
    expect(category?.categoryName).toBe("Pastry");
    expect(category?.totalQuantity).toBe(8);
    expect(category?.totalGross).toBe(290);
    expect(category?.lines.map((l) => l.name)).toEqual(["London Cake", "Tiramisu"]);
  });

  it("merges the same product sold across several orders into one line", () => {
    const report = aggregateShiftReport({
      orders: [
        order({ items: [item("Americano", 4, 88, pastry)] }),
        order({ items: [item("Americano", 10, 220, pastry)] }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    const lines = report.byProduct.categories[0].lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ name: "Americano", quantity: 14, gross: 308 });
  });

  it("buckets items with no category under Uncategorized rather than dropping them", () => {
    const report = aggregateShiftReport({
      orders: [order({ items: [item("Mystery Item", 1, 30, null)] })],
      cancelledOrders: [],
      window: WINDOW,
    });

    const category = report.byProduct.categories[0];
    expect(category.categoryId).toBeNull();
    expect(category.categoryName).toBe("Uncategorized");
    expect(category.lines[0].name).toBe("Mystery Item");
  });

  it("falls back to the frozen OrderItem name for aggregator items with no menuItem", () => {
    const report = aggregateShiftReport({
      orders: [
        order({
          items: [{ name: "GoFood Bundle", quantity: 1, total: 55, menuItem: null }],
        }),
      ],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byProduct.categories[0].lines[0].name).toBe("GoFood Bundle");
  });

  it("totals quantity and gross across every category", () => {
    const bar = { id: "cat-2", name: "Beverage" };
    const report = aggregateShiftReport({
      orders: [order({ items: [item("Cake", 2, 60, pastry), item("Latte", 3, 90, bar)] })],
      cancelledOrders: [],
      window: WINDOW,
    });

    expect(report.byProduct.totalQuantity).toBe(5);
    expect(report.byProduct.totalGross).toBe(150);
  });
});

describe("aggregateShiftReport — window & cash drawer", () => {
  it("passes the window through, including the still-open flag", () => {
    const report = empty({ window: { ...WINDOW, isOpen: true } });

    expect(report.window.from).toBe("2026-08-09T03:00:00.000Z");
    expect(report.window.isOpen).toBe(true);
  });

  it("is null when the report is not scoped to a till session", () => {
    expect(empty().cashDrawer).toBeNull();
  });

  it("passes a supplied cash drawer through untouched", () => {
    const cashDrawer = {
      staffName: "Budi",
      openedAt: "2026-08-09T03:00:00.000Z",
      closedAt: "2026-08-09T15:00:00.000Z",
      openingCash: 200,
      closingCash: 1200,
      expectedCash: 1150,
      cashDifference: 50,
    };

    expect(empty({ cashDrawer }).cashDrawer).toEqual(cashDrawer);
  });
});
