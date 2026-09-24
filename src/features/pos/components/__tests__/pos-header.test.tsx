import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    formatPrice: (v: number, currency: string) => `${currency} ${Number(v).toFixed(2)}`,
  }),
}));

import { PosHeader } from "../pos-header";
import { usePosCart } from "../../hooks/use-pos-cart";

beforeEach(() => {
  localStorage.clear();
  usePosCart.getState().clearCart();
});

describe("PosHeader — the phone's floating cart button", () => {
  it("floats at the bottom right, above the tab bar, and only below md", () => {
    render(<PosHeader onCartClick={() => {}} />);
    const button = screen.getByRole("button", { name: /pos\.cart\.open/ });
    for (const cls of ["absolute", "right-4", "bottom-4", "rounded-full", "md:hidden"]) {
      expect(button.className).toContain(cls);
    }
    // No row of its own any more: the button is the whole component.
    expect(button.parentElement?.tagName).toBe("DIV");
    expect(button.parentElement?.className ?? "").toBe("");
  });

  it("is a 56px circle when empty — well over the 40px touch floor", () => {
    render(<PosHeader onCartClick={() => {}} />);
    const button = screen.getByRole("button", { name: /pos\.cart\.open/ });
    expect(button.className).toContain("h-14");
    expect(button.className).toContain("min-w-14");
    expect(button).toHaveTextContent(/^pos\.cart\.open$/);
  });

  it("shows the item count and total, and opens the cart", () => {
    act(() => usePosCart.getState().addItem("m1", "Latte", 4, 2, []));
    const onCartClick = vi.fn();
    render(<PosHeader onCartClick={onCartClick} />);
    const button = screen.getByRole("button", { name: /pos\.cart\.open/ });
    expect(button).toHaveTextContent("2");
    expect(button).toHaveTextContent("EUR 8.00");
    fireEvent.click(button);
    expect(onCartClick).toHaveBeenCalledTimes(1);
  });
});
