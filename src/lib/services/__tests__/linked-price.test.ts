import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyLinkedPrice,
  baseForOwnerPrice,
  baseToOwner,
  inspectLinkedPrice,
  ownerToBase,
  samePrice,
} from "../linked-price";

const product = (sellingPrice: number, costPrice = 0) => ({
  id: "p1",
  name: "Earl grey",
  sku: "EARL-GREY",
  sellingPrice: new Prisma.Decimal(sellingPrice),
  costPrice: new Prisma.Decimal(costPrice),
});
const item = (id: string, price: number) => ({
  id,
  name: `Item ${id}`,
  price: new Prisma.Decimal(price),
});

function fakeDb(opts: { product: unknown; items: unknown[]; afterIds?: unknown[] }) {
  const findMany = vi.fn(async (args: { where: { productId?: string } }) =>
    args.where.productId ? opts.items : (opts.afterIds ?? [])
  );
  return {
    product: { findFirst: vi.fn(async () => opts.product), update: vi.fn() },
    menuItem: { findMany, updateMany: vi.fn() },
  };
}
const input = { storeId: "s1", productId: "p1", currency: "IDR", rate: 1 };

describe("price conversion", () => {
  it("is the identity for IDR and converts both ways for other currencies", () => {
    expect(ownerToBase(45000, 1)).toBe(45000);
    expect(baseToOwner(45000, 1)).toBe(45000);
    expect(ownerToBase(4.5, 0.0001)).toBe(45000);
    expect(baseToOwner(45000, 0.0001)).toBe(4.5);
  });

  it("compares to the cent", () => {
    expect(samePrice(3, 3.004)).toBe(true);
    expect(samePrice(3, 3.01)).toBe(false);
  });

  it("refuses a price the product column can't store", () => {
    expect(baseForOwnerPrice(99_999_999.99, 1)).toBe(99_999_999.99);
    expect(() => baseForOwnerPrice(100_000_000, 1)).toThrow(/too large/);
    // 5 EUR is 50,000,000 IDR at this rate: fine; 20,000 EUR would not fit
    expect(baseForOwnerPrice(5000, 0.0001)).toBe(50_000_000);
    expect(() => baseForOwnerPrice(20_000, 0.0001)).toThrow(/too large/);
  });
});

describe("inspectLinkedPrice", () => {
  it("says what would change without writing anything", async () => {
    const db = fakeDb({ product: product(30000), items: [item("b", 30000)] });
    const found = await inspectLinkedPrice(db as never, { ...input, ownerPrice: 45000 });

    expect(found).toMatchObject({
      productName: "Earl grey",
      before: "30000.00",
      after: "45000.00",
      beforeOwner: "30000.00",
      afterOwner: "45000.00",
      productChanged: true,
    });
    expect(found?.siblings.map((s) => s.id)).toEqual(["b"]);
    expect(db.product.update).not.toHaveBeenCalled();
    expect(db.menuItem.updateMany).not.toHaveBeenCalled();
  });

  it("is a no-op when the product and its items already sit at the price", async () => {
    const db = fakeDb({ product: product(45000), items: [item("b", 45000)] });
    const found = await inspectLinkedPrice(db as never, { ...input, ownerPrice: 45000 });
    expect(found?.productChanged).toBe(false);
    expect(found?.siblings).toEqual([]);
  });

  it("is scoped to the store and skips the items the caller writes itself", async () => {
    const db = fakeDb({ product: product(30000), items: [] });
    await inspectLinkedPrice(db as never, { ...input, ownerPrice: 45000, excludeItemIds: ["a"] });

    expect(db.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", storeId: "s1" } })
    );
    expect(db.menuItem.findMany).toHaveBeenCalledWith({
      where: { productId: "p1", storefront: { storeId: "s1" }, id: { notIn: ["a"] } },
    });
  });

  it("flags a price below the product's cost", async () => {
    const db = fakeDb({ product: product(30000, 20000), items: [] });
    expect(
      (await inspectLinkedPrice(db as never, { ...input, ownerPrice: 15000 }))?.belowCost
    ).toBe(true);
    expect(
      (await inspectLinkedPrice(db as never, { ...input, ownerPrice: 25000 }))?.belowCost
    ).toBe(false);
  });

  it("returns null for a product of another store", async () => {
    const db = fakeDb({ product: null, items: [] });
    expect(await inspectLinkedPrice(db as never, { ...input, ownerPrice: 1 })).toBeNull();
  });
});

describe("applyLinkedPrice", () => {
  it("writes the product and every other linked item", async () => {
    const db = fakeDb({
      product: product(30000),
      items: [item("b", 30000), item("c", 45000)],
      afterIds: [item("b", 45000)],
    });
    const applied = await applyLinkedPrice(db as never, { ...input, ownerPrice: 45000 });

    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { sellingPrice: new Prisma.Decimal("45000.00") },
    });
    // only the item that differs is written
    expect(db.menuItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b"] } },
      data: { price: new Prisma.Decimal(45000), currency: "IDR" },
    });
    expect(applied.siblingsAfter.map((s) => s.id)).toEqual(["b"]);
  });

  it("doesn't rewrite a product that is already at the price", async () => {
    const db = fakeDb({ product: product(45000), items: [] });
    await applyLinkedPrice(db as never, { ...input, ownerPrice: 45000 });
    expect(db.product.update).not.toHaveBeenCalled();
    expect(db.menuItem.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a product that isn't in the store", async () => {
    const db = fakeDb({ product: null, items: [] });
    await expect(applyLinkedPrice(db as never, { ...input, ownerPrice: 1 })).rejects.toThrow(
      /not found or does not belong/
    );
  });
});
