import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { stubBrowserApis } from "./cart-test-utils";
import { planAtLeast, type PlanTier } from "@/lib/plans/entitlements";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const gate = vi.hoisted(() => ({
  plan: "OPERATIONS" as string,
  requireFeature: vi.fn(),
}));
vi.mock("@/features/pos-mode/pos-mode-upgrade-banner", () => ({
  usePosModeUpgradeGate: () => ({
    currentPlan: gate.plan,
    requireFeature: gate.requireFeature,
  }),
}));

import { PosMoreSheet, type MoreAction } from "../pos-more-sheet";

const base = {
  online: true,
  hasItems: true,
  hasCustomer: true,
  loyaltyEnabled: true,
  activeQueueEnabled: true,
  canReprint: true,
  canClear: true,
};

function renderSheet(over: Partial<React.ComponentProps<typeof PosMoreSheet>> = {}) {
  const onAction = vi.fn<(a: MoreAction) => void>();
  const onOpenChange = vi.fn();
  render(<PosMoreSheet open onOpenChange={onOpenChange} onAction={onAction} {...base} {...over} />);
  return { onAction, onOpenChange };
}

const tile = (action: MoreAction) =>
  document.querySelector(`button[data-action="${action}"]`) as HTMLButtonElement;

const ALL: MoreAction[] = [
  "customItem",
  "splitBill",
  "mergeBill",
  "discount",
  "coupon",
  "redeemPoints",
  "reprintLast",
  "clear",
];

beforeEach(() => {
  stubBrowserApis();
  gate.plan = "OPERATIONS";
  // Mirrors the real provider: true when the plan covers `min`.
  gate.requireFeature.mockReset();
  gate.requireFeature.mockImplementation((min: PlanTier) =>
    planAtLeast(gate.plan as PlanTier, min)
  );
});

describe("PosMoreSheet — the grid", () => {
  it("renders every tile as a >=56px target", () => {
    renderSheet();
    for (const action of ALL) {
      expect(tile(action)).toBeTruthy();
      // 72px min height, comfortably over the 56px floor.
      expect(tile(action).className).toContain("min-h-[72px]");
    }
  });

  it("names the feature 'Custom Item' — never 'custom product'", () => {
    renderSheet();
    expect(tile("customItem").textContent).toContain("cashierCart.more.customItem");
  });

  it("renders nothing while closed", () => {
    const onAction = vi.fn();
    render(<PosMoreSheet open={false} onOpenChange={vi.fn()} onAction={onAction} {...base} />);
    expect(document.querySelector("button[data-action]")).toBeNull();
  });
});

describe("PosMoreSheet — choosing a tile", () => {
  it("closes the sheet first, then hands the action to the parent", () => {
    const { onAction, onOpenChange } = renderSheet();
    fireEvent.click(tile("customItem"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAction).toHaveBeenCalledWith("customItem");
  });

  it("passes the action through for every enabled tile", () => {
    const { onAction } = renderSheet();
    for (const action of ALL) fireEvent.click(tile(action));
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(ALL);
  });
});

describe("PosMoreSheet — plan gating", () => {
  it("Discount is gated by FEATURE_MIN_PLAN.discounts, Coupon and Redeem Points by loyaltyAndPromotions", () => {
    renderSheet();
    fireEvent.click(tile("discount"));
    fireEvent.click(tile("coupon"));
    fireEvent.click(tile("redeemPoints"));
    expect(gate.requireFeature.mock.calls.map((c) => c[0])).toEqual([
      "OPERATIONS",
      "OPERATIONS",
      "OPERATIONS",
    ]);
  });

  it("below the plan the tiles stay tappable with a lock, and a tap does NOT run the action", () => {
    gate.plan = "POS";
    const { onAction, onOpenChange } = renderSheet();

    for (const action of ["discount", "coupon", "redeemPoints"] as MoreAction[]) {
      expect(tile(action).disabled).toBe(false);
      expect(tile(action).getAttribute("data-locked")).toBe("true");
    }
    fireEvent.click(tile("coupon"));
    expect(gate.requireFeature).toHaveBeenCalledWith("OPERATIONS", expect.any(String));
    expect(onAction).not.toHaveBeenCalled();
    // Closed, so the upgrade banner isn't hidden under the sheet's overlay.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ungated tiles are never locked", () => {
    gate.plan = "POS";
    renderSheet();
    for (const action of [
      "customItem",
      "splitBill",
      "mergeBill",
      "reprintLast",
      "clear",
    ] as MoreAction[]) {
      expect(tile(action).getAttribute("data-locked")).toBeNull();
    }
  });

  it("at the plan nothing is locked", () => {
    renderSheet();
    for (const action of ALL) expect(tile(action).getAttribute("data-locked")).toBeNull();
  });

  it("a locked tile isn't also greyed out by a missing prerequisite (the banner must be reachable)", () => {
    gate.plan = "POS";
    renderSheet({ online: false, hasCustomer: false, loyaltyEnabled: false });
    expect(tile("redeemPoints").disabled).toBe(false);
    expect(tile("coupon").disabled).toBe(false);
  });
});

describe("PosMoreSheet — offline", () => {
  it("disables Coupon, Redeem Points and Merge Bill with a connection hint", () => {
    renderSheet({ online: false });
    for (const action of ["coupon", "redeemPoints", "mergeBill"] as MoreAction[]) {
      expect(tile(action).disabled).toBe(true);
      expect(tile(action).textContent).toContain("cashierCart.more.hintNeedsConnection");
    }
  });

  it("keeps the manual Discount, Custom Item, Split Bill, Reprint and Clear working", () => {
    renderSheet({ online: false });
    for (const action of [
      "discount",
      "customItem",
      "splitBill",
      "reprintLast",
      "clear",
    ] as MoreAction[]) {
      expect(tile(action).disabled).toBe(false);
    }
  });
});

describe("PosMoreSheet — prerequisites", () => {
  it("Redeem Points needs an attached customer", () => {
    renderSheet({ hasCustomer: false });
    expect(tile("redeemPoints").disabled).toBe(true);
    expect(tile("redeemPoints").textContent).toContain("cashierCart.more.hintNeedsCustomer");
  });

  it("Redeem Points needs loyalty turned on", () => {
    renderSheet({ loyaltyEnabled: false });
    expect(tile("redeemPoints").disabled).toBe(true);
    expect(tile("redeemPoints").textContent).toContain("cashierCart.more.hintLoyaltyOff");
  });

  it("Merge Bill needs the Active Queue (saved bills only exist there)", () => {
    renderSheet({ activeQueueEnabled: false });
    expect(tile("mergeBill").disabled).toBe(true);
    expect(tile("mergeBill").textContent).toContain("cashierCart.more.hintQueueOff");
  });

  it("bill actions need something on the bill", () => {
    renderSheet({ hasItems: false });
    for (const action of ["splitBill", "discount", "coupon", "redeemPoints"] as MoreAction[]) {
      expect(tile(action).disabled).toBe(true);
    }
    // Custom Item is how you START a bill, and Merge Bill works on an empty cart.
    expect(tile("customItem").disabled).toBe(false);
    expect(tile("mergeBill").disabled).toBe(false);
  });

  it("Reprint Last is disabled with a hint until a receipt exists", () => {
    renderSheet({ canReprint: false });
    expect(tile("reprintLast").disabled).toBe(true);
    expect(tile("reprintLast").textContent).toContain("cashierCart.actions.noLastReceipt");
  });

  it("Clear is disabled when there is nothing to clear", () => {
    renderSheet({ canClear: false });
    expect(tile("clear").disabled).toBe(true);
  });
});
