import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));

const verifyStoreAccessWithResponse = vi.fn();
vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccessWithResponse: (...a: unknown[]) => verifyStoreAccessWithResponse(...a),
}));

const storefrontFindUnique = vi.fn();
const menuItemFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    storefront: { findUnique: (...a: unknown[]) => storefrontFindUnique(...a) },
    menuItem: { findMany: (...a: unknown[]) => menuItemFindMany(...a) },
  },
}));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = () =>
  GET(new Request(`http://localhost/api/stores/${STORE}/pos/menu`), {
    params: Promise.resolve({ id: STORE }),
  });

const item = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  name: "Croissant",
  description: null,
  price: "2.50",
  imageUrl: null,
  isAvailable: true,
  category: { name: "Pastry" },
  department: "KITCHEN",
  modifiers: null,
  product: {
    productLine: "STANDARD",
    barcode: "8991234567890",
    stockMode: "MADE_TO_ORDER",
    currentStock: "0",
    unit: "piece",
    optionGroups: [],
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "u1" } });
  verifyStoreAccessWithResponse.mockResolvedValue({
    store: { customProductsEnabled: false, customProductsLabel: null },
    accessType: "owner",
  });
  storefrontFindUnique.mockResolvedValue({ id: "sf1", isPublished: true });
});

describe("GET /pos/menu — barcode", () => {
  it("selects the barcode from the linked product", async () => {
    menuItemFindMany.mockResolvedValue([]);
    await get();
    expect(menuItemFindMany.mock.calls[0][0].select.product.select.barcode).toBe(true);
  });

  it("returns it as a TOP-LEVEL `barcode` on each item (PosMenuItem.barcode), which the scanner matches", async () => {
    menuItemFindMany.mockResolvedValue([item()]);

    const res = await get();
    const { categories } = (await res.json()).data;

    expect(categories[0].items[0].barcode).toBe("8991234567890");
    // The money stays a plain number, as before.
    expect(categories[0].items[0].price).toBe(2.5);
  });

  it("is null for a menu item with no Product (nothing to scan) and for a product with no barcode", async () => {
    menuItemFindMany.mockResolvedValue([
      item({ id: "m2", product: null }),
      item({ id: "m3", product: { ...item().product, barcode: null } }),
    ]);

    const res = await get();
    const items = (await res.json()).data.categories[0].items;

    expect(items.map((i: { barcode: unknown }) => i.barcode)).toEqual([null, null]);
  });

  it("does not let the client reach another store's menu — access is verified against the path's store", async () => {
    menuItemFindMany.mockResolvedValue([]);
    await get();
    expect(verifyStoreAccessWithResponse.mock.calls[0][0]).toBe(STORE);
  });
});
