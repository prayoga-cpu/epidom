import { describe, it, expect } from "vitest";
import {
  MIN_INDEXABLE_MENU_ITEMS,
  countAvailableMenuItems,
  isStorefrontIndexable,
  looksLikeTestStorefront,
  storefrontRobots,
} from "../indexing";

describe("looksLikeTestStorefront", () => {
  it.each([
    ["testing", "testing"],
    ["testings", "testings"],
    ["test-2", "My shop"],
    ["demo-cmsbjfr6", "Demo"],
    ["cafe-x", "Test Café"],
    ["dummy", "Dummy"],
    ["contoh-toko", "Contoh"],
  ])("catches %s / %s", (slug, name) => {
    expect(looksLikeTestStorefront(slug, name)).toBe(true);
  });

  it.each([
    ["testarossa", "Testarossa Coffee"],
    ["demoiselle", "La Demoiselle"],
    ["ellens-bakery", "Ellens Bakery"],
    ["lecomptoir-paris", "Le Comptoir"],
    ["latest-cafe", "Latest Café"],
  ])("leaves a real name alone: %s / %s", (slug, name) => {
    expect(looksLikeTestStorefront(slug, name)).toBe(false);
  });
});

describe("isStorefrontIndexable", () => {
  const real = { slug: "ellens-bakery", displayName: "Ellens Bakery" };

  it("needs a real menu", () => {
    expect(
      isStorefrontIndexable({ ...real, availableMenuItemCount: MIN_INDEXABLE_MENU_ITEMS })
    ).toBe(true);
    expect(
      isStorefrontIndexable({ ...real, availableMenuItemCount: MIN_INDEXABLE_MENU_ITEMS - 1 })
    ).toBe(false);
  });

  it("never indexes a test page, however full its menu", () => {
    expect(
      isStorefrontIndexable({ slug: "testing", displayName: "testing", availableMenuItemCount: 50 })
    ).toBe(false);
  });
});

describe("storefrontRobots", () => {
  const item = (isAvailable: boolean) => ({ isAvailable });

  it("counts only available items, across categories", () => {
    expect(
      countAvailableMenuItems([
        { items: [item(true), item(false)] },
        { items: [item(true), item(true)] },
      ])
    ).toBe(3);
  });

  it("noindexes a store without a real menu but still lets crawlers follow its links", () => {
    expect(
      storefrontRobots({
        slug: "sfa",
        displayName: "sfa",
        menuCategories: [{ items: [item(true), item(false)] }],
      })
    ).toEqual({ index: false, follow: true });
  });

  it("indexes a real store with a menu", () => {
    expect(
      storefrontRobots({
        slug: "ellens-bakery",
        displayName: "Ellens Bakery",
        menuCategories: [{ items: [item(true), item(true), item(true)] }],
      })
    ).toEqual({ index: true, follow: true });
  });
});
