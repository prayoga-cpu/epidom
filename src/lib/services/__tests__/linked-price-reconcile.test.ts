import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { findPriceMismatches, reconcileMismatches } from "../linked-price-reconcile";

const row = (id: string, price: number, productPrice: number, storeId = "s1") => ({
  id,
  name: `Item ${id}`,
  price: new Prisma.Decimal(price),
  storefront: { storeId, store: { name: `Store ${storeId}` } },
  product: {
    id: `p-${id}`,
    name: `Product ${id}`,
    sku: `SKU-${id}`,
    sellingPrice: new Prisma.Decimal(productPrice),
  },
});

const idr = async () => ({ currency: "IDR", rate: 1 });

describe("findPriceMismatches", () => {
  it("lists only the items whose price differs from their product's", async () => {
    const db = {
      menuItem: {
        findMany: vi.fn(async () => [row("a", 45000, 30000), row("b", 20000, 20000)]),
      },
    };
    const found = await findPriceMismatches(db as never, idr);
    expect(found).toEqual([
      expect.objectContaining({
        storeId: "s1",
        menuItemId: "a",
        menuPrice: "45000.00",
        productId: "p-a",
        productPrice: "30000.00",
        productPriceBase: "30000.00",
        currency: "IDR",
      }),
    ]);
  });

  it("compares in the store's own currency, so a rate-only difference isn't a mismatch", async () => {
    const db = {
      menuItem: { findMany: vi.fn(async () => [row("a", 3, 30000), row("b", 4.5, 30000)]) },
    };
    const eur = async () => ({ currency: "EUR", rate: 0.0001 });
    const found = await findPriceMismatches(db as never, eur);
    expect(found.map((m) => m.menuItemId)).toEqual(["b"]);
    expect(found[0].productPrice).toBe("3.00");
  });

  it("looks the currency up once per store and can be limited to one", async () => {
    const lookup = vi.fn(idr);
    const db = {
      menuItem: {
        findMany: vi.fn(async () => [row("a", 1, 2), row("b", 1, 2), row("c", 1, 2, "s2")]),
      },
    };
    await findPriceMismatches(db as never, lookup, { storeId: "s1" });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(db.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: { not: null }, storefront: { storeId: "s1" } },
      })
    );
  });
});

describe("reconcileMismatches", () => {
  const mismatch = {
    storeId: "s1",
    storeName: "OTIUM",
    currency: "IDR",
    menuItemId: "a",
    menuItemName: "Earl grey",
    menuPrice: "45000.00",
    productId: "p-a",
    productName: "Earl grey",
    productSku: "EARL-GREY",
    productPriceBase: "30000.00",
    productPrice: "30000.00",
  };
  const db = () => {
    const tx = { product: { update: vi.fn() }, menuItem: { update: vi.fn() } };
    return { tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  };

  it("prefer menu: the product takes the menu price", async () => {
    const d = db();
    expect(await reconcileMismatches(d as never, [mismatch], "menu", idr)).toBe(1);
    expect(d.tx.product.update).toHaveBeenCalledWith({
      where: { id: "p-a" },
      data: { sellingPrice: new Prisma.Decimal(45000) },
    });
    expect(d.tx.menuItem.update).not.toHaveBeenCalled();
  });

  it("prefer product: the menu item takes the product's price", async () => {
    const d = db();
    await reconcileMismatches(d as never, [mismatch], "product", idr);
    expect(d.tx.menuItem.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { price: new Prisma.Decimal("30000.00"), currency: "IDR" },
    });
    expect(d.tx.product.update).not.toHaveBeenCalled();
  });
});
