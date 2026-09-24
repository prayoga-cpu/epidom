import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildResumeExtras,
  fallbackCustomerFromOrder,
  orderItemsToCartItems,
  type ResumableOrder,
} from "../order-to-cart";
import { cartItemsToWireLines, isCustomLine } from "../cart-wire";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { apiClient, ApiClientError } from "@/lib/api/client";
import { resumeOrderIntoCart } from "../../hooks/use-resume-order";
import { usePosCart } from "../../hooks/use-pos-cart";

const get = vi.mocked(apiClient.get);
const cart = () => usePosCart.getState();

const order = (over: Partial<ResumableOrder> = {}): ResumableOrder =>
  ({
    id: "order_1",
    orderNumber: "POS-1",
    status: "HELD",
    source: "POS",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    customerName: "Walk-in",
    subtotal: 0,
    total: 0,
    createdAt: "2026-09-19T00:00:00.000Z",
    guestCount: 3,
    tableNumber: "A1",
    discountAmount: 0,
    discountReason: null,
    items: [
      {
        id: "i1",
        menuItemId: "m1",
        name: "Ramen",
        quantity: 2,
        unitPrice: 10,
        total: 21,
        status: "PENDING",
        selectedOptions: [{ groupName: "Size", optionName: "Large", priceAdjustment: 0.5 }],
        notes: "hot",
        menuItem: { name: "Ramen (menu)" },
      },
    ],
    ...over,
  }) as unknown as ResumableOrder;

describe("orderItemsToCartItems", () => {
  it("rebuilds a menu line with its modifiers, note and money as numbers", () => {
    const [line] = orderItemsToCartItems(order().items);
    expect(line).toEqual({
      id: "i1",
      menuItemId: "m1",
      name: "Ramen (menu)",
      unitPrice: 10,
      quantity: 2,
      modifiers: [{ groupName: "Size", optionName: "Large", priceAdjustment: 0.5 }],
      notes: "hot",
      lineTotal: 21,
    });
  });

  it("coerces Decimal-as-string money back to numbers (else totals become string concatenation)", () => {
    const [line] = orderItemsToCartItems([
      {
        ...order().items[0],
        unitPrice: "10.50" as any,
        quantity: "2" as any,
        total: "21.00" as any,
      },
    ]);
    expect(line.unitPrice).toBe(10.5);
    expect(line.quantity).toBe(2);
    expect(line.lineTotal).toBe(21);
  });

  it("keeps a Custom Item as its own custom line (null menu item, department kept)", () => {
    const [line] = orderItemsToCartItems([
      {
        id: "c1",
        menuItemId: null,
        name: "Delivery fee",
        quantity: 1,
        unitPrice: 4,
        total: 4,
        status: "SERVED",
        isCustom: true,
        department: "BAR",
      } as any,
    ]);
    expect(line).toMatchObject({
      id: "c1",
      menuItemId: null,
      isCustom: true,
      department: "BAR",
      name: "Delivery fee",
    });
  });

  it("treats a line whose MenuItem was deleted since (null id, not flagged custom) as a custom line", () => {
    const [line] = orderItemsToCartItems([
      {
        id: "x",
        menuItemId: null,
        name: "Old special",
        quantity: 1,
        unitPrice: 8,
        total: 8,
        status: "PENDING",
      } as any,
    ]);
    expect(line.menuItemId).toBeNull();
    expect(line.isCustom).toBe(true);
    expect(line.department).toBeNull();
  });

  it("never invents a 'BOTH' prep area for a custom line", () => {
    const [line] = orderItemsToCartItems([
      {
        id: "x",
        menuItemId: null,
        isCustom: true,
        department: "BOTH",
        name: "?",
        quantity: 1,
        unitPrice: 1,
        total: 1,
        status: "SERVED",
      } as any,
    ]);
    expect(line.department).toBeNull();
  });

  it("two identical custom lines stay two lines", () => {
    const lines = orderItemsToCartItems([
      {
        id: "a",
        menuItemId: null,
        isCustom: true,
        name: "Extra",
        quantity: 1,
        unitPrice: 5,
        total: 5,
        status: "SERVED",
      },
      {
        id: "b",
        menuItemId: null,
        isCustom: true,
        name: "Extra",
        quantity: 1,
        unitPrice: 5,
        total: 5,
        status: "SERVED",
      },
    ] as any);
    expect(lines).toHaveLength(2);
  });
});

describe("buildResumeExtras", () => {
  it("restores order type, pax and table", () => {
    expect(buildResumeExtras(order(), null)).toMatchObject({
      orderType: "DINE_IN",
      guestCount: 3,
      tableNumber: "A1",
    });
  });

  it("restores takeaway", () => {
    expect(buildResumeExtras(order({ orderType: "TAKEAWAY" }), null).orderType).toBe("TAKEAWAY");
  });

  it("restores a bill saved under a delivery platform as that platform", () => {
    expect(
      buildResumeExtras(order({ orderType: "DELIVERY", source: "GRABFOOD" }), null)
    ).toMatchObject({ orderType: "DELIVERY", onlinePlatform: "GRABFOOD" });
  });

  it("restores a dine-in bill's registered table link, and never a takeaway's", () => {
    expect(buildResumeExtras(order({ tableId: "t1", tableNumber: "A1" }), null)).toMatchObject({
      tableId: "t1",
      tableNumber: "A1",
    });
    expect(
      buildResumeExtras(order({ orderType: "TAKEAWAY", tableId: "t1" }), null).tableId
    ).toBeNull();
  });

  it("never restores a platform for a till sale", () => {
    expect(buildResumeExtras(order({ source: "POS" }), null)).toMatchObject({
      orderType: "DINE_IN",
      onlinePlatform: null,
    });
  });

  it("ALWAYS passes every field, so the previous cart's state can't leak onto a resumed bill", () => {
    const extras = buildResumeExtras(
      order({ guestCount: null, tableNumber: null, discountAmount: 0 }),
      null
    );
    expect(extras).toEqual({
      orderType: "DINE_IN",
      onlinePlatform: null,
      guestCount: 1,
      tableNumber: "",
      tableId: null,
      customer: null,
      discountSource: null,
    });
  });

  it("restores the held discount as a flat manual discount with its reason", () => {
    expect(
      buildResumeExtras(order({ discountAmount: 12.5, discountReason: "Preset: Member" }), null)
        .discountSource
    ).toEqual({ kind: "manual", amount: 12.5, reason: "Preset: Member" });
  });

  it("reads a Decimal-as-string discount", () => {
    expect(
      buildResumeExtras(order({ discountAmount: "7.00" as any }), null).discountSource
    ).toEqual({
      kind: "manual",
      amount: 7,
      reason: undefined,
    });
  });

  it("passes the customer through", () => {
    const customer = {
      id: "c1",
      name: "Alice",
      phone: null,
      email: null,
      points: 5,
      lifetimeSpend: 9,
    };
    expect(buildResumeExtras(order(), customer).customer).toBe(customer);
  });
});

describe("fallbackCustomerFromOrder", () => {
  it("is null for a walk-in", () => {
    expect(fallbackCustomerFromOrder(order({ customerId: null }))).toBeNull();
  });

  it("stands in for the customer from the order row alone", () => {
    expect(
      fallbackCustomerFromOrder(
        order({ customerId: "c1", customerName: "Alice", customerPhone: "+33" })
      )
    ).toEqual({ id: "c1", name: "Alice", phone: "+33", email: null, points: 0, lifetimeSpend: 0 });
  });
});

describe("resumeOrderIntoCart", () => {
  beforeEach(() => {
    localStorage.clear();
    cart().clearCart();
    get.mockReset();
  });

  const freshCustomer = {
    id: "c1",
    name: "Alice Martin",
    phone: "+33612345678",
    email: "a@b.fr",
    notes: null,
    points: 250,
    memberSince: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lifetimeSpend: 999,
    orderCount: 3,
    lastOrderAt: null,
    orders: [],
    loyaltyEntries: [],
  };

  it("hydrates the cart with lines, context and the customer read fresh from GET /customers/[id]", async () => {
    get.mockResolvedValue(freshCustomer as any);
    await resumeOrderIntoCart(
      "s1",
      order({ customerId: "c1", customerName: "Alice", orderType: "TAKEAWAY", tableNumber: "B2" })
    );

    expect(get).toHaveBeenCalledWith("/stores/s1/customers/c1");
    expect(cart().resumingOrderId).toBe("order_1");
    expect(cart()).toMatchObject({ orderType: "TAKEAWAY", tableNumber: "B2", guestCount: 3 });
    // The fresh balance, not whatever the order row happened to say.
    expect(cart().customer).toEqual({
      id: "c1",
      name: "Alice Martin",
      phone: "+33612345678",
      email: "a@b.fr",
      points: 250,
      lifetimeSpend: 999,
    });
    expect(cart().items).toHaveLength(1);
  });

  it("does not touch the network for a walk-in bill", async () => {
    await resumeOrderIntoCart("s1", order());
    expect(get).not.toHaveBeenCalled();
    expect(cart().customer).toBeNull();
  });

  it("still resumes, with a stand-in customer, when the customer can't be fetched (offline)", async () => {
    get.mockRejectedValue(new Error("Network error occurred"));
    await resumeOrderIntoCart("s1", order({ customerId: "c1", customerName: "Alice" }));
    expect(cart().resumingOrderId).toBe("order_1");
    expect(cart().customer).toMatchObject({ id: "c1", name: "Alice", points: 0 });
  });

  it("resumes WITHOUT the customer when they were deleted since (404)", async () => {
    get.mockRejectedValue(
      new ApiClientError({ success: false, error: { code: "NOT_FOUND", message: "x" } } as any, 404)
    );
    await resumeOrderIntoCart("s1", order({ customerId: "gone", customerName: "Ghost" }));
    expect(cart().resumingOrderId).toBe("order_1");
    expect(cart().customer).toBeNull();
  });

  it("wipes the previous sale's table, pax, customer and discount instead of leaking them", async () => {
    cart().setTableNumber("Z9");
    cart().setGuestCount(8);
    cart().setCustomer({
      id: "old",
      name: "Old",
      phone: null,
      email: null,
      points: 1,
      lifetimeSpend: 1,
    });
    cart().addItem("m9", "Old item", 5, 1);
    cart().setDiscount(2, "old");

    await resumeOrderIntoCart("s1", order({ guestCount: null, tableNumber: null }));

    expect(cart()).toMatchObject({
      tableNumber: "",
      guestCount: 1,
      customer: null,
      discountSource: null,
    });
    expect(cart().discountAmount).toBe(0);
  });

  it("restores the held discount so the total matches what was saved", async () => {
    await resumeOrderIntoCart("s1", order({ discountAmount: 5, discountReason: "Regular" }));
    expect(cart().discountSource).toEqual({ kind: "manual", amount: 5, reason: "Regular" });
    expect(cart().discountAmount).toBe(5);
    expect(cart().total).toBe(16); // 21 line total − 5
  });
});

describe("cart lines on the wire (hold, checkout)", () => {
  it("sends a menu line the old way — legacy payloads stay valid", () => {
    const [wire] = cartItemsToWireLines([
      {
        id: "l1",
        menuItemId: "m1",
        name: "Ramen",
        unitPrice: 10,
        quantity: 2,
        modifiers: [],
        notes: "hot",
        lineTotal: 20,
      },
    ]);
    expect(wire).toEqual({
      menuItemId: "m1",
      name: "Ramen",
      quantity: 2,
      unitPrice: 10,
      selectedOptions: [],
      notes: "hot",
    });
    expect("custom" in wire).toBe(false);
  });

  it("sends a Custom Item as custom:true with its prep area and NO menuItemId", () => {
    const [wire] = cartItemsToWireLines([
      {
        id: "l2",
        menuItemId: null,
        isCustom: true,
        name: "Gift wrap",
        unitPrice: 2.5,
        quantity: 2,
        modifiers: [],
        lineTotal: 5,
        department: "BAR",
        notes: "blue",
      },
    ]);
    expect(wire).toEqual({
      custom: true,
      name: "Gift wrap",
      quantity: 2,
      unitPrice: 2.5,
      notes: "blue",
      department: "BAR",
    });
    expect("menuItemId" in wire).toBe(false);
  });

  it("a custom line with no prep area sends department null", () => {
    const [wire] = cartItemsToWireLines([
      {
        id: "l3",
        menuItemId: null,
        isCustom: true,
        name: "Fee",
        unitPrice: 1,
        quantity: 1,
        modifiers: [],
        lineTotal: 1,
      },
    ]);
    expect((wire as any).department).toBeNull();
  });

  it("recognises a custom line by a null OR empty menu item id", () => {
    expect(isCustomLine({ menuItemId: null })).toBe(true);
    expect(isCustomLine({ menuItemId: "" })).toBe(true);
    expect(isCustomLine({ menuItemId: "m1", isCustom: true })).toBe(true);
    expect(isCustomLine({ menuItemId: "m1" })).toBe(false);
  });
});
