/**
 * Order-queue filtering. The payment-method filter gets the attention: a bill
 * settled with two or more tenders carries the literal "SPLIT" in
 * `paymentMethod`, so matching only that column hides a cash+card order from
 * the CASH filter even though the cashier did take cash for part of it.
 */
import { describe, it, expect } from "vitest";
import {
  countOrdersBySource,
  DEFAULT_QUEUE_DATE_PRESET,
  matchesQueueDate,
  matchesQueueFilters,
  QUEUE_DATE_PRESETS,
  orderSourceBucket,
  sortQueueOrders,
  toSourceTab,
  QUEUE_FILTER_KEYS,
  QUEUE_PAYMENT_METHODS,
  QUEUE_SOURCE_TABS,
  type QueueOrder,
} from "../order-queue-filters";
import type { OrderPaymentDto, TenderMethodDto } from "@/types/api/cashier";

/** The filter bag matchesQueueFilters takes — not exported, so derived here. */
type QueueFilters = Parameters<typeof matchesQueueFilters>[1];

const BASE_FILTERS: QueueFilters = {
  sourceFilter: "ALL",
  typeFilter: "ALL",
  search: "",
  unpaidOnly: false,
  productFilter: "ALL",
  departmentFilter: "ALL",
  staffFilter: "ALL",
  paymentMethodFilter: "ALL",
};

/** A tender row. Only `method` matters to the filter; the rest is shape. */
function tender(method: TenderMethodDto): OrderPaymentDto {
  return {
    id: `pay-${method}`,
    method,
    amount: 10,
    amountTendered: null,
    change: null,
    note: null,
    refundedAmount: 0,
  };
}

function order(overrides: Partial<QueueOrder> = {}): QueueOrder {
  return {
    id: "o1",
    orderNumber: "POS-0001",
    status: "CONFIRMED",
    source: "POS",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    customerName: "Walk-in",
    subtotal: 100,
    total: 100,
    items: [],
    createdAt: "2026-09-19T10:00:00.000Z",
    ...overrides,
  } as QueueOrder;
}

const match = (o: QueueOrder, filters: Partial<QueueFilters> = {}) =>
  matchesQueueFilters(o, { ...BASE_FILTERS, ...filters });

describe("matchesQueueFilters — payment method", () => {
  it("matches a legacy order on its whole-order method", () => {
    expect(match(order(), { paymentMethodFilter: "CASH" })).toBe(true);
    expect(match(order(), { paymentMethodFilter: "QRIS" })).toBe(false);
  });

  it("matches a split bill on any of its tenders", () => {
    const split = order({
      paymentMethod: "SPLIT",
      payments: [tender("CASH"), tender("STRIPE_CARD")],
    });
    expect(match(split, { paymentMethodFilter: "CASH" })).toBe(true);
    expect(match(split, { paymentMethodFilter: "STRIPE_CARD" })).toBe(true);
    expect(match(split, { paymentMethodFilter: "QRIS" })).toBe(false);
  });

  it("keeps matching a single-tender order that also carries its rows", () => {
    const withRow = order({ paymentMethod: "QRIS", payments: [tender("QRIS")] });
    expect(match(withRow, { paymentMethodFilter: "QRIS" })).toBe(true);
  });

  it("treats an absent/empty payments list as legacy rather than 'no match'", () => {
    // Orders placed before multi-tender, a zero-total (fully discounted) sale
    // and a PAY_LATER order settled by Mark as Paid all arrive with no rows.
    expect(match(order({ payments: undefined }), { paymentMethodFilter: "CASH" })).toBe(true);
    expect(match(order({ payments: [] }), { paymentMethodFilter: "CASH" })).toBe(true);
  });

  it("lets everything through on ALL", () => {
    expect(match(order({ paymentMethod: "SPLIT", payments: [tender("OVO")] }))).toBe(true);
  });
});

describe("QUEUE_PAYMENT_METHODS", () => {
  it("does not offer SPLIT as a filter choice", () => {
    // SPLIT labels a multi-tender bill; it is not a way anyone paid, and the
    // filter above matches the tenders instead.
    expect(QUEUE_PAYMENT_METHODS).not.toContain("SPLIT" as never);
  });
});

describe("matchesQueueFilters — other filters still hold", () => {
  it("filters by source bucket, type, unpaid and search", () => {
    expect(match(order({ source: "STOREFRONT" }), { sourceFilter: "POS" })).toBe(false);
    expect(match(order(), { typeFilter: "TAKEAWAY" })).toBe(false);
    expect(match(order({ paymentStatus: "PAID" }), { unpaidOnly: true })).toBe(false);
    expect(match(order({ orderNumber: "POS-0042" }), { search: "0042" })).toBe(true);
    expect(match(order(), { search: "nothing" })).toBe(false);
  });
});

describe("sortQueueOrders", () => {
  it("sorts newest first by default and by total on demand", () => {
    const a = order({ id: "a", createdAt: "2026-09-19T10:00:00.000Z", total: 10 });
    const b = order({ id: "b", createdAt: "2026-09-19T12:00:00.000Z", total: 90 });
    expect(sortQueueOrders([a, b], "newest").map((o) => o.id)).toEqual(["b", "a"]);
    expect(sortQueueOrders([a, b], "oldest").map((o) => o.id)).toEqual(["a", "b"]);
    expect(sortQueueOrders([a, b], "total-desc").map((o) => o.id)).toEqual(["b", "a"]);
    expect(sortQueueOrders([a, b], "total-asc").map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("source tabs", () => {
  it("has exactly two tabs, POS then Online — no All", () => {
    expect(QUEUE_SOURCE_TABS).toEqual(["POS", "ONLINE"]);
  });

  it("puts a till order under POS and every other channel under Online", () => {
    expect(orderSourceBucket("POS")).toBe("POS");
    for (const source of [
      "STOREFRONT",
      "MANUAL",
      "GOFOOD",
      "GRABFOOD",
      "SHOPEEFOOD",
      "TOKOPEDIA",
    ]) {
      expect(orderSourceBucket(source)).toBe("ONLINE");
    }
  });

  it("counts open orders per tab", () => {
    const orders = [
      order({ source: "POS" }),
      order({ source: "POS" }),
      order({ source: "STOREFRONT" }),
      order({ source: "GOFOOD" }),
      order({ source: "GRABFOOD" }),
    ];
    expect(countOrdersBySource(orders)).toEqual({ POS: 2, ONLINE: 3 });
    expect(countOrdersBySource([])).toEqual({ POS: 0, ONLINE: 0 });
  });

  it("reads a persisted 'ALL' (or junk) as POS, since there is no All tab", () => {
    expect(toSourceTab("ONLINE")).toBe("ONLINE");
    expect(toSourceTab("POS")).toBe("POS");
    expect(toSourceTab("ALL")).toBe("POS");
    expect(toSourceTab(undefined)).toBe("POS");
    expect(toSourceTab(42)).toBe("POS");
  });

  it("no longer offers source as an add-filter option — the tabs are the source control", () => {
    expect(QUEUE_FILTER_KEYS).not.toContain("source" as never);
  });

  it("filters to the selected tab", () => {
    const pos = order({ source: "POS" });
    const online = order({ source: "STOREFRONT" });
    expect(match(pos, { sourceFilter: "POS" })).toBe(true);
    expect(match(online, { sourceFilter: "POS" })).toBe(false);
    expect(match(online, { sourceFilter: "ONLINE" })).toBe(true);
  });
});

describe("matchesQueueFilters — queue number search", () => {
  it("finds an order by its call-out number, with or without the #", () => {
    const o = order({ queueNumber: 12 });
    expect(match(o, { search: "12" })).toBe(true);
    expect(match(o, { search: "#12" })).toBe(true);
    expect(match(o, { search: "13" })).toBe(false);
  });

  it("does not match a missing queue number on the literal 'null'", () => {
    expect(match(order({ queueNumber: null }), { search: "null" })).toBe(false);
    expect(match(order({ queueNumber: undefined }), { search: "#" })).toBe(false);
  });
});

describe("matchesQueueDate — the queue's date scope", () => {
  // Local-time constructor: the queue measures a day on the user's own clock.
  const NOW = new Date(2026, 8, 19, 15, 0, 0);
  const placed = (d: number, h: number, mi = 0) =>
    order({ createdAt: new Date(2026, 8, d, h, mi).toISOString() });

  it("defaults to today", () => {
    expect(DEFAULT_QUEUE_DATE_PRESET).toBe("today");
  });

  it("offers the presets but not a custom range (it is a work queue, not a report)", () => {
    expect(QUEUE_DATE_PRESETS).toContain("today");
    expect(QUEUE_DATE_PRESETS).toContain("all");
    expect(QUEUE_DATE_PRESETS as readonly string[]).not.toContain("custom");
  });

  it("today: 00:00 on the local clock is in, the minute before is not", () => {
    expect(matchesQueueDate(placed(19, 0, 0), "today", NOW)).toBe(true);
    expect(matchesQueueDate(placed(18, 23, 59), "today", NOW)).toBe(false);
    expect(matchesQueueDate(placed(19, 23, 59), "today", NOW)).toBe(true);
    expect(matchesQueueDate(placed(20, 0, 0), "today", NOW)).toBe(false);
  });

  it("today keeps an order placed in the small hours, which a UTC day would file under yesterday", () => {
    expect(matchesQueueDate(placed(19, 1, 30), "today", NOW)).toBe(true);
  });

  it("yesterday and the ranges", () => {
    expect(matchesQueueDate(placed(18, 12), "yesterday", NOW)).toBe(true);
    expect(matchesQueueDate(placed(19, 12), "yesterday", NOW)).toBe(false);
    expect(matchesQueueDate(placed(13, 12), "last7", NOW)).toBe(true);
    expect(matchesQueueDate(placed(12, 12), "last7", NOW)).toBe(false);
  });

  it("all time never excludes", () => {
    expect(matchesQueueDate(order({ createdAt: "2001-01-01T00:00:00.000Z" }), "all", NOW)).toBe(
      true
    );
  });
});
