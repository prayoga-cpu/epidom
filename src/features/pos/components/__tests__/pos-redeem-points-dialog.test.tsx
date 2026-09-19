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

import { PosRedeemPointsDialog } from "../pos-redeem-points-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";
import type { CartCustomer } from "../../types/pos.types";

const cart = () => usePosCart.getState();

// 1 point = EUR 0.50; redeem at least 10 points.
const rules = { enabled: true, spendPerPoint: 10, pointValue: 0.5, minRedeemPoints: 10 };

const customer = (points: number): CartCustomer => ({
  id: "c1",
  name: "Alice",
  phone: null,
  email: null,
  points,
  lifetimeSpend: 0,
});

function renderDialog() {
  const onOpenChange = vi.fn();
  render(<PosRedeemPointsDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

const input = () =>
  screen.getByLabelText("cashierCart.pointsDialog.pointsToRedeem") as HTMLInputElement;
const apply = () =>
  screen.getByRole("button", { name: "common.actions.apply" }) as HTMLButtonElement;

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  cart().setLoyaltyRules(rules);
  cart().addItem("m1", "Ramen", 50, 2); // items total 100 → at most 200 points payable
  cart().setCustomer(customer(300));
});

describe("PosRedeemPointsDialog", () => {
  it("shows the balance and the value of one point in the store's currency", () => {
    renderDialog();
    expect(screen.getByText("300 pts")).toBeTruthy();
    expect(screen.getByText("1 point = EUR 0.50")).toBeTruthy();
    for (const call of currencyMock.value.formatPrice.mock.calls) expect(call[1]).toBe("EUR");
  });

  it("bounds the redemption by what is payable, not just the balance (max 200, not 300)", () => {
    renderDialog();
    expect(screen.getByText("Up to 200 points on this bill")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.pointsDialog.max" }));
    expect(input().value).toBe("200");
  });

  it("bounds by the balance when that is lower", () => {
    cart().setCustomer(customer(80));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.pointsDialog.max" }));
    expect(input().value).toBe("80");
  });

  it("subtracts a preset/coupon/manual discount from what is payable first", () => {
    cart().setDiscount(60, "Regular"); // payable 40 → 80 points
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.pointsDialog.max" }));
    expect(input().value).toBe("80");
  });

  it("the 25% and 50% quick buttons take a share of the maximum", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "25%" }));
    expect(input().value).toBe("50");
    fireEvent.click(screen.getByRole("button", { name: "50%" }));
    expect(input().value).toBe("100");
  });

  it("a quick share never falls below the store's minimum redemption", () => {
    cart().setCustomer(customer(20)); // max 20; 25% would be 5 < min 10
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "25%" }));
    expect(input().value).toBe("10");
  });

  it("gives every quick button a >=44px target", () => {
    renderDialog();
    for (const name of ["25%", "50%", "cashierCart.pointsDialog.max"]) {
      expect(screen.getByRole("button", { name }).className).toContain("h-11");
    }
  });

  it("previews what the typed points are worth", () => {
    renderDialog();
    fireEvent.change(input(), { target: { value: "50" } });
    expect(screen.getByText("-EUR 25.00")).toBeTruthy();
  });

  it("applies valid points to the cart", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(input(), { target: { value: "50" } });
    expect(apply().disabled).toBe(false);
    fireEvent.click(apply());
    expect(cart().redeemPoints).toBe(50);
    expect(cart().pointsDiscountAmount).toBe(25);
    expect(cart().total).toBe(75);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects fewer points than the store's minimum redemption", () => {
    renderDialog();
    fireEvent.change(input(), { target: { value: "5" } });
    expect(screen.getByRole("alert").textContent).toBe("Redeem at least 10 points.");
    expect(apply().disabled).toBe(true);
  });

  it("rejects more points than the bill can take", () => {
    renderDialog();
    fireEvent.change(input(), { target: { value: "250" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "cashierCart.pointsDialog.reason.EXCEEDS_PAYABLE"
    );
    expect(apply().disabled).toBe(true);
  });

  it("rejects more than the customer holds", () => {
    cart().setCustomer(customer(50));
    renderDialog();
    fireEvent.change(input(), { target: { value: "60" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "cashierCart.pointsDialog.reason.EXCEEDS_BALANCE"
    );
    expect(apply().disabled).toBe(true);
  });

  it("only accepts digits", () => {
    renderDialog();
    fireEvent.change(input(), { target: { value: "1a2.5" } });
    expect(input().value).toBe("125");
  });

  it("says so when there is nothing to redeem (below the minimum)", () => {
    cart().setCustomer(customer(4));
    renderDialog();
    expect(screen.getByText("cashierCart.pointsDialog.nothingToRedeem")).toBeTruthy();
    expect(screen.queryByLabelText("cashierCart.pointsDialog.pointsToRedeem")).toBeNull();
    expect(apply().disabled).toBe(true);
  });

  it("re-seeds from, and can remove, an existing redemption", () => {
    cart().setRedeemPoints(40);
    const { onOpenChange } = renderDialog();
    expect(input().value).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: "common.actions.remove" }));
    expect(cart().redeemPoints).toBe(0);
    expect(cart().discountAmount).toBe(0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("has no Remove until points are redeemed", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "common.actions.remove" })).toBeNull();
  });
});
