import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  precheckMenuCategories,
  precheckMenuItems,
  precheckProductOptions,
  reverseMenuCategories,
  reverseMenuItems,
  reverseProductOptions,
  toItemState,
  type MenuItemState,
} from "../menu-undo";

const state = (overrides: Partial<MenuItemState> = {}): MenuItemState => ({
  id: "i1",
  name: "Quinoa",
  price: "20000.00",
  description: null,
  categoryId: "c1",
  department: "KITCHEN",
  isAvailable: true,
  showOnCashier: true,
  isFeatured: false,
  productId: null,
  buildYourOwn: false,
  modifiers: null,
  ...overrides,
});
const liveRow = (s: MenuItemState) => ({ ...s, price: new Prisma.Decimal(s.price) });

const itemsChange = (before: MenuItemState, after: MenuItemState) => ({
  storeId: "s1",
  storefrontId: "sf1",
  summary: "x",
  updated: [{ before, after }],
  created: [],
});

describe("menu item undo", () => {
  it("is allowed while the item still looks like the change left it", async () => {
    const after = state({ isAvailable: false });
    const db = {
      menuItem: { findMany: vi.fn(async () => [liveRow(after)]) },
      menuCategory: { count: vi.fn(async () => 1) },
      product: { count: vi.fn(async () => 0) },
    };
    expect(await precheckMenuItems(itemsChange(state(), after), db as never)).toBeNull();
  });

  it("refuses when the item was edited afterwards, so a newer edit is never overwritten", async () => {
    const after = state({ isAvailable: false });
    const db = {
      menuItem: { findMany: vi.fn(async () => [liveRow({ ...after, price: "25000.00" })]) },
      menuCategory: { count: vi.fn(async () => 1) },
      product: { count: vi.fn(async () => 0) },
    };
    const refusal = await precheckMenuItems(itemsChange(state(), after), db as never);
    expect(refusal?.code).toBe("SUPERSEDED");
    expect(refusal?.message).toMatch(/changed since/);
  });

  it("refuses when an item was deleted, or the category it came from is gone", async () => {
    const after = state({ isAvailable: false });
    const gone = { menuItem: { findMany: vi.fn(async () => []) } };
    expect((await precheckMenuItems(itemsChange(state(), after), gone as never))?.code).toBe(
      "TARGET_MISSING"
    );
    const noCategory = {
      menuItem: { findMany: vi.fn(async () => [liveRow(after)]) },
      menuCategory: { count: vi.fn(async () => 0) },
      product: { count: vi.fn(async () => 0) },
    };
    expect(
      (await precheckMenuItems(itemsChange(state(), after), noCategory as never))?.message
    ).toMatch(/category/);
  });

  it("compares modifiers whatever order the database returns their keys in", async () => {
    const mods = [
      {
        name: "Size",
        isRequired: false,
        maxSelections: 1,
        options: [{ name: "L", priceAdd: 5000 }],
      },
    ];
    const reordered = [
      {
        options: [{ priceAdd: 5000, name: "L" }],
        maxSelections: 1,
        isRequired: false,
        name: "Size",
      },
    ];
    const after = state({ modifiers: mods });
    const db = {
      menuItem: { findMany: vi.fn(async () => [liveRow({ ...after, modifiers: reordered })]) },
      menuCategory: { count: vi.fn(async () => 1) },
      product: { count: vi.fn(async () => 0) },
    };
    expect(await precheckMenuItems(itemsChange(state(), after), db as never)).toBeNull();
  });

  it("restores the before-image and deletes what the change added", async () => {
    const tx = { menuItem: { update: vi.fn(), deleteMany: vi.fn() } };
    await reverseMenuItems(
      {
        ...itemsChange(state({ price: "18000.00", modifiers: null }), state()),
        created: [state({ id: "new-1" })],
      },
      tx as never
    );
    expect(tx.menuItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ name: "Quinoa", categoryId: "c1" }),
    });
    expect(tx.menuItem.update.mock.calls[0][0].data.price.toString()).toBe("18000");
    expect(tx.menuItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["new-1"] }, storefrontId: "sf1" },
    });
  });

  it("reads a database row into the stored image with a plain price string", () => {
    expect(toItemState({ ...liveRow(state({ price: "12.5" })), modifiers: undefined }).price).toBe(
      "12.50"
    );
  });
});

describe("menu category undo", () => {
  const change = {
    storeId: "s1",
    storefrontId: "sf1",
    action: "merge_into" as const,
    summary: "x",
    before: [
      { id: "c1", name: "BASE", displayOrder: 0 },
      { id: "c2", name: "BOWLS", displayOrder: 1 },
    ],
    after: [{ id: "c2", name: "BOWLS", displayOrder: 1 }],
    removed: [{ id: "c1", name: "BASE", displayOrder: 0, itemIds: ["i1", "i2"] }],
    movedTo: "c2",
  };

  it("is allowed when the target still holds the moved items and nothing was renamed", async () => {
    const db = {
      menuCategory: { findMany: vi.fn(async () => [{ id: "c2", name: "BOWLS", displayOrder: 1 }]) },
      menuItem: { count: vi.fn(async () => 2) },
    };
    expect(await precheckMenuCategories(change, db as never)).toBeNull();
  });

  it("refuses when a moved item left the target, or the removed category came back", async () => {
    const moved = {
      menuCategory: { findMany: vi.fn(async () => [{ id: "c2", name: "BOWLS", displayOrder: 1 }]) },
      menuItem: { count: vi.fn(async () => 1) },
    };
    expect((await precheckMenuCategories(change, moved as never))?.code).toBe("SUPERSEDED");
    const back = {
      menuCategory: {
        findMany: vi.fn(async () => [
          { id: "c2", name: "BOWLS", displayOrder: 1 },
          { id: "c1", name: "BASE", displayOrder: 0 },
        ]),
      },
      menuItem: { count: vi.fn(async () => 2) },
    };
    expect((await precheckMenuCategories(change, back as never))?.code).toBe("UNIQUE_COLLISION");
  });

  it("brings back the category with its id and its items, then restores the surviving names", async () => {
    const tx = {
      menuCategory: { create: vi.fn(), update: vi.fn() },
      menuItem: { updateMany: vi.fn() },
    };
    await reverseMenuCategories(change, tx as never);
    expect(tx.menuCategory.create).toHaveBeenCalledWith({
      data: { id: "c1", storefrontId: "sf1", name: "BASE", displayOrder: 0 },
    });
    expect(tx.menuItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["i1", "i2"] }, storefrontId: "sf1" },
      data: { categoryId: "c1" },
    });
    expect(tx.menuCategory.update).toHaveBeenCalledWith({
      where: { id: "c2" },
      data: { name: "BOWLS", displayOrder: 1 },
    });
  });
});

describe("product option undo", () => {
  const group = (name: string, materialId: string | null) => ({
    name,
    isRequired: false,
    maxSelections: 1,
    options: [
      {
        name: "Chicken",
        priceAdjustment: "35000.00",
        materialId,
        materialQty: materialId ? "100.000" : null,
      },
    ],
  });
  const change = {
    storeId: "s1",
    productId: "p1",
    productName: "BYO",
    before: [group("Old", "m0")],
    after: [group("Protein", "m1")],
    beforeBuildYourOwn: false,
    afterBuildYourOwn: true,
  };
  const liveGroups = (g: ReturnType<typeof group>) => [
    {
      name: g.name,
      isRequired: g.isRequired,
      maxSelections: g.maxSelections,
      options: g.options.map((o) => ({
        name: o.name,
        priceAdjustment: new Prisma.Decimal(o.priceAdjustment),
        materialId: o.materialId,
        materialQty: o.materialQty ? new Prisma.Decimal(o.materialQty) : null,
      })),
    },
  ];

  it("is allowed when the groups still match what the change set and the old materials exist", async () => {
    const db = {
      product: { findFirst: vi.fn(async () => ({ id: "p1", buildYourOwn: true })) },
      productOptionGroup: { findMany: vi.fn(async () => liveGroups(group("Protein", "m1"))) },
      material: { count: vi.fn(async () => 1) },
    };
    expect(await precheckProductOptions(change, db as never)).toBeNull();
  });

  it("refuses when the groups were edited since, or an old material is gone", async () => {
    const edited = {
      product: { findFirst: vi.fn(async () => ({ id: "p1", buildYourOwn: true })) },
      productOptionGroup: { findMany: vi.fn(async () => liveGroups(group("Other", "m1"))) },
      material: { count: vi.fn(async () => 1) },
    };
    expect((await precheckProductOptions(change, edited as never))?.code).toBe("SUPERSEDED");
    const noMaterial = {
      ...edited,
      productOptionGroup: { findMany: vi.fn(async () => liveGroups(group("Protein", "m1"))) },
      material: { count: vi.fn(async () => 0) },
    };
    expect((await precheckProductOptions(change, noMaterial as never))?.code).toBe(
      "TARGET_MISSING"
    );
  });

  it("replaces the groups with the old ones and the old Build Your Own flag", async () => {
    const tx = {
      productOptionGroup: { deleteMany: vi.fn(), create: vi.fn() },
      product: { update: vi.fn() },
    };
    await reverseProductOptions(change, tx as never);
    expect(tx.productOptionGroup.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
    expect(tx.productOptionGroup.create.mock.calls[0][0].data).toMatchObject({
      productId: "p1",
      name: "Old",
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { buildYourOwn: false },
    });
  });
});
