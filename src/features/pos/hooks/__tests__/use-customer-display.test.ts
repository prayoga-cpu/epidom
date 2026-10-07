import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCustomerDisplayPublisher, useCustomerDisplaySnapshot } from "../use-customer-display";
import { useCustomerDisplaySettings } from "../use-customer-display-settings";
import { usePosCart } from "../use-pos-cart";
import {
  CUSTOMER_DISPLAY_RETRY_MS,
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  customerDisplayChannelName,
  customerDisplaySnapshotKey,
  parseCustomerDisplaySnapshot,
  type CustomerDisplayMessage,
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

/**
 * The till and the customer screen are two windows of one browser talking over
 * BroadcastChannel + a localStorage mirror. These cover the ways the screen got
 * stuck on "Customer display is off" while the setting was ON.
 */
describe("customer display ↔ till sync — never stuck on standby", () => {
  /** Lets BroadcastChannel deliveries (async, real) land. */
  const settle = (ms = 40) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

  const mirror = (storeId: string) =>
    parseCustomerDisplaySnapshot(window.localStorage.getItem(customerDisplaySnapshotKey(storeId)));

  const leaveInMirror = (storeId: string, phase: CustomerDisplaySnapshot["phase"]) => {
    const snapshot: CustomerDisplaySnapshot = {
      ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
      phase,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(customerDisplaySnapshotKey(storeId), JSON.stringify(snapshot));
    return snapshot;
  };

  /** A till that only answers requests (it never publishes on its own), so a
   * test can tell the display's asking apart from the till's own publishing. */
  const answeringTill = (storeId: string) => {
    const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
    const till = { requests: 0, channel };
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type !== "request") return;
      till.requests += 1;
      channel.postMessage({
        type: "state",
        snapshot: { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: Date.now() },
      } satisfies CustomerDisplayMessage);
    };
    return till;
  };

  const opened: BroadcastChannel[] = [];
  afterEach(() => {
    opened.splice(0).forEach((channel) => channel.close());
    vi.useRealTimers();
  });

  it("says `closed`, not `off`, when the till window goes away with the display still on", () => {
    const pos = renderHook(() => useCustomerDisplayPublisher("closing"));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(mirror("closing")?.phase).toBe("closed");
    pos.unmount();
  });

  it("a live till beats the goodbye another till tab of the same store left behind", async () => {
    // Tab A keeps ringing up, setting ON.
    const pos = renderHook(() => useCustomerDisplayPublisher("two-tabs"));
    await settle();

    // Tab B of the same store closes (or reloads) AFTER A last published.
    const tabB = new BroadcastChannel(customerDisplayChannelName("two-tabs"));
    const farewell = leaveInMirror("two-tabs", "closed");
    tabB.postMessage({ type: "state", snapshot: farewell });
    tabB.close();
    await settle(10);

    // The customer screen is opened (or reloaded) now. A answers its request
    // with a fresh timestamp, so the stale goodbye no longer wins.
    const display = renderHook(() => useCustomerDisplaySnapshot("two-tabs"));
    await settle(80);
    expect(display.result.current.phase).toBe("idle");

    display.unmount();
    pos.unmount();
  });

  it("keeps asking while on standby, and goes live as soon as a till answers", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    leaveInMirror("retry", "closed");

    // The mount-time request goes unanswered: no till is up yet (the cashier
    // was on Orders, or at the PIN picker after a reload).
    const display = renderHook(() => useCustomerDisplaySnapshot("retry"));
    await settle();
    expect(display.result.current.phase).toBe("closed");

    const till = answeringTill("retry");
    opened.push(till.channel);
    await settle();
    expect(display.result.current.phase).toBe("closed");

    act(() => {
      vi.advanceTimersByTime(CUSTOMER_DISPLAY_RETRY_MS);
    });
    await settle();
    expect(display.result.current.phase).toBe("idle");

    // Live now: no more asking, so two tills can never take turns on screen.
    const asked = till.requests;
    act(() => {
      vi.advanceTimersByTime(CUSTOMER_DISPLAY_RETRY_MS * 3);
    });
    await settle();
    expect(till.requests).toBe(asked);

    display.unmount();
  });

  it("asks again at once when a till asks the customer for details over a stale standby", async () => {
    leaveInMirror("ask", "off");
    const display = renderHook(() => useCustomerDisplaySnapshot("ask"));
    await settle();
    expect(display.result.current.phase).toBe("off");

    const till = answeringTill("ask");
    opened.push(till.channel);
    till.channel.postMessage({ type: "ask-details" } satisfies CustomerDisplayMessage);
    await settle(80);
    expect(display.result.current.phase).toBe("idle");

    display.unmount();
  });

  it("re-announces itself after a back/forward-cache restore took its goodbye", () => {
    const pos = renderHook(() => useCustomerDisplayPublisher("bfcache"));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(mirror("bfcache")?.phase).toBe("closed");

    act(() => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });
    expect(mirror("bfcache")?.phase).toBe("idle");
    pos.unmount();
  });

  it("a plain page load (not a restore) does not re-announce", () => {
    const pos = renderHook(() => useCustomerDisplayPublisher("fresh-load"));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    });
    expect(mirror("fresh-load")?.phase).toBe("closed");
    pos.unmount();
  });
});
