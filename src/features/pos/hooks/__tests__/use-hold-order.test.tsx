import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "../../components/__tests__/cart-test-utils";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import {
  buildHoldBody,
  cartToHoldInput,
  useHoldOrder,
  type CartHoldSource,
} from "../use-hold-order";
import type { CartItem } from "../../types/pos.types";

const post = vi.mocked(apiClient.post);

const ramen: CartItem = {
  id: "l1",
  menuItemId: "m1",
  name: "Ramen",
  unitPrice: 10,
  quantity: 2,
  modifiers: [{ groupName: "Size", optionName: "Large", priceAdjustment: 1 }],
  notes: "hot",
  lineTotal: 22,
};
const custom: CartItem = {
  id: "l2",
  menuItemId: null,
  isCustom: true,
  name: "Delivery fee",
  unitPrice: 4,
  quantity: 1,
  modifiers: [],
  lineTotal: 4,
  department: "KITCHEN",
};

const cartSource = (over: Partial<CartHoldSource> = {}): CartHoldSource => ({
  items: [ramen],
  orderType: "DINE_IN",
  onlinePlatform: null,
  guestCount: 3,
  tableNumber: " A1 ",
  tableId: null,
  customer: null,
  discountSource: null,
  resumingOrderId: null,
  ...over,
});

describe("buildHoldBody", () => {
  it("sends menu lines the legacy way and custom lines as custom:true", () => {
    const body = buildHoldBody({ items: [ramen, custom], orderType: "DINE_IN" });
    expect(body.items).toEqual([
      {
        menuItemId: "m1",
        name: "Ramen",
        quantity: 2,
        unitPrice: 10,
        selectedOptions: ramen.modifiers,
        notes: "hot",
      },
      {
        custom: true,
        name: "Delivery fee",
        quantity: 1,
        unitPrice: 4,
        notes: undefined,
        department: "KITCHEN",
      },
    ]);
  });

  it("sends the customer so a resumed bill restores who it was for", () => {
    const body = buildHoldBody({
      items: [ramen],
      orderType: "DINE_IN",
      customerId: "c1",
      customerName: "Alice",
      customerPhone: "+33612345678",
    });
    expect(body).toMatchObject({
      customerId: "c1",
      customerName: "Alice",
      customerPhone: "+33612345678",
    });
  });

  it("a MANUAL discount goes as amount + reason", () => {
    const body = buildHoldBody({
      items: [ramen],
      orderType: "DINE_IN",
      discount: { kind: "manual", amount: 5, reason: "Regular" },
    });
    expect(body).toMatchObject({ discountAmount: 5, discountReason: "Regular" });
    expect("presetId" in body).toBe(false);
  });

  it("a PRESET goes as its id ONLY — the server re-prices it, so no computed amount is sent", () => {
    const body = buildHoldBody({
      items: [ramen],
      orderType: "DINE_IN",
      discount: { kind: "preset", presetId: "p1", name: "Member", type: "PERCENT", value: 10 },
    });
    expect(body).toMatchObject({ presetId: "p1" });
    expect("discountAmount" in body).toBe(false);
    expect("discountReason" in body).toBe(false);
  });

  it("a COUPON is not sent — it only spends its use at placement", () => {
    const body = buildHoldBody({
      items: [ramen],
      orderType: "DINE_IN",
      discount: {
        kind: "coupon",
        couponId: "cp1",
        code: "SAVE10",
        type: "PERCENT",
        value: 10,
        minSubtotal: null,
      },
    });
    expect("discountAmount" in body).toBe(false);
    expect("presetId" in body).toBe(false);
    expect("couponCode" in body).toBe(false);
  });

  it("never sends redeemed points (they burn balance, so they only settle at placement)", () => {
    const body = buildHoldBody({ items: [ramen], orderType: "DINE_IN", customerId: "c1" });
    expect("redeemPoints" in body).toBe(false);
  });

  it("serializes cleanly — undefined fields simply drop out", () => {
    const json = JSON.parse(
      JSON.stringify(buildHoldBody({ items: [ramen], orderType: "TAKEAWAY" }))
    );
    expect(json.customerId).toBeUndefined();
    expect(json.orderType).toBe("TAKEAWAY");
  });
});

describe("cartToHoldInput", () => {
  it("carries order type, pax, trimmed table, customer and discount from the cart", () => {
    const input = cartToHoldInput(
      cartSource({
        customer: { id: "c1", name: "Alice", phone: "+33" },
        discountSource: { kind: "manual", amount: 3, reason: "x" },
      }),
      { shiftId: "sh1", notes: "  no onions " }
    );
    expect(input).toMatchObject({
      orderType: "DINE_IN",
      guestCount: 3,
      tableNumber: "A1",
      customerId: "c1",
      customerName: "Alice",
      customerPhone: "+33",
      discount: { kind: "manual", amount: 3, reason: "x" },
      notes: "no onions",
      shiftId: "sh1",
    });
  });

  it("only sends pax for dine-in", () => {
    expect(cartToHoldInput(cartSource({ orderType: "TAKEAWAY" })).guestCount).toBeUndefined();
    expect(cartToHoldInput(cartSource({ orderType: "DINE_IN" })).guestCount).toBe(3);
  });

  it("re-saves a resumed bill in place by passing its id", () => {
    expect(cartToHoldInput(cartSource({ resumingOrderId: "order_9" })).orderId).toBe("order_9");
    expect(cartToHoldInput(cartSource()).orderId).toBeUndefined();
  });

  it("the walk-in label applies only when nobody is attached", () => {
    expect(cartToHoldInput(cartSource(), { label: " Budi " }).customerName).toBe("Budi");
    expect(
      cartToHoldInput(cartSource({ customer: { id: "c1", name: "Alice" } }), { label: "Budi" })
        .customerName
    ).toBe("Alice");
    expect(cartToHoldInput(cartSource(), { label: "  " }).customerName).toBeUndefined();
  });

  it("a detached customer sends no customerId (a re-save without one clears it)", () => {
    const input = cartToHoldInput(cartSource({ resumingOrderId: "order_9", customer: null }));
    expect(input.customerId).toBeUndefined();
    expect(input.orderId).toBe("order_9");
  });

  it("lets the Save Bill dialog's table override the cart's", () => {
    expect(cartToHoldInput(cartSource(), { tableNumber: "B2" }).tableNumber).toBe("B2");
    expect(
      cartToHoldInput(cartSource({ tableNumber: "" }), { tableNumber: "" }).tableNumber
    ).toBeUndefined();
  });

  it("keeps a registered table linked, unless the Save Bill dialog retyped it", () => {
    const seated = cartSource({ tableNumber: "A1", tableId: "t1" });
    expect(cartToHoldInput(seated).tableId).toBe("t1");
    expect(cartToHoldInput(seated, { tableNumber: "A1" }).tableId).toBe("t1");
    expect(cartToHoldInput(seated, { tableNumber: "A1 terrace" }).tableId).toBeUndefined();
    // Only a dine-in sale sits at a table.
    expect(cartToHoldInput({ ...seated, orderType: "TAKEAWAY" }).tableId).toBeUndefined();
  });

  it("sends the online platform with a DELIVERY, and no pax", () => {
    const input = cartToHoldInput(
      cartSource({ orderType: "DELIVERY", onlinePlatform: "SHOPEEFOOD" })
    );
    expect(input).toMatchObject({ orderType: "DELIVERY", onlinePlatform: "SHOPEEFOOD" });
    expect(input.guestCount).toBeUndefined();
    expect(buildHoldBody(input)).toMatchObject({
      orderType: "DELIVERY",
      onlinePlatform: "SHOPEEFOOD",
    });
  });
});

describe("useHoldOrder", () => {
  beforeEach(() => post.mockReset());

  it("POSTs the built body to /pos/orders/hold and returns the saved order's id", async () => {
    post.mockResolvedValue({ orderId: "o1", orderNumber: "POS-1" });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useHoldOrder("s1"), { wrapper: Wrapper });

    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync({
        items: [ramen],
        orderType: "DINE_IN",
        customerId: "c1",
      });
    });

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/stores/s1/pos/orders/hold");
    expect(post.mock.calls[0][1]).toMatchObject({ customerId: "c1", orderType: "DINE_IN" });
    expect(saved).toEqual({ orderId: "o1", orderNumber: "POS-1" });
  });
});
