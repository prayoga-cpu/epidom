import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCustomerDisplayPublisher } from "../use-customer-display";
import { useCustomerDisplaySettings } from "../use-customer-display-settings";
import { usePosCart } from "../use-pos-cart";
import {
  customerDisplaySnapshotKey,
  parseCustomerDisplaySnapshot,
  type CustomerDisplaySnapshot,
} from "../../lib/customer-display";
import type { ResolvedFinanceSettings } from "@/lib/finance/order-charges";

const cart = () => usePosCart.getState();

const noCharges: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

/** What the publisher last mirrored to the display window. */
function published(): CustomerDisplaySnapshot {
  const snapshot = parseCustomerDisplaySnapshot(
    window.localStorage.getItem(customerDisplaySnapshotKey("s1"))
  );
  if (!snapshot) throw new Error("nothing published");
  return snapshot;
}

beforeEach(() => {
  localStorage.clear();
  cart().clearCart();
  cart().setFinanceSettings(noCharges);
  cart().setLoyaltyRules({ enabled: true, spendPerPoint: 10, pointValue: 0.5, minRedeemPoints: 0 });
  useCustomerDisplaySettings.setState({ enabled: true });
});

describe("useCustomerDisplayPublisher — the new cart features", () => {
  it("mirrors a Custom Item (menuItemId null) to the display", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addItem("m1", "Ramen", 10, 1);
      cart().addCustomItem({ name: "Delivery fee", unitPrice: 4, quantity: 2, department: null });
    });

    const snapshot = published();
    expect(snapshot.phase).toBe("building");
    expect(snapshot.lines.map((l) => [l.name, l.quantity, l.lineTotal])).toEqual([
      ["Ramen", 1, 10],
      ["Delivery fee", 2, 8],
    ]);
    expect(snapshot.total).toBe(18);
    // A custom line just added is the one the hero card features.
    expect(snapshot.highlightLineId).toBe(snapshot.lines[1].id);
    expect(snapshot.highlightIsNew).toBe(true);
  });

  it("shows a manual discount and its reason", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addItem("m1", "Ramen", 100, 1);
      cart().setDiscount(20, "Regular");
    });
    expect(published()).toMatchObject({
      discountAmount: 20,
      discountReason: "Regular",
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
      total: 80,
    });
  });

  it("shows a preset and a coupon by name", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addItem("m1", "Ramen", 100, 1);
      cart().setDiscountSource({
        kind: "preset",
        presetId: "p1",
        name: "Member",
        type: "PERCENT",
        value: 10,
      });
    });
    expect(published()).toMatchObject({ discountAmount: 10, discountReason: "Member", total: 90 });

    act(() => {
      cart().setDiscountSource({
        kind: "coupon",
        couponId: "c1",
        code: "SAVE10",
        type: "PERCENT",
        value: 10,
        minSubtotal: null,
      });
    });
    expect(published()).toMatchObject({ discountAmount: 10, discountReason: "SAVE10" });
  });

  it("shows redeemed points: the discount total includes them, and they are broken out too", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addItem("m1", "Ramen", 100, 1);
      cart().setCustomer({
        id: "c1",
        name: "Alice",
        phone: null,
        email: null,
        points: 500,
        lifetimeSpend: 0,
      });
      cart().setDiscount(10, "Member");
      cart().setRedeemPoints(20); // 20 × 0.5 = 10
    });
    expect(published()).toMatchObject({
      discountAmount: 20,
      discountReason: "Member + 20 pts",
      pointsRedeemed: 20,
      pointsDiscountAmount: 10,
      total: 80,
    });
  });

  it("goes idle again when the sale is cleared, discount and points included", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addItem("m1", "Ramen", 100, 1);
      cart().setDiscount(10, "Member");
    });
    act(() => cart().clearCart());
    expect(published()).toMatchObject({
      phase: "idle",
      lines: [],
      discountAmount: 0,
      discountReason: null,
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
      total: 0,
    });
  });

  it("keeps the shape every display window consumes", () => {
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addCustomItem({ name: "Fee", unitPrice: 1, quantity: 1 });
    });
    const snapshot = published();
    for (const key of [
      "phase",
      "lines",
      "highlightLineId",
      "highlightIsNew",
      "subtotal",
      "tax",
      "serviceCharge",
      "discountAmount",
      "discountReason",
      "total",
      "paidOrderNumber",
      "updatedAt",
    ]) {
      expect(snapshot).toHaveProperty(key);
    }
  });

  it("publishes nothing while the customer display is off", () => {
    useCustomerDisplaySettings.setState({ enabled: false });
    renderHook(() => useCustomerDisplayPublisher("s1"));
    act(() => {
      cart().addCustomItem({ name: "Fee", unitPrice: 1, quantity: 1 });
    });
    expect(published().phase).toBe("off");
  });
});
