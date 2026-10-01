import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { ITEMS_UNAVAILABLE_REASON } from "@/lib/constants/pos";
import { repairCartItems, unavailableLinesFromError } from "../cart-repair";
import type { CartItem, PosMenuCategory, PosMenuItem } from "../../types/pos.types";

const line = (
  over: Partial<CartItem> & Pick<CartItem, "id" | "menuItemId" | "name">
): CartItem => ({
  unitPrice: 10,
  quantity: 1,
  modifiers: [],
  lineTotal: 10,
  ...over,
});

const menuItem = (over: Partial<PosMenuItem> & Pick<PosMenuItem, "id" | "name">): PosMenuItem => ({
  price: 10,
  isAvailable: true,
  ...over,
});

const menu = (...items: PosMenuItem[]): PosMenuCategory[] =>
  [{ name: "All", items }] as PosMenuCategory[];

const refusal = (details: unknown) =>
  new ApiClientError(
    {
      success: false,
      error: { code: "INVALID_INPUT", message: "No longer available", details },
    } as ConstructorParameters<typeof ApiClientError>[0],
    422
  );

describe("unavailableLinesFromError", () => {
  it("reads the refused lines off the server's 422", () => {
    const error = refusal({
      reason: ITEMS_UNAVAILABLE_REASON,
      items: [{ menuItemId: "old-1", name: "Flan" }],
    });
    expect(unavailableLinesFromError(error)).toEqual([{ menuItemId: "old-1", name: "Flan" }]);
  });

  it("is null for every other failure, so the caller keeps its own handling", () => {
    expect(unavailableLinesFromError(new Error("network"))).toBeNull();
    expect(unavailableLinesFromError(refusal(undefined))).toBeNull();
    expect(unavailableLinesFromError(refusal({ reason: "SOMETHING_ELSE" }))).toBeNull();
    expect(
      unavailableLinesFromError(refusal({ reason: ITEMS_UNAVAILABLE_REASON, items: [] }))
    ).toBeNull();
    // A Zod field-error array is `details` too.
    expect(unavailableLinesFromError(refusal([{ field: "items", message: "bad" }]))).toBeNull();
  });
});

describe("repairCartItems", () => {
  it("re-links a line to the item that replaced it, at the current price", () => {
    const cart = [
      line({
        id: "l1",
        menuItemId: "old-1",
        name: "Flan",
        unitPrice: 15,
        quantity: 2,
        modifiers: [{ groupName: "Sauce", optionName: "Caramel", priceAdjustment: 2 }],
        notes: "warm",
        lineTotal: 34,
      }),
    ];

    const repair = repairCartItems(
      cart,
      [{ menuItemId: "old-1", name: "Flan" }],
      menu(menuItem({ id: "new-1", name: " flan ", price: 16, imageUrl: "flan.jpg" }))
    );

    expect(repair.items).toEqual([
      {
        id: "l1",
        menuItemId: "new-1",
        name: " flan ",
        unitPrice: 16,
        quantity: 2,
        modifiers: [{ groupName: "Sauce", optionName: "Caramel", priceAdjustment: 2 }],
        notes: "warm",
        lineTotal: 36,
        imageUrl: "flan.jpg",
      },
    ]);
    expect(repair.relinked).toEqual([{ name: " flan ", priceChanged: true }]);
    expect(repair.removed).toEqual([]);
  });

  it("removes a line nothing sellable replaces: missing, switched off, or the refused id itself", () => {
    const cart = [
      line({ id: "l1", menuItemId: "old-1", name: "Flan" }),
      line({ id: "l2", menuItemId: "old-2", name: "Tarte" }),
      line({ id: "l3", menuItemId: "old-3", name: "Latte" }),
    ];

    const repair = repairCartItems(
      cart,
      [
        { menuItemId: "old-1", name: "Flan" },
        { menuItemId: "old-2", name: "Tarte" },
        { menuItemId: "old-3", name: "Latte" },
      ],
      menu(
        menuItem({ id: "x", name: "Tarte", isAvailable: false }),
        // Still on the cached menu, but it is the very id the server refused.
        menuItem({ id: "old-3", name: "Latte" })
      )
    );

    expect(repair.items).toEqual([]);
    expect(repair.removed).toEqual(["Flan", "Tarte", "Latte"]);
  });

  it("removes rather than guesses when two items share the name", () => {
    const repair = repairCartItems(
      [line({ id: "l1", menuItemId: "old-1", name: "Latte" })],
      [{ menuItemId: "old-1", name: "Latte" }],
      menu(
        menuItem({ id: "a", name: "Latte", price: 8 }),
        menuItem({ id: "b", name: "Latte", price: 12 })
      )
    );

    expect(repair.items).toEqual([]);
    expect(repair.removed).toEqual(["Latte"]);
  });

  it("never touches a line the server did not refuse, even one missing from the menu", () => {
    const kept = line({ id: "l1", menuItemId: "hidden", name: "Staff meal" });
    const custom = line({ id: "l2", menuItemId: null, name: "Corkage", isCustom: true });

    const repair = repairCartItems(
      [kept, custom, line({ id: "l3", menuItemId: "old-1", name: "Flan" })],
      [{ menuItemId: "old-1", name: "Flan" }],
      menu()
    );

    expect(repair.items).toEqual([kept, custom]);
    expect(repair.removed).toEqual(["Flan"]);
  });
});
