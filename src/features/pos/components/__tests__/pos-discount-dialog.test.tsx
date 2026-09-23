import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const currencyMock = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  currencyMock.value = makeCurrencyMock("EUR");
  return { useCurrency: () => currencyMock.value };
});

const env = vi.hoisted(() => ({ plan: "OPERATIONS", online: true, presets: [] as unknown[] }));
vi.mock("@/features/pos-mode/pos-mode-upgrade-banner", () => ({
  usePosModeUpgradeGate: () => ({ currentPlan: env.plan, requireFeature: vi.fn() }),
}));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => env.online }));

const presetsHook = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/use-discount-presets", () => ({
  useDiscountPresets: presetsHook,
}));

import { PosDiscountDialog } from "../pos-discount-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

const presets = [
  { id: "p1", name: "Member", type: "PERCENT", value: 10, isActive: true, sortOrder: 0 },
  { id: "p2", name: "Five off", type: "FIXED", value: 5, isActive: true, sortOrder: 1 },
  { id: "p3", name: "Retired", type: "PERCENT", value: 50, isActive: false, sortOrder: 2 },
];

function renderDialog(onOpenChange = vi.fn()) {
  render(<PosDiscountDialog open onOpenChange={onOpenChange} storeId="s1" />);
  return { onOpenChange };
}

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  env.plan = "OPERATIONS";
  env.online = true;
  presetsHook.mockReset();
  presetsHook.mockReturnValue({ data: presets });
  cart().addItem("m1", "Ramen", 50, 2); // items total 100
});

describe("PosDiscountDialog — presets", () => {
  it("shows a chip per ACTIVE preset: '10%' for a percent, the formatted amount for a fixed one", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /10%/ })).toBeTruthy();
    // EUR 5.00 — the store's own currency, never converted from IDR.
    expect(screen.getByRole("button", { name: /EUR 5\.00/ })).toBeTruthy();
    expect(screen.queryByText("Retired")).toBeNull();
    for (const call of currencyMock.value.formatPrice.mock.calls) expect(call[1]).toBe("EUR");
  });

  it("gives each chip a >=44px target", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /10%/ }).className).toContain("min-h-14");
  });

  it("tapping a preset applies it as the bill's discount and closes", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /10%/ }));
    expect(cart().discountSource).toEqual({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    expect(cart().discountAmount).toBe(10);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("marks the applied preset as pressed", () => {
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p2",
      name: "Five off",
      type: "FIXED",
      value: 5,
    });
    renderDialog();
    expect(screen.getByRole("button", { name: /EUR 5\.00/ }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: /10%/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("only asks for presets at OPERATIONS and while online (no 403 noise)", () => {
    renderDialog();
    expect(presetsHook).toHaveBeenLastCalledWith("s1", true);
  });

  it("below the plan the presets section is left out and nothing is fetched", () => {
    env.plan = "POS";
    presetsHook.mockReturnValue({ data: undefined });
    renderDialog();
    expect(presetsHook).toHaveBeenLastCalledWith("s1", false);
    expect(screen.queryByText("cashierCart.discountDialog.presets")).toBeNull();
    // The manual form (today's behaviour) is still there.
    expect(screen.getByLabelText("pos.cart.discountAmount")).toBeTruthy();
  });

  it("offline the presets aren't fetched either — the manual form carries on", () => {
    env.online = false;
    presetsHook.mockReturnValue({ data: undefined });
    renderDialog();
    expect(presetsHook).toHaveBeenLastCalledWith("s1", false);
    expect(screen.getByLabelText("pos.cart.discountAmount")).toBeTruthy();
  });

  it("degrades silently when there are no presets", () => {
    presetsHook.mockReturnValue({ data: [] });
    renderDialog();
    expect(screen.queryByText("cashierCart.discountDialog.presets")).toBeNull();
  });
});

describe("PosDiscountDialog — manual (today's behaviour)", () => {
  it("applies an amount with a reason", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("pos.cart.discountAmount"), {
      target: { value: "12.5" },
    });
    fireEvent.change(screen.getByLabelText("pos.cart.discountReason"), {
      target: { value: "Regular" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.actions.apply" }));

    expect(cart().discountSource).toEqual({ kind: "manual", amount: 12.5, reason: "Regular" });
    expect(cart().discountAmount).toBe(12.5);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("won't apply an empty or zero amount", () => {
    renderDialog();
    const apply = screen.getByRole("button", { name: "common.actions.apply" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("pos.cart.discountAmount"), { target: { value: "0" } });
    expect(apply.disabled).toBe(true);
  });

  it("takes the store's currency symbol on the amount input", () => {
    renderDialog();
    // The mock's currency is EUR; getCurrencySymbol('EUR') is the euro sign.
    expect(screen.getByText("€")).toBeTruthy();
  });

  it("re-seeds the form from the live manual discount", () => {
    cart().setDiscount(7, "Old");
    renderDialog();
    expect((screen.getByLabelText("pos.cart.discountAmount") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("pos.cart.discountReason") as HTMLInputElement).value).toBe(
      "Old"
    );
  });

  it("starts the manual form blank when the live discount is a preset", () => {
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    renderDialog();
    expect((screen.getByLabelText("pos.cart.discountAmount") as HTMLInputElement).value).toBe("");
  });

  it("warns that an amount over the bill is capped", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("pos.cart.discountAmount"), {
      target: { value: "500" },
    });
    expect(screen.getByText("cashierCart.discountDialog.cappedHint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.apply" }));
    expect(cart().discountAmount).toBe(100);
  });

  it("a manual amount replaces a preset (only one primary discount at a time)", () => {
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    renderDialog();
    fireEvent.change(screen.getByLabelText("pos.cart.discountAmount"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "common.actions.apply" }));
    expect(cart().discountSource?.kind).toBe("manual");
    expect(cart().discountAmount).toBe(20);
  });
});

describe("PosDiscountDialog — remove", () => {
  it("has no Remove until a discount is applied", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "common.actions.remove" })).toBeNull();
  });

  it("removes whichever discount is applied", () => {
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.remove" }));
    expect(cart().discountSource).toBeNull();
    expect(cart().discountAmount).toBe(0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
