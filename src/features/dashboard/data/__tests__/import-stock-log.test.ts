import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  storeFindFirst: vi.fn(),
  productFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  productUpdate: vi.fn(),
  productCreate: vi.fn(),
  materialCreate: vi.fn(),
  materialFindFirst: vi.fn(),
  supplierFindMany: vi.fn(),
  supplierCreateMany: vi.fn(),
  recipeFindFirst: vi.fn(),
  recipeCreate: vi.fn(),
  currencyAndRate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }) } },
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findFirst: db.storeFindFirst },
    product: {
      findFirst: db.productFindFirst,
      findMany: db.productFindMany,
      update: db.productUpdate,
      create: db.productCreate,
    },
    material: { create: db.materialCreate, findFirst: db.materialFindFirst },
    supplier: { findMany: db.supplierFindMany, createMany: db.supplierCreateMany },
    recipe: { findFirst: db.recipeFindFirst, create: db.recipeCreate },
  },
}));
vi.mock("@/lib/services/storefront.service", () => ({
  storefrontService: {
    getOwnerCurrencyAndRate: db.currencyAndRate,
    convertOwnerToBaseSync: (value: number, rate = 1) => value * rate,
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
  db.productFindMany.mockResolvedValue([]);
  db.productUpdate.mockResolvedValue({});
  db.productCreate.mockResolvedValue({ id: "prod-new" });
  db.materialCreate.mockResolvedValue({ id: "mat-new" });
  db.materialFindFirst.mockResolvedValue(null);
  db.supplierFindMany.mockResolvedValue([]);
  db.supplierCreateMany.mockResolvedValue({ count: 1 });
  db.recipeFindFirst.mockResolvedValue(null);
  db.recipeCreate.mockResolvedValue({ id: "rec-new" });
  db.currencyAndRate.mockResolvedValue({ currency: "IDR", rate: 1 });
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

// Product.sku is required. A menu sheet with no SKU column used to fail every
// row ("Argument `sku` is missing") while the import still answered "success".
describe("Smart Import: products without a SKU column", () => {
  it("gives each new product a readable SKU, unique within the batch and the store", async () => {
    db.productFindMany.mockResolvedValue([{ sku: "latte" }]);

    await importRows([
      { name: "Pâte à banana", category: "products", sellingPrice: 6000 },
      { name: "Latte", category: "products", sellingPrice: 8000 },
      { name: "Latte!", category: "products", sellingPrice: 9000 },
    ]);

    const skus = db.productCreate.mock.calls.map(([args]) => args.data.sku);
    expect(skus).toEqual(["PATE-A-BANANA", "LATTE-2", "LATTE-3"]);
    // One lookup for the whole batch, not one per row.
    expect(db.productFindMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheet's own SKU and never looks up the store's codes for it", async () => {
    await importRows([{ name: "Flan", sku: " FLN-01 ", category: "products", sellingPrice: 1 }]);

    expect(db.productCreate.mock.calls[0][0].data.sku).toBe("FLN-01");
    expect(db.productFindMany).not.toHaveBeenCalled();
  });

  it("does not rewrite an existing product's SKU when the sheet has none", async () => {
    db.productFindFirst.mockResolvedValue({ id: "prod-1", currentStock: 0 });

    await importRows([{ name: "Baguette", category: "products", sellingPrice: 2 }]);

    expect(db.productUpdate.mock.calls[0][0].data.sku).toBeUndefined();
    expect(db.productCreate).not.toHaveBeenCalled();
  });
});

describe("Smart Import: a row that fails says why", () => {
  it("reports failure, not success, when nothing was imported", async () => {
    db.productCreate.mockRejectedValue(
      new Error(
        "\nInvalid `prisma.product.create()` invocation:\n\n{ data: {} }\n\nArgument `unit` is missing."
      )
    );

    const result = await importRows([{ name: "Flan", category: "products", sellingPrice: 1 }]);

    expect(result.success).toBe(false);
    expect(result.summary.products).toEqual({ attempted: 1, succeeded: 0 });
    // The reason is Prisma's last line, not the first 100 characters of its dump.
    expect(result.failures).toEqual([
      { entity: "product", row: 1, message: "Argument `unit` is missing." },
    ]);
  });

  it("stays a success, with the skipped rows listed, when some rows went in", async () => {
    db.productCreate
      .mockResolvedValueOnce({ id: "prod-new" })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await importRows([
      { name: "Flan", category: "products", sellingPrice: 1 },
      { name: "Tarte", category: "products", sellingPrice: 1 },
    ]);

    expect(result.success).toBe(true);
    expect(result.summary.products).toEqual({ attempted: 2, succeeded: 1 });
    expect(result.failures).toEqual([{ entity: "product", row: 2, message: "boom" }]);
  });
});

describe("Smart Import: what a row is", () => {
  it("a row with only a name follows the type chosen in the dialog", async () => {
    const result = await bulkImportMultiEntity({
      storeId: STORE,
      data: [{ name: "Flan" }],
      fallbackEntityType: "product",
    });

    expect(db.productCreate).toHaveBeenCalledTimes(1);
    expect(db.supplierCreateMany).not.toHaveBeenCalled();
    expect(result.summary.products).toEqual({ attempted: 1, succeeded: 1 });
  });

  it("without a chosen type, a bare name is still a supplier", async () => {
    await importRows([{ name: "Moulin Dupont" }]);

    expect(db.supplierCreateMany).toHaveBeenCalledTimes(1);
    expect(db.productCreate).not.toHaveBeenCalled();
  });

  it("the row's own columns beat the chosen type", async () => {
    await bulkImportMultiEntity({
      storeId: STORE,
      data: [{ name: "Farine", unitCost: "2", unit: "kg" }],
      fallbackEntityType: "product",
    });

    expect(db.materialCreate).toHaveBeenCalledTimes(1);
    expect(db.productCreate).not.toHaveBeenCalled();
  });

  it("counts the rows with no name instead of dropping them without a word", async () => {
    const result = await importRows([
      { name: "Flan", sellingPrice: 1 },
      { description: "TOTAL" },
      { sellingPrice: "" },
    ]);

    expect(result.success).toBe(true);
    expect(result.skippedRows).toBe(2);
    expect(result.summary.products).toEqual({ attempted: 1, succeeded: 1 });
  });

  it("fails when no row has a name at all", async () => {
    const result = await importRows([{ description: "x" }]);

    expect(result.success).toBe(false);
    expect(result.skippedRows).toBe(1);
    expect(result.error).toMatch(/no row has a name/i);
  });
});

describe("Smart Import: prices", () => {
  // "10.000" on an Indonesian or French menu is ten thousand, not ten.
  it("reads dot-grouped thousands in a price", async () => {
    await importRows([
      { name: "Nasi Goreng", sellingPrice: "Rp 25.000", costPrice: "10.000" },
      { name: "Espresso", sellingPrice: "2.50" },
    ]);

    const [nasi, espresso] = db.productCreate.mock.calls.map(([args]) => args.data);
    expect(nasi.sellingPrice).toBe(25000);
    expect(nasi.costPrice).toBe(10000);
    expect(espresso.sellingPrice).toBe(2.5);
  });

  it("keeps 1.375 a decimal in a store whose currency has cents", async () => {
    db.currencyAndRate.mockResolvedValue({ currency: "EUR", rate: 1 });

    await importRows([{ name: "Beurre", unitCost: "1.375", unit: "kg" }]);

    expect(db.materialCreate.mock.calls[0][0].data.unitCost).toBe(1.375);
  });

  it("leaves a stock quantity of 1.500 as one and a half", async () => {
    await importRows([{ name: "Farine", unitCost: "12.000", currentStock: "1.500", unit: "kg" }]);

    const { data } = db.materialCreate.mock.calls[0][0];
    expect(data.unitCost).toBe(12000);
    expect(data.currentStock).toBe(1.5);
  });
});

describe("Smart Import: recipes", () => {
  const breadAndCake = [
    {
      name: "Bread",
      yieldQuantity: "10",
      yieldUnit: "pcs",
      ingredient_name: "Flour",
      ingredient_qty: "500",
      ingredient_unit: "g",
    },
    { name: "Bread", ingredient_name: "Water", ingredient_qty: "300", ingredient_unit: "ml" },
    // A new recipe whose first row gives no yield.
    {
      name: "Cake",
      ingredient_name: "Sugar",
      ingredient_qty: "100",
      ingredient_unit: "g",
      ingredient_price: "5",
      costPerBatch: "20",
    },
  ];

  it("starts a new recipe at a new name, even with no yield on that row", async () => {
    db.materialCreate
      .mockResolvedValueOnce({ id: "flour" })
      .mockResolvedValueOnce({ id: "water" })
      .mockResolvedValueOnce({ id: "sugar" });

    await importRows(breadAndCake);

    const recipes = db.recipeCreate.mock.calls.map(([args]) => args.data);
    expect(recipes.map((r) => r.name)).toEqual(["Bread", "Cake"]);
    // Cake's sugar used to be merged into Bread.
    expect(recipes[0].ingredients.create.map((i: any) => i.materialId)).toEqual(["flour", "water"]);
    expect(recipes[1].ingredients.create.map((i: any) => i.materialId)).toEqual(["sugar"]);
  });

  it("stores ingredient prices and batch cost in the base currency, like materials do", async () => {
    db.currencyAndRate.mockResolvedValue({ currency: "EUR", rate: 17000 });

    await importRows(breadAndCake);

    const sugar = db.materialCreate.mock.calls.map(([args]) => args.data).at(-1);
    expect(sugar.unitCost).toBe(5 * 17000);
    const cake = db.recipeCreate.mock.calls.map(([args]) => args.data).at(-1);
    expect(cake.costPerBatch).toBe(20 * 17000);
  });
});
