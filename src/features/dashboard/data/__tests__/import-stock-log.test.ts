import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  storeFindFirst: vi.fn(),
  productFindFirst: vi.fn(),
  productUpdate: vi.fn(),
  productCreate: vi.fn(),
  materialCreate: vi.fn(),
  supplierFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }) } },
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findFirst: db.storeFindFirst },
    product: { findFirst: db.productFindFirst, update: db.productUpdate, create: db.productCreate },
    material: { create: db.materialCreate },
    supplier: { findMany: db.supplierFindMany },
  },
}));
vi.mock("@/lib/services/storefront.service", () => ({
  storefrontService: {
    getOwnerCurrencyAndRate: vi.fn().mockResolvedValue({ rate: 1 }),
    convertOwnerToBaseSync: (value: number) => value,
    autoLinkProductToMenu: vi.fn(),
  },
}));

import { bulkImportMultiEntity } from "../actions";

const STORE = "store-1";
const importRows = (data: Record<string, unknown>[]) =>
  bulkImportMultiEntity({ storeId: STORE, data });

beforeEach(() => {
  vi.clearAllMocks();
  db.storeFindFirst.mockResolvedValue({ id: STORE });
  db.productFindFirst.mockResolvedValue(null);
  db.productUpdate.mockResolvedValue({});
  db.productCreate.mockResolvedValue({ id: "prod-new" });
  db.materialCreate.mockResolvedValue({ id: "mat-new" });
  db.supplierFindMany.mockResolvedValue([]);
});

describe("Smart Import — stock goes on the Log", () => {
  it("leaves an existing product's stock alone when the sheet has no stock", async () => {
    db.productFindFirst.mockResolvedValue({ id: "prod-1", currentStock: 30 });

    await importRows([{ name: "Baguette", category: "products", sellingPrice: 2 }]);

    const { data } = db.productUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty("currentStock");
    expect(data).not.toHaveProperty("stockMovements");
  });

  it("logs the change when an import changes an existing product's stock", async () => {
    db.productFindFirst.mockResolvedValue({ id: "prod-1", currentStock: 30 });

    await importRows([{ name: "Baguette", category: "products", currentStock: 25, unit: "pcs" }]);

    const { data } = db.productUpdate.mock.calls[0][0];
    expect(data.currentStock).toBe(25);
    expect(data.stockMovements).toEqual({
      create: {
        type: "ADJUSTMENT",
        quantity: -5,
        unit: "pcs",
        balanceAfter: 25,
        notes: "Stock decrease - Import",
      },
    });
  });

  it("logs a new product's imported stock in the same write", async () => {
    await importRows([{ name: "Brioche", category: "products", currentStock: 7, unit: "pcs" }]);

    const { data } = db.productCreate.mock.calls[0][0];
    expect(data.currentStock).toBe(7);
    expect(data.stockMovements).toEqual({
      create: {
        type: "ADJUSTMENT",
        quantity: 7,
        unit: "pcs",
        balanceAfter: 7,
        notes: "Initial stock (import)",
      },
    });
  });

  it("logs a new material's imported stock, and nothing when there is none", async () => {
    await importRows([
      { name: "Farine", category: "materials", currentStock: 12, unit: "kg" },
      { name: "Sel", category: "materials", unit: "kg" },
    ]);

    const [farine, sel] = db.materialCreate.mock.calls.map(([args]) => args.data);
    expect(farine.stockMovements).toEqual({
      create: {
        type: "ADJUSTMENT",
        quantity: 12,
        unit: "kg",
        balanceAfter: 12,
        notes: "Initial stock (import)",
      },
    });
    expect(sel).not.toHaveProperty("stockMovements");
  });
});
