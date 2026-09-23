import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { PosCashPresets } from "../pos-cash-presets";
import { getCashPresets } from "../../lib/cash-presets";

// A literal-currency formatter like the real two-arg formatPrice(v, currency).
const fmt = (currency: string) => (v: number) => `${currency} ${v.toFixed(2)}`;

describe("PosCashPresets", () => {
  it("renders exact first, then the round-ups, for a non-IDR currency (EUR)", () => {
    render(
      <PosCashPresets
        total={12.5}
        currency="EUR"
        value={undefined}
        onSelect={() => {}}
        formatPrice={fmt("EUR")}
      />
    );
    const expected = getCashPresets(12.5, "EUR");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(expected.length);
    expected.forEach((amount, i) =>
      expect(buttons[i]).toHaveTextContent(`EUR ${amount.toFixed(2)}`)
    );

    // The first button pays exactly the total and is labelled as such.
    expect(buttons[0]).toHaveTextContent("cashierCheckout.cash.exact");
    expect(buttons[0]).toHaveTextContent("EUR 12.50");
    expect(buttons[1]).not.toHaveTextContent("cashierCheckout.cash.exact");
    // 12.50 → 15, 20, 50 are the notes a customer hands over.
    expect(expected.slice(1, 4)).toEqual([15, 20, 50]);
  });

  it("uses whole-number steps for IDR", () => {
    render(
      <PosCashPresets
        total={36000}
        currency="IDR"
        value={undefined}
        onSelect={() => {}}
        formatPrice={fmt("IDR")}
      />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("IDR 36000.00");
    expect(buttons[1]).toHaveTextContent("IDR 40000.00");
  });

  it("falls back to magnitude-based steps for a currency with no table (GBP)", () => {
    render(
      <PosCashPresets
        total={7.2}
        currency="GBP"
        value={undefined}
        onSelect={() => {}}
        formatPrice={fmt("GBP")}
      />
    );
    const expected = getCashPresets(7.2, "GBP");
    expect(expected[0]).toBe(7.2);
    expect(expected.length).toBeGreaterThan(1);
    expect(screen.getAllByRole("button")).toHaveLength(expected.length);
  });

  it("selecting a button reports its amount", () => {
    const onSelect = vi.fn();
    render(
      <PosCashPresets
        total={12.5}
        currency="EUR"
        value={undefined}
        onSelect={onSelect}
        formatPrice={fmt("EUR")}
      />
    );
    fireEvent.click(screen.getAllByRole("button")[2]);
    expect(onSelect).toHaveBeenCalledWith(20);
  });

  it("highlights the button matching the amount already typed", () => {
    render(
      <PosCashPresets
        total={12.5}
        currency="EUR"
        value={20}
        onSelect={() => {}}
        formatPrice={fmt("EUR")}
      />
    );
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("EUR 20.00");
  });

  it("every button is at least 44px tall (min-h-11)", () => {
    render(
      <PosCashPresets
        total={12.5}
        currency="EUR"
        value={undefined}
        onSelect={() => {}}
        formatPrice={fmt("EUR")}
      />
    );
    for (const b of screen.getAllByRole("button")) expect(b.className).toContain("min-h-11");
  });

  it("renders nothing for a zero total", () => {
    const { container } = render(
      <PosCashPresets
        total={0}
        currency="EUR"
        value={undefined}
        onSelect={() => {}}
        formatPrice={fmt("EUR")}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
