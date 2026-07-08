import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    menuItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    menuCategory: {
      aggregate: vi.fn(),
    },
  };
  return { prisma: prismaMock };
});

import { storefrontService } from "@/lib/services/storefront.service";

const STOREFRONT_ID = "storefront-1";

function mockStorefront(menuCategories: Array<{ id: string; name: string }> = []) {
  return {
    id: STOREFRONT_ID,
    storeId: "store-1",
    menuCategories,
  } as any;
}

describe("storefrontService.autoLinkProductToMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing if the product already has a linked MenuItem", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue({ id: "existing-item" });
    const getStorefrontSpy = vi.spyOn(storefrontService, "getStorefrontByStoreId");

    await storefrontService.autoLinkProductToMenu("store-1", {
      id: "product-1",
      name: "Croissant",
      sellingPrice: 15000,
      category: "Pastries",
    });

    expect(getStorefrontSpy).not.toHaveBeenCalled();
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("creates a MenuItem with no category when the product has none", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);
    vi.spyOn(storefrontService, "getStorefrontByStoreId").mockResolvedValue(mockStorefront());
    prismaMock.menuItem.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
    prismaMock.menuItem.create.mockResolvedValue({ id: "new-item" });

    await storefrontService.autoLinkProductToMenu("store-1", {
      id: "product-1",
      name: "Croissant",
      sellingPrice: 15000,
      category: null,
    });

    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storefrontId: STOREFRONT_ID,
        categoryId: null,
        productId: "product-1",
        name: "Croissant",
        isAvailable: true,
        displayOrder: 0,
      }),
    });
    const priceArg = prismaMock.menuItem.create.mock.calls[0][0].data.price;
    expect(Number(priceArg)).toBe(15000);
  });

  it("reuses an existing MenuCategory matching the product's category, case-insensitively", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);
    vi.spyOn(storefrontService, "getStorefrontByStoreId").mockResolvedValue(
      mockStorefront([{ id: "cat-1", name: "pastries" }])
    );
    prismaMock.menuItem.aggregate.mockResolvedValue({ _max: { displayOrder: 2 } });
    prismaMock.menuItem.create.mockResolvedValue({ id: "new-item" });

    await storefrontService.autoLinkProductToMenu("store-1", {
      id: "product-1",
      name: "Croissant",
      sellingPrice: 15000,
      category: "Pastries",
    });

    expect(prismaMock.menuCategory.aggregate).not.toHaveBeenCalled();
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: "cat-1",
        displayOrder: 3,
      }),
    });
  });

  it("creates a new MenuCategory when no existing category matches", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);
    vi.spyOn(storefrontService, "getStorefrontByStoreId").mockResolvedValue(mockStorefront([]));
    const createCategorySpy = vi
      .spyOn(storefrontService, "createMenuCategory")
      .mockResolvedValue({ id: "new-cat" } as any);
    prismaMock.menuCategory.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
    prismaMock.menuItem.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
    prismaMock.menuItem.create.mockResolvedValue({ id: "new-item" });

    await storefrontService.autoLinkProductToMenu("store-1", {
      id: "product-1",
      name: "Croissant",
      sellingPrice: 15000,
      category: "Viennoiserie",
    });

    expect(createCategorySpy).toHaveBeenCalledWith(STOREFRONT_ID, {
      name: "Viennoiserie",
      displayOrder: 0,
    });
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: "new-cat" }),
    });
  });

  it("swallows errors so a menu-linking failure never throws (non-fatal)", async () => {
    prismaMock.menuItem.findFirst.mockRejectedValue(new Error("db down"));

    await expect(
      storefrontService.autoLinkProductToMenu("store-1", {
        id: "product-1",
        name: "Croissant",
        sellingPrice: 15000,
        category: null,
      })
    ).resolves.toBeUndefined();
  });
});
