/**
 * Order-history `where` builder. The payment-method clause gets the weight:
 * it has to match a bill by its tenders as well as by `Order.paymentMethod`
 * (which is the literal "SPLIT" for a multi-tender sale), and it has to do so
 * WITHOUT stepping on the free-text search, which already owns `where.OR`.
 */
import { describe, it, expect } from "vitest";
import { buildOrderHistoryWhere } from "../order-history-query";

const STORE = "store-1";

describe("buildOrderHistoryWhere — payment method", () => {
  it("matches the whole-order method or any tender", () => {
    const where = buildOrderHistoryWhere(STORE, { paymentMethod: "CASH" });
    expect(where.AND).toEqual([
      { OR: [{ paymentMethod: "CASH" }, { payments: { some: { method: "CASH" } } }] },
    ]);
    // Never written as a bare top-level OR — see below.
    expect(where.OR).toBeUndefined();
  });

  it("coexists with the free-text search instead of clobbering it", () => {
    // Two `OR` keys in one object means the second silently wins, and the
    // filter (or the search) stops working with no error anywhere.
    const where = buildOrderHistoryWhere(STORE, { paymentMethod: "CASH", q: "0042" });
    expect(where.OR).toEqual([
      { orderNumber: { contains: "0042", mode: "insensitive" } },
      { customerName: { contains: "0042", mode: "insensitive" } },
    ]);
    expect(where.AND).toHaveLength(1);
  });

  it("ignores a value that is not a PaymentMethod", () => {
    const where = buildOrderHistoryWhere(STORE, { paymentMethod: "BITCOIN" });
    expect(where.AND).toBeUndefined();
  });

  it("accepts SPLIT, which selects multi-tender bills", () => {
    const where = buildOrderHistoryWhere(STORE, { paymentMethod: "SPLIT" });
    expect(where.AND).toBeDefined();
  });
});

describe("buildOrderHistoryWhere — everything else is unchanged", () => {
  it("always scopes to the store", () => {
    expect(buildOrderHistoryWhere(STORE, {}).storeId).toBe(STORE);
  });

  it("keeps status/source/unpaid/staff/date/item filters as they were", () => {
    const where = buildOrderHistoryWhere(STORE, {
      status: "DELIVERED",
      source: "POS",
      unpaid: true,
      staffId: "staff-1",
      productId: "menu-1",
      department: "BAR",
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-30T00:00:00Z",
    });

    expect(where.status).toBe("DELIVERED");
    expect(where.source).toBe("POS");
    expect(where.paymentStatus).toBe("PENDING");
    expect(where.shift).toEqual({ staffMemberId: "staff-1" });
    expect(where.items).toEqual({
      some: {
        menuItemId: "menu-1",
        OR: [{ menuItem: { department: "BAR" } }, { department: "BAR" }],
      },
    });
    expect(where.orderDate).toEqual({
      gte: new Date("2026-09-01T00:00:00Z"),
      lte: new Date("2026-09-30T00:00:00Z"),
    });
  });

  it("matches a Custom Item's own department, not just a MenuItem's", () => {
    // A Custom Item has menuItemId null and carries its prep area on
    // OrderItem.department; going through the relation alone drops every
    // hand-typed line from a Kitchen/Bar filter.
    const where = buildOrderHistoryWhere(STORE, { department: "KITCHEN" });
    expect(where.items).toEqual({
      some: { OR: [{ menuItem: { department: "KITCHEN" } }, { department: "KITCHEN" }] },
    });
  });

  it("ignores a department that is not a Department enum member", () => {
    expect(buildOrderHistoryWhere(STORE, { department: "PASTRY" }).items).toBeUndefined();
  });

  it("drops an unparseable date rather than filtering on NaN", () => {
    const where = buildOrderHistoryWhere(STORE, { from: "not-a-date" });
    expect(where.orderDate).toEqual({});
  });
});
