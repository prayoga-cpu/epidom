import { describe, it, expect } from "vitest";
import {
  DEFAULT_STOREFRONT_DESCRIPTION,
  schemaTypeForBusiness,
  storefrontDescription,
  storefrontItemDescription,
  storefrontMenuDescription,
  storefrontMenuTitle,
  storefrontTitle,
} from "../storefront-metadata";

const shop = { displayName: "Ellens Bakery", city: "Denpasar", acceptsOrders: true };

describe("storefront titles", () => {
  it("speak the store's language and name the city", () => {
    expect(storefrontTitle(shop, "id")).toBe("Ellens Bakery — Menu & Pesan Online, Denpasar");
    expect(storefrontTitle(shop, "fr")).toBe("Ellens Bakery — Menu et commande en ligne, Denpasar");
    expect(storefrontTitle(shop, "en")).toBe("Ellens Bakery — Menu & Online Ordering, Denpasar");
  });

  it("never promise online ordering to a shop that doesn't take orders", () => {
    for (const locale of ["fr", "id", "en"] as const) {
      const title = storefrontTitle({ ...shop, acceptsOrders: false }, locale);
      expect(title).not.toMatch(/commande|pesan|ordering/i);
      expect(storefrontDescription({ ...shop, acceptsOrders: false }, locale)).not.toMatch(
        /commandez|pesan online|order online/i
      );
    }
  });

  it("leave the city out when the store has none", () => {
    expect(storefrontTitle({ ...shop, city: null }, "en")).toBe(
      "Ellens Bakery — Menu & Online Ordering"
    );
    expect(storefrontMenuTitle({ ...shop, city: "  " }, "fr")).toBe("Menu — Ellens Bakery");
  });
});

describe("storefrontDescription", () => {
  it("uses the owner's own description when they wrote one", () => {
    expect(storefrontDescription({ ...shop, description: "Roti hangat tiap pagi." }, "id")).toBe(
      "Roti hangat tiap pagi."
    );
  });

  it("ignores the untouched default and writes a line in the store's language", () => {
    const text = storefrontDescription(
      { ...shop, description: DEFAULT_STOREFRONT_DESCRIPTION, tagline: null },
      "id"
    );
    expect(text).not.toContain(DEFAULT_STOREFRONT_DESCRIPTION);
    expect(text).toBe("Lihat menu Ellens Bakery di Denpasar, jam buka, dan pesan online.");
  });

  it("falls back to the tagline before the generated line", () => {
    expect(
      storefrontDescription(
        { ...shop, description: DEFAULT_STOREFRONT_DESCRIPTION, tagline: "Since 1999" },
        "en"
      )
    ).toBe("Since 1999");
  });
});

describe("menu and item snippets", () => {
  it("name real dishes, at most four, with French typography", () => {
    const text = storefrontMenuDescription(
      shop,
      ["Croissant", "Pain au chocolat", "Baguette", "Tarte", "Éclair"],
      "fr"
    );
    expect(text).toBe(
      "Le menu de Ellens Bakery : Croissant, Pain au chocolat, Baguette, Tarte… Commandez en ligne."
    );
  });

  it("ends a full list on a period", () => {
    expect(storefrontMenuDescription(shop, ["Nasi Goreng", "Es Teh"], "id")).toBe(
      "Menu Ellens Bakery: Nasi Goreng, Es Teh. Pesan langsung secara online."
    );
  });

  it("still reads well without dishes", () => {
    expect(storefrontMenuDescription({ ...shop, acceptsOrders: false }, [], "en")).toBe(
      "Ellens Bakery's menu."
    );
  });

  it("localizes the item fallback", () => {
    expect(storefrontItemDescription("Nasi Goreng", "Warung A", "id")).toBe(
      "Pesan Nasi Goreng dari Warung A."
    );
  });
});

describe("schemaTypeForBusiness", () => {
  it.each([
    ["cafe", "CafeOrCoffeeShop"],
    ["bakery", "Bakery"],
    ["restaurant", "Restaurant"],
    ["bar", "BarOrPub"],
    ["fastFood", "FastFoodRestaurant"],
    ["homeKitchen", "FoodEstablishment"],
    [null, "FoodEstablishment"],
  ])("%s → %s", (type, expected) => {
    expect(schemaTypeForBusiness(type)).toBe(expected);
  });
});
