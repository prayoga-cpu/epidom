import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/services", () => ({ storefrontService: { getStorefrontBySlug: vi.fn() } }));

import {
  cleanStorefrontSlug,
  formatStorefrontPrice,
  menuPriceRange,
  pickMenuHighlights,
  resolveStorefrontLocale,
} from "../public-storefront";

const NBSPs = /[  ]/g;
const plain = (s: string | undefined) => s?.replace(NBSPs, " ");

describe("resolveStorefrontLocale", () => {
  it("lets the store's currency name its market first", () => {
    expect(resolveStorefrontLocale({ currency: "IDR", businessLocale: "en" })).toBe("id");
    // A Paris café left on the column's "id" default, pricing in euros.
    expect(resolveStorefrontLocale({ currency: "EUR", businessLocale: "id" })).toBe("fr");
  });

  it("then trusts an explicit French or English business language", () => {
    expect(resolveStorefrontLocale({ currency: "USD", businessLocale: "fr" })).toBe("fr");
    expect(resolveStorefrontLocale({ currency: "DZD", businessLocale: "en" })).toBe("en");
  });

  it("doesn't trust the 'id' default outside a rupiah store, and falls back to English", () => {
    expect(resolveStorefrontLocale({ currency: "DZD", businessLocale: "id" })).toBe("en");
    expect(resolveStorefrontLocale({ currency: null, businessLocale: null })).toBe("en");
  });
});

describe("cleanStorefrontSlug", () => {
  it("strips the @, encoded or not", () => {
    expect(cleanStorefrontSlug("%40ellens-bakery")).toBe("ellens-bakery");
    expect(cleanStorefrontSlug("@ellens-bakery")).toBe("ellens-bakery");
  });
});

describe("formatStorefrontPrice", () => {
  it("writes rupiah the Indonesian way whatever the store's language", () => {
    expect(plain(formatStorefrontPrice(25000, "IDR", "en"))).toBe("Rp 25.000");
    expect(plain(formatStorefrontPrice(25000, "IDR", "fr"))).toBe("Rp 25.000");
  });

  it("writes euros the French way in a French store", () => {
    expect(plain(formatStorefrontPrice(4.5, "EUR", "fr"))).toBe("4,50 €");
  });
});

const item = (name: string, price: number, isAvailable = true, isFeatured = false) => ({
  name,
  price,
  isAvailable,
  isFeatured,
});

describe("pickMenuHighlights", () => {
  const menu = [
    { items: [item("Nasi Goreng", 25000), item("Sold out", 9000, false), item("Es Teh", 5000)] },
    { items: [item("Signature Cake", 45000, true, true), item("Pisang Goreng", 3000)] },
  ];

  it("puts featured dishes first, then the menu's order, available ones only", () => {
    expect(pickMenuHighlights(menu, { currency: "IDR", locale: "id" }).map((h) => h.name)).toEqual([
      "Signature Cake",
      "Nasi Goreng",
      "Es Teh",
      "Pisang Goreng",
    ]);
  });

  it("caps the list and formats prices as strings", () => {
    const top = pickMenuHighlights(menu, { currency: "IDR", locale: "id", limit: 2 });
    expect(top).toHaveLength(2);
    expect(plain(top[0].price)).toBe("Rp 45.000");
  });
});

describe("menuPriceRange", () => {
  it("spans the cheapest to the dearest available dish", () => {
    const menu = [{ items: [item("A", 3000), item("B", 25000), item("Off", 99000, false)] }];
    expect(plain(menuPriceRange(menu, { currency: "IDR", locale: "id" }))).toBe(
      "Rp 3.000 – Rp 25.000"
    );
  });

  it("is a single price when every dish costs the same, and absent without prices", () => {
    expect(
      plain(menuPriceRange([{ items: [item("A", 5000)] }], { currency: "IDR", locale: "id" }))
    ).toBe("Rp 5.000");
    expect(menuPriceRange([{ items: [] }], { currency: "IDR", locale: "id" })).toBeUndefined();
  });
});
