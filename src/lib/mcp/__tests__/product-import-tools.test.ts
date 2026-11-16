import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * update_product (price, cost, SKU, name without re-importing) and the
 * import_catalog preview, which says per row whether a commit updates, skips
 * or creates.
 */

const prisma = vi.hoisted(() => ({
  mcpToolCall: { create: vi.fn(async () => ({})) },
  product: { findFirst: vi.fn(), findMany: vi.fn() },
  material: { findMany: vi.fn() },
  supplier: { findMany: vi.fn() },
  recipe: { findMany: vi.fn() },
}));
const storefrontService = vi.hoisted(() => ({
  getOwnerCurrencyAndRate: vi.fn(async () => ({ currency: "IDR", rate: 1 })),
  convertBaseToOwnerSync: (amount: number, rate: number) =>
    rate === 1 ? amount : Math.round(amount * rate * 100) / 100,
  convertOwnerToBaseSync: (amount: number, rate: number) =>
    rate === 1 ? amount : Math.round((amount / rate) * 100) / 100,
}));
const productService = vi.hoisted(() => ({ updateProduct: vi.fn() }));
const importCatalogEntity = vi.hoisted(() => vi.fn());
const authorizeMcpStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService }));
vi.mock("@/lib/services/product.service", () => ({ productService }));
vi.mock("@/lib/services/catalog-import.service", () => ({ importCatalogEntity }));
vi.mock("@/lib/services/store-alerts.service", () => ({ loadStoreAlerts: vi.fn() }));
vi.mock("@/lib/services/stock-adjust.service", () => ({ adjustStockRecorded: vi.fn() }));
vi.mock("@/lib/services/waste.service", () => ({ wasteService: {} }));
vi.mock("../authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authorize")>()),
  authorizeMcpStore,
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));
vi.mock("@/lib/audit/activity", () => ({ writeActivityEvent: vi.fn(async () => undefined) }));

import { Prisma } from "@prisma/client";
import { updateProduct } from "../tools/inventory";
import { importCatalog } from "../tools/import";

const call = {
  principal: {
    userId: "owner-user",
    clientId: "c1",
    clientName: "Claude",
    scopes: ["epidom:read", "epidom:write"],
  },
  meta: {
    requestId: "r1",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
};

const run = async (
  tool: { run: (a: Record<string, unknown>, c: typeof call) => Promise<any> },
  args: Record<string, unknown>
) => {
  const result = await tool.run({ storeId: "store-1", ...args }, call);
  const text = (result.content[0] as { text: string }).text;
  return { isError: Boolean(result.isError), text, json: result.isError ? null : JSON.parse(text) };
};

const earlGrey = {
  id: "p1",
  name: "Earl grey",
  sku: "EARL-GREY",
  category: "TEA",
  unit: "cup",
  minStock: new Prisma.Decimal(5),
  costPrice: new Prisma.Decimal(8000),
  sellingPrice: new Prisma.Decimal(30000),
  _count: { menuItems: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  storefrontService.getOwnerCurrencyAndRate.mockResolvedValue({ currency: "IDR", rate: 1 });
  authorizeMcpStore.mockResolvedValue({
    storeId: "store-1",
    store: { id: "store-1", businessId: "b1", name: "OTIUM" },
    principal: call.principal,
    role: "OWNER",
    staffMemberId: null,
    actor: {
      kind: "USER",
      refId: "owner-user",
      displayName: "Evan",
      email: null,
      adminGrantSource: null,
    },
  });
  prisma.product.findFirst.mockResolvedValue(earlGrey);
  prisma.product.findMany.mockResolvedValue([]);
  prisma.material.findMany.mockResolvedValue([]);
  prisma.supplier.findMany.mockResolvedValue([]);
  prisma.recipe.findMany.mockResolvedValue([]);
  productService.updateProduct.mockResolvedValue({});
});

describe("update_product", () => {
  it("changes the price through the product service, which keeps the menu items in step", async () => {
    const { json } = await run(updateProduct, { productId: "p1", sellingPrice: 45000 });

    expect(productService.updateProduct).toHaveBeenCalledWith("p1", "store-1", {
      sellingPrice: 45000,
    });
    expect(json.changes).toEqual({ sellingPrice: { from: "30000.00", to: "45000.00" } });
    expect(json.alsoUpdatedMenuItems).toBe(1);
  });

  it("previews without writing", async () => {
    const { json } = await run(updateProduct, {
      productId: "p1",
      sellingPrice: 45000,
      mode: "preview",
    });
    expect(productService.updateProduct).not.toHaveBeenCalled();
    expect(json).toMatchObject({ mode: "preview", alsoUpdatesMenuItems: 1 });
  });

  it("pins a cost typed here so the recipe doesn't recalculate it", async () => {
    await run(updateProduct, { productId: "p1", costPrice: 9000 });
    expect(productService.updateProduct).toHaveBeenCalledWith("p1", "store-1", {
      costPrice: 9000,
      costPriceManual: true,
    });
  });

  it("converts a non-IDR price to the product's base currency", async () => {
    storefrontService.getOwnerCurrencyAndRate.mockResolvedValue({ currency: "EUR", rate: 0.0001 });
    const { json } = await run(updateProduct, { productId: "p1", sellingPrice: 4.5 });
    expect(productService.updateProduct).toHaveBeenCalledWith("p1", "store-1", {
      sellingPrice: 45000,
    });
    expect(json.changes.sellingPrice).toEqual({ from: "3.00", to: "4.50" });
  });

  it("refuses a selling price below the cost, and an empty call", async () => {
    const low = await run(updateProduct, { productId: "p1", sellingPrice: 5000 });
    expect(low.isError).toBe(true);
    expect(low.text).toMatch(/below the cost price/);

    const empty = await run(updateProduct, { productId: "p1" });
    expect(empty.isError).toBe(true);
    expect(productService.updateProduct).not.toHaveBeenCalled();
  });

  it("answers not found for a product of another store", async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    const { isError, text } = await run(updateProduct, { productId: "ghost", sellingPrice: 1 });
    expect(isError).toBe(true);
    expect(text).toMatch(/No such product/);
  });

  it("relays a SKU clash in words, and does nothing when nothing changes", async () => {
    productService.updateProduct.mockRejectedValue(
      new Error('Product with SKU "TEA-1" already exists in this store')
    );
    const clash = await run(updateProduct, { productId: "p1", sku: "TEA-1" });
    expect(clash.text).toMatch(/already uses that SKU/);

    productService.updateProduct.mockClear();
    const same = await run(updateProduct, { productId: "p1", sellingPrice: 30000 });
    expect(same.json.unchanged).toBe(true);
    expect(productService.updateProduct).not.toHaveBeenCalled();
  });
});

describe("import_catalog preview", () => {
  const preview = (kind: string, rows: Array<Record<string, unknown>>) =>
    run(importCatalog, { mode: "preview", kind, rows });

  it("says a matching product would be UPDATED, not skipped or duplicated", async () => {
    prisma.product.findMany.mockResolvedValue([earlGrey]);
    const { json } = await preview("product", [{ name: "earl grey", sellingPrice: 45000 }]);

    expect(json.wouldUpdate).toBe(1);
    expect(json.wouldCreate).toBe(0);
    expect(json.commitWill).toMatch(/UPDATES the products already in Epidom/);
    expect(json.alreadyInEpidom).toEqual(["earl grey"]);
    expect(json.rowsInEpidom[0]).toMatchObject({
      action: "update",
      matchedBy: "name",
      matches: { id: "p1", sku: "EARL-GREY" },
      changes: { sellingPrice: { from: "30000.00", to: "45000.00" } },
      alsoUpdatesMenuItems: 1,
    });
  });

  it("lists what a partial row leaves as it is", async () => {
    prisma.product.findMany.mockResolvedValue([earlGrey]);
    const { json } = await preview("product", [{ name: "Earl grey", sellingPrice: 45000 }]);
    expect(json.rowsInEpidom[0].leftAsIs).toEqual(["costPrice", "unit", "minStock"]);
  });

  it("matches by SKU when the name differs, and creates what isn't there", async () => {
    prisma.product.findMany.mockResolvedValue([earlGrey]);
    const { json } = await preview("product", [
      { name: "Tea, earl grey", sku: "EARL-GREY", sellingPrice: 30000 },
      { name: "Matcha", sellingPrice: 25000 },
    ]);

    expect(json.rowsInEpidom).toHaveLength(1);
    expect(json.rowsInEpidom[0]).toMatchObject({ row: 1, matchedBy: "sku", action: "update" });
    expect(json.wouldCreate).toBe(1);
    // an unchanged price is no change and moves no menu item
    expect(json.rowsInEpidom[0].changes).toEqual({});
    expect(json.rowsInEpidom[0].alsoUpdatesMenuItems).toBeUndefined();
  });

  it("warns that a same-named material or supplier would be added a second time", async () => {
    prisma.material.findMany.mockResolvedValue([{ id: "m1", name: "Flour", sku: "MAT-1" }]);
    const material = await preview("material", [{ name: "Flour" }, { name: "Salt", sku: "MAT-1" }]);
    expect(material.json.commitWill).toMatch(/only CREATES materials/);
    expect(material.json.rowsInEpidom[0]).toMatchObject({ action: "create", matchedBy: "name" });
    expect(material.json.rowsInEpidom[0].note).toMatch(/SECOND one/);
    expect(material.json.wouldSkip).toBe(1);

    prisma.supplier.findMany.mockResolvedValue([{ id: "s1", name: "Bali Dairy" }]);
    const supplier = await preview("supplier", [{ name: "bali dairy" }]);
    expect(supplier.json.rowsInEpidom[0].note).toMatch(/SECOND one/);
  });

  it("says a recipe of the same name is updated", async () => {
    prisma.recipe.findMany.mockResolvedValue([{ id: "r1", name: "Chai" }]);
    const { json } = await preview("recipe", [{ name: "Chai" }]);
    expect(json.wouldUpdate).toBe(1);
  });

  it("commit passes the rows to the importer", async () => {
    importCatalogEntity.mockResolvedValue({
      success: true,
      count: 1,
      details: { attempted: 1, errors: [] },
    });
    const { json } = await run(importCatalog, {
      mode: "commit",
      kind: "product",
      rows: [{ name: "Earl grey", sellingPrice: 45000 }],
    });
    expect(importCatalogEntity).toHaveBeenCalledWith("store-1", "product", [
      { name: "Earl grey", sellingPrice: 45000 },
    ]);
    expect(json.imported).toBe(1);
  });
});
