import { describe, it, expect, beforeEach } from "vitest";
import { MAX_HELD_SALES, usePosCart } from "../use-pos-cart";
import type { CartCustomer } from "../../types/pos.types";
import type { ResolvedFinanceSettings } from "@/lib/finance/order-charges";
import type { LoyaltyRules } from "@/lib/finance/discounts";

const noCharges: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

const loyalty: LoyaltyRules = {
  enabled: true,
  spendPerPoint: 10_000,
  pointValue: 100,
  minRedeemPoints: 0,
};

const alice: CartCustomer = {
  id: "cust_1",
  name: "Alice",
  phone: "+628123",
  email: null,
  points: 300,
  lifetimeSpend: 1_000_000,
};

const cart = () => usePosCart.getState();

beforeEach(() => {
  localStorage.clear();
  usePosCart.setState({ boundStoreId: null, parkedCarts: {}, heldSales: {} });
  cart().clearCart();
  cart().setFinanceSettings(noCharges);
  cart().setLoyaltyRules(null);
});

describe("usePosCart — totals", () => {
  it("adds items and totals them", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().addItem("m2", "Tea", 10_000, 1);
    expect(cart().subtotal).toBe(110_000);
    expect(cart().total).toBe(110_000);
  });

  it("merges identical lines but keeps a custom item on its own line", () => {
    cart().addItem("m1", "Ramen", 50_000, 1);
    cart().addItem("m1", "Ramen", 50_000, 1);
    cart().addCustomItem({ name: "Delivery help", unitPrice: 5_000, quantity: 1 });
    cart().addCustomItem({ name: "Delivery help", unitPrice: 5_000, quantity: 1 });
    expect(cart().items).toHaveLength(3);
    expect(cart().items[0].quantity).toBe(2);
    expect(cart().total).toBe(110_000);
  });

  it("a custom item has no menu item and records its prep area", () => {
    cart().addCustomItem({
      name: "Gift wrap",
      unitPrice: 2_500,
      quantity: 2,
      department: "BAR",
      notes: "blue",
    });
    expect(cart().items[0]).toMatchObject({
      menuItemId: null,
      isCustom: true,
      department: "BAR",
      notes: "blue",
      lineTotal: 5_000,
    });
  });

  it("a custom item with no department means no prep area (null)", () => {
    cart().addCustomItem({ name: "Service fee", unitPrice: 1_000, quantity: 1 });
    expect(cart().items[0].department).toBeNull();
  });

  it("removeLines takes quantity off a line and drops it at zero", () => {
    cart().addItem("m1", "Ramen", 50_000, 3);
    cart().addItem("m2", "Tea", 10_000, 1);
    const [ramen, tea] = cart().items;
    cart().removeLines([
      { lineId: ramen.id, quantity: 2 },
      { lineId: tea.id, quantity: 1 },
    ]);
    expect(cart().items.map((i) => [i.name, i.quantity])).toEqual([["Ramen", 1]]);
    expect(cart().total).toBe(50_000);
  });
});

describe("usePosCart — discounts", () => {
  it("a manual discount comes off the total", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setDiscount(10_000, "Regular");
    expect(cart().discountAmount).toBe(10_000);
    expect(cart().discountReason).toBe("Regular");
    expect(cart().total).toBe(90_000);
    cart().setDiscount(null);
    expect(cart().discountAmount).toBe(0);
    expect(cart().discountReason).toBeNull();
  });

  it("a PERCENT preset re-prices as the cart changes", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    expect(cart().discountAmount).toBe(10_000);
    cart().addItem("m2", "Tea", 10_000, 1);
    expect(cart().discountAmount).toBe(11_000);
    expect(cart().discountReason).toBe("Member");
  });

  it("a FIXED preset is literal and never exceeds the cart", () => {
    cart().addItem("m1", "Tea", 4, 1);
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Five off",
      type: "FIXED",
      value: 5,
    });
    expect(cart().discountAmount).toBe(4);
    expect(cart().total).toBe(0);
  });

  it("a coupon stops applying if the cart drops under its minimum", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "c1",
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
      minSubtotal: 100_000,
    });
    expect(cart().discountAmount).toBe(10_000);
    cart().updateQuantity(cart().items[0].id, 1);
    expect(cart().discountAmount).toBe(0);
    cart().updateQuantity(cart().items[0].id, 2);
    expect(cart().discountAmount).toBe(10_000);
  });

  it("only one primary discount at a time — the latest wins", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setDiscount(20_000);
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    expect(cart().discountAmount).toBe(10_000);
  });

  it("carries a v0 persisted manual discount across the upgrade", async () => {
    localStorage.setItem(
      "epidom-pos-cart",
      JSON.stringify({
        state: { discountAmount: 7_000, discountReason: "Old", items: [] },
        version: 0,
      })
    );
    await usePosCart.persist.rehydrate();
    expect(cart().discountSource).toEqual({ kind: "manual", amount: 7_000, reason: "Old" });
  });
});

describe("usePosCart — loyalty points", () => {
  beforeEach(() => {
    cart().setLoyaltyRules(loyalty);
    cart().addItem("m1", "Ramen", 50_000, 1);
  });

  it("redeeming needs a customer", () => {
    cart().setRedeemPoints(100);
    expect(cart().pointsRedeemed).toBe(0);
    expect(cart().discountAmount).toBe(0);
    // Attaching a customer starts from a clean slate (same rule as switching customers).
    cart().setCustomer(alice);
    expect(cart().redeemPoints).toBe(0);
    cart().setRedeemPoints(100);
    expect(cart().pointsRedeemed).toBe(100);
    expect(cart().pointsDiscountAmount).toBe(10_000);
    expect(cart().total).toBe(40_000);
  });

  it("stacks on top of a preset, and can only cover what is left payable", () => {
    cart().setCustomer(alice);
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Half",
      type: "PERCENT",
      value: 50,
    });
    cart().setRedeemPoints(300); // asks for 30,000 but only 25,000 is payable
    expect(cart().primaryDiscountAmount).toBe(25_000);
    expect(cart().pointsRedeemed).toBe(250);
    expect(cart().discountAmount).toBe(50_000);
    expect(cart().total).toBe(0);
    expect(cart().discountReason).toBe("Half + 250 pts");
  });

  it("switching customer resets the redemption; detaching clears it", () => {
    cart().setCustomer(alice);
    cart().setRedeemPoints(100);
    cart().setCustomer({ ...alice, id: "cust_2", name: "Bob" });
    expect(cart().redeemPoints).toBe(0);
    cart().setRedeemPoints(100);
    cart().setCustomer(null);
    expect(cart().pointsRedeemed).toBe(0);
    expect(cart().total).toBe(50_000);
  });

  it("refreshing the SAME customer keeps the redemption", () => {
    cart().setCustomer(alice);
    cart().setRedeemPoints(100);
    cart().setCustomer({ ...alice, points: 250 });
    expect(cart().redeemPoints).toBe(100);
  });

  it("does nothing when loyalty is disabled", () => {
    cart().setLoyaltyRules({ ...loyalty, enabled: false });
    cart().setCustomer(alice);
    cart().setRedeemPoints(100);
    expect(cart().pointsRedeemed).toBe(0);
  });
});

describe("usePosCart — order type, resume and clear", () => {
  it("defaults to dine-in for a guest and clears back to that after a sale", () => {
    expect(cart().orderType).toBe("DINE_IN");
    cart().setOrderType("TAKEAWAY");
    cart().setGuestCount(4);
    cart().setTableNumber("A1");
    cart().addItem("m1", "Ramen", 50_000, 1);
    cart().setCustomer(alice);
    cart().clearCart();
    expect(cart()).toMatchObject({
      orderType: "DINE_IN",
      guestCount: 1,
      tableNumber: "",
      customer: null,
      items: [],
      total: 0,
    });
  });

  it("clamps the guest count to 1–99", () => {
    cart().setGuestCount(0);
    expect(cart().guestCount).toBe(1);
    cart().setGuestCount(500);
    expect(cart().guestCount).toBe(99);
  });

  it("clearing keeps the store's finance and loyalty settings", () => {
    cart().setLoyaltyRules(loyalty);
    cart().setFinanceSettings({
      ...noCharges,
      taxEnabled: true,
      taxRate: 0.1,
      taxInclusive: false,
    });
    cart().clearCart();
    expect(cart().loyaltyRules).toEqual(loyalty);
    expect(cart().financeSettings.taxEnabled).toBe(true);
  });

  it("hydrateFromOrder restores the bill's context and keeps custom lines distinct", () => {
    cart().hydrateFromOrder(
      [
        {
          id: "l1",
          menuItemId: "m1",
          name: "Ramen",
          unitPrice: 50_000,
          quantity: 1,
          modifiers: [],
          lineTotal: 50_000,
        },
        {
          id: "l2",
          menuItemId: null,
          isCustom: true,
          name: "Extra",
          unitPrice: 5_000,
          quantity: 1,
          modifiers: [],
          lineTotal: 5_000,
          department: null,
        },
        {
          id: "l3",
          menuItemId: null,
          isCustom: true,
          name: "Extra",
          unitPrice: 5_000,
          quantity: 1,
          modifiers: [],
          lineTotal: 5_000,
          department: null,
        },
      ],
      "order_1",
      { orderType: "TAKEAWAY", tableNumber: "B2", customer: alice }
    );
    expect(cart().items).toHaveLength(3);
    expect(cart().resumingOrderId).toBe("order_1");
    expect(cart()).toMatchObject({ orderType: "TAKEAWAY", tableNumber: "B2" });
    expect(cart().customer?.id).toBe("cust_1");
    expect(cart().total).toBe(60_000);
  });

  it("keeps split-payment tender rows across a reload-style rehydrate, until cleared", async () => {
    cart().setDraftTenders([
      { id: "t1", method: "CASH", amount: 100, amountTendered: 200, note: "" },
    ]);
    await usePosCart.persist.rehydrate();
    expect(cart().draftTenders).toHaveLength(1);
    cart().clearCart();
    expect(cart().draftTenders).toEqual([]);
  });
});

// The cart is saved on the device. Opened in another store, its lines are that
// other store's menu items and checkout refuses every one of them.
describe("usePosCart — one cart per store", () => {
  it("adopts a cart saved before carts knew their store", () => {
    cart().addItem("m1", "Ramen", 50_000, 1);

    cart().bindStore("store-a");

    expect(cart().boundStoreId).toBe("store-a");
    expect(cart().items).toHaveLength(1);
  });

  it("does nothing when the till reopens on the same store", () => {
    cart().bindStore("store-a");
    cart().addItem("m1", "Ramen", 50_000, 2);

    cart().bindStore("store-a");

    expect(cart().items).toHaveLength(1);
    expect(cart().parkedCarts).toEqual({});
  });

  it("parks a store's cart when another store opens, and gives it back on return", () => {
    cart().bindStore("store-a");
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setCustomer(alice);
    cart().setTable({ id: "t1", label: "T1" });
    cart().setResumingOrderId("order-9");

    cart().bindStore("store-b");

    // Store B starts clean: nothing of A's sale follows the cashier in.
    expect(cart().items).toEqual([]);
    expect(cart().total).toBe(0);
    expect(cart().customer).toBeNull();
    expect(cart().tableId).toBeNull();
    expect(cart().resumingOrderId).toBeNull();

    cart().addItem("b1", "Bagel", 20_000, 1);
    cart().bindStore("store-a");

    expect(cart().items.map((i) => [i.menuItemId, i.quantity])).toEqual([["m1", 2]]);
    expect(cart().subtotal).toBe(100_000);
    expect(cart().customer?.id).toBe("cust_1");
    expect(cart().tableId).toBe("t1");
    expect(cart().resumingOrderId).toBe("order-9");
    // A's cart is live again, B's is the one set aside.
    expect(Object.keys(cart().parkedCarts)).toEqual(["store-b"]);
  });

  it("does not keep an empty cart parked", () => {
    cart().bindStore("store-a");
    cart().bindStore("store-b");

    expect(cart().parkedCarts).toEqual({});
  });

  it("clearing the cart keeps it tied to its store and leaves the parked ones alone", () => {
    cart().bindStore("store-a");
    cart().addItem("m1", "Ramen", 50_000, 1);
    cart().bindStore("store-b");
    cart().addItem("b1", "Bagel", 20_000, 1);

    cart().clearCart();

    expect(cart().items).toEqual([]);
    expect(cart().boundStoreId).toBe("store-b");
    expect(Object.keys(cart().parkedCarts)).toEqual(["store-a"]);
  });
});

describe("usePosCart — Hold and Resume hold (Active Queue off)", () => {
  it("sets the sale aside for its store and empties the cart", () => {
    cart().addItem("m1", "Ramen", 50_000, 2);
    cart().setCustomer(alice);
    cart().setTable({ id: "t1", label: "T1" });

    expect(cart().holdSale("store-a")).toBe(true);

    expect(cart().items).toEqual([]);
    expect(cart().customer).toBeNull();
    expect(cart().tableId).toBeNull();
    const [held] = cart().heldSales["store-a"];
    expect(held.cart.items.map((i) => [i.menuItemId, i.quantity])).toEqual([["m1", 2]]);
    expect(held.cart.customer?.id).toBe("cust_1");
    expect(held.cart.tableId).toBe("t1");
    expect(Number.isNaN(Date.parse(held.heldAt))).toBe(false);
  });

  it("refuses an empty cart, and a store already holding the maximum", () => {
    expect(cart().holdSale("store-a")).toBe(false);
    expect(cart().heldSales["store-a"]).toBeUndefined();

    for (let i = 0; i < MAX_HELD_SALES; i++) {
      cart().addItem(`m${i}`, "Ramen", 10, 1);
      expect(cart().holdSale("store-a")).toBe(true);
    }
    cart().addItem("extra", "Gyoza", 10, 1);
    expect(cart().holdSale("store-a")).toBe(false);
    // The sale the cashier was ringing stays put.
    expect(cart().items).toHaveLength(1);
    expect(cart().heldSales["store-a"]).toHaveLength(MAX_HELD_SALES);
  });

  it("brings a held sale back and re-totals it against today's settings", () => {
    cart().addItem("m1", "Ramen", 100, 1);
    cart().holdSale("store-a");
    const id = cart().heldSales["store-a"][0].id;

    // Tax was switched on while the sale was held.
    cart().setFinanceSettings({
      ...noCharges,
      taxEnabled: true,
      taxRate: 0.1,
      taxInclusive: false,
    });

    expect(cart().resumeHeldSale("store-a", id)).toEqual({ swapped: false });
    expect(cart().items.map((i) => i.menuItemId)).toEqual(["m1"]);
    expect(cart().tax).toBe(10);
    expect(cart().total).toBe(110);
    expect(cart().heldSales["store-a"]).toEqual([]);
  });

  it("holds the sale in the cart in its place, so switching customers loses nothing", () => {
    cart().addItem("a", "Ramen", 10, 1);
    cart().holdSale("store-a");
    const first = cart().heldSales["store-a"][0].id;
    cart().addItem("b", "Gyoza", 20, 1);

    expect(cart().resumeHeldSale("store-a", first)).toEqual({ swapped: true });

    expect(cart().items.map((i) => i.menuItemId)).toEqual(["a"]);
    const held = cart().heldSales["store-a"];
    expect(held).toHaveLength(1);
    expect(held[0].cart.items.map((i) => i.menuItemId)).toEqual(["b"]);
  });

  it("keeps each store's holds apart, and Clear sale never touches them", () => {
    cart().addItem("a", "Ramen", 10, 1);
    cart().holdSale("store-a");
    const id = cart().heldSales["store-a"][0].id;

    expect(cart().resumeHeldSale("store-b", id)).toBeNull();

    cart().addItem("x", "Tea", 5, 1);
    cart().clearCart();
    expect(cart().heldSales["store-a"]).toHaveLength(1);
  });
});
