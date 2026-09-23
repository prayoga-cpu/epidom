import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

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

import { PosCartTotals } from "../pos-cart-totals";
import { usePosCart } from "../../hooks/use-pos-cart";
import type { ResolvedFinanceSettings } from "@/lib/finance/order-charges";
import type { CartCustomer } from "../../types/pos.types";

const cart = () => usePosCart.getState();

const finance = (over: Partial<ResolvedFinanceSettings> = {}): ResolvedFinanceSettings => ({
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
  ...over,
});

const alice: CartCustomer = {
  id: "c1",
  name: "Alice",
  phone: null,
  email: null,
  points: 500,
  lifetimeSpend: 0,
};

/** The label → value pairs the block rendered, in order. */
function rows() {
  const block = screen.getByTestId("pos-cart-totals");
  return Array.from(block.children).map((row) => {
    const [label, value] = Array.from(row.children).map((c) => c.textContent ?? "");
    return [label, value];
  });
}

beforeEach(() => {
  localStorage.clear();
  cart().clearCart();
  cart().setLoyaltyRules(null);
  cart().setFinanceSettings(finance());
});

describe("PosCartTotals — the plain bill", () => {
  it("shows just Sub-Total and Total when the store charges nothing extra", () => {
    cart().addItem("m1", "Ramen", 12.5, 2);
    render(<PosCartTotals />);
    expect(rows()).toEqual([
      ["Sub-Total", "EUR 25.00"],
      ["Total", "EUR 25.00"],
    ]);
  });

  it("emphasises the Total", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    render(<PosCartTotals />);
    const total = screen.getByText("Total").parentElement!;
    expect(total.className).toContain("font-bold");
    expect(total.className).toContain("text-lg");
  });
});

describe("PosCartTotals — service charge and tax read their rate from the finance settings", () => {
  it("labels 'Service Charge (15%)' and 'Tax (10%)' and adds them on top when tax is exclusive", () => {
    cart().setFinanceSettings(
      finance({
        serviceChargeEnabled: true,
        serviceChargeRate: 0.15,
        taxEnabled: true,
        taxRate: 0.1,
        taxInclusive: false,
      })
    );
    cart().addItem("m1", "Ramen", 100, 1);
    render(<PosCartTotals />);
    // 100 + 15 service = 115; tax 10% of 115 = 11.50; total 126.50
    expect(rows()).toEqual([
      ["Sub-Total", "EUR 100.00"],
      ["Service Charge (15%)", "EUR 15.00"],
      ["Tax (10%)", "EUR 11.50"],
      ["Total", "EUR 126.50"],
    ]);
  });

  it("marks the tax row 'included' when prices already contain it", () => {
    cart().setFinanceSettings(finance({ taxEnabled: true, taxRate: 0.1, taxInclusive: true }));
    cart().addItem("m1", "Ramen", 110, 1);
    render(<PosCartTotals />);
    // Included: the customer still pays 110; 100 net + 10 tax.
    expect(rows()).toEqual([
      ["Sub-Total", "EUR 100.00"],
      ["Tax (10%) included", "EUR 10.00"],
      ["Total", "EUR 110.00"],
    ]);
  });

  it("uses the store's own tax name when it set one (e.g. TVA)", () => {
    cart().setFinanceSettings(finance({ taxEnabled: true, taxRate: 0.2, taxInclusive: true }));
    cart().addItem("m1", "Ramen", 120, 1);
    render(<PosCartTotals taxLabel="TVA" />);
    expect(screen.getByText("TVA (20%) included")).toBeTruthy();
  });

  it("formats fractional rates without float noise", () => {
    cart().setFinanceSettings(finance({ taxEnabled: true, taxRate: 0.055, taxInclusive: false }));
    cart().addItem("m1", "Ramen", 100, 1);
    render(<PosCartTotals />);
    expect(screen.getByText("Tax (5.5%)")).toBeTruthy();
  });

  it("leaves out rows for charges the store has turned off", () => {
    cart().setFinanceSettings(finance({ taxEnabled: true, taxRate: 0.1, taxInclusive: false }));
    cart().addItem("m1", "Ramen", 100, 1);
    render(<PosCartTotals />);
    expect(screen.queryByText(/Service Charge/)).toBeNull();
    expect(screen.getByText("Tax (10%)")).toBeTruthy();
  });
});

describe("PosCartTotals — discount and points rows", () => {
  it("lists a manual discount with its reason, before the Sub-Total", () => {
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setDiscount(10, "Regular");
    render(<PosCartTotals />);
    expect(rows()).toEqual([
      ["Discount (Regular)", "-EUR 10.00"],
      ["Sub-Total", "EUR 90.00"],
      ["Total", "EUR 90.00"],
    ]);
  });

  it("names the preset and the coupon", () => {
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    const { unmount } = render(<PosCartTotals />);
    expect(screen.getByText(/Discount/).textContent).toContain("(Member)");
    unmount();

    cart().setDiscountSource({
      kind: "coupon",
      couponId: "c1",
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
      minSubtotal: null,
    });
    render(<PosCartTotals />);
    expect(screen.getByText(/Discount/).textContent).toContain("(Coupon SAVE10)");
  });

  it("shows redeemed points as their own row, after the discount", () => {
    cart().setLoyaltyRules({
      enabled: true,
      spendPerPoint: 10,
      pointValue: 0.5,
      minRedeemPoints: 0,
    });
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setCustomer(alice);
    cart().setDiscount(10, "Regular");
    cart().setRedeemPoints(20); // 20 pts × 0.50 = 10.00
    render(<PosCartTotals />);
    expect(rows()).toEqual([
      ["Discount (Regular)", "-EUR 10.00"],
      ["Points redeemed (20 pts)", "-EUR 10.00"],
      ["Sub-Total", "EUR 80.00"],
      ["Total", "EUR 80.00"],
    ]);
  });

  it("shows no discount rows on a bill without one", () => {
    cart().addItem("m1", "Ramen", 100, 1);
    render(<PosCartTotals />);
    expect(screen.queryByText(/Discount/)).toBeNull();
    expect(screen.queryByText(/Points redeemed/)).toBeNull();
  });
});

describe("PosCartTotals — non-IDR currency", () => {
  it("formats every amount with the store's own currency as the source currency", () => {
    cart().setFinanceSettings(
      finance({
        serviceChargeEnabled: true,
        serviceChargeRate: 0.1,
        taxEnabled: true,
        taxRate: 0.2,
        taxInclusive: false,
      })
    );
    cart().addItem("m1", "Ramen", 12.5, 2);
    cart().setDiscount(2.5, "Promo");
    render(<PosCartTotals />);

    const block = within(screen.getByTestId("pos-cart-totals"));
    // No amount was formatted as IDR — the 'EUR' prefix is the mock proving `currency`
    // was passed as the second argument, exactly as the pos-order-builder model needs.
    expect(block.queryByText(/IDR/)).toBeNull();
    const calls = currencyMock.value.formatPrice.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call[1]).toBe("EUR");
  });
});
