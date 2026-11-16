/**
 * Storefront Service Tests
 *
 * Unit tests for menu category deletion — specifically the "uncategorize"
 * vs "delete" mode logic, since the two must behave differently even though
 * the underlying schema (MenuItem.categoryId onDelete: SetNull) makes it easy
 * to accidentally leave items orphaned or accidentally destroy them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuCategory: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    menuItem: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: { findFirst: vi.fn(), update: vi.fn() },
    storefront: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));

import { Prisma } from "@prisma/client";
import { StorefrontService } from "../storefront.service";
import { prisma } from "@/lib/prisma";
import { publishStoreEvent } from "@/lib/realtime/publish";

const mockedPrisma = vi.mocked(prisma, true);

describe("StorefrontService", () => {
  let service: StorefrontService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorefrontService();
  });

  describe("deleteMenuCategory", () => {
    it("should throw if category does not belong to the storefront", async () => {
      mockedPrisma.menuCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        storefrontId: "other-storefront",
      } as any);

      await expect(service.deleteMenuCategory("cat-1", "storefront-1")).rejects.toThrow(
        "Category not found or does not belong to this storefront"
      );
    });

    it("uncategorize mode (default) should keep items and only delete the category", async () => {
      mockedPrisma.menuCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        storefrontId: "storefront-1",
      } as any);
      mockedPrisma.menuCategory.delete.mockResolvedValue({ id: "cat-1" } as any);

      await service.deleteMenuCategory("cat-1", "storefront-1");

      expect(mockedPrisma.menuItem.deleteMany).not.toHaveBeenCalled();
      expect(mockedPrisma.menuCategory.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    });

    it('explicit "uncategorize" mode should keep items and only delete the category', async () => {
      mockedPrisma.menuCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        storefrontId: "storefront-1",
      } as any);
      mockedPrisma.menuCategory.delete.mockResolvedValue({ id: "cat-1" } as any);

      await service.deleteMenuCategory("cat-1", "storefront-1", "uncategorize");

      expect(mockedPrisma.menuItem.deleteMany).not.toHaveBeenCalled();
      expect(mockedPrisma.menuCategory.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    });

    it('"delete" mode should delete the items in the category before deleting the category', async () => {
      mockedPrisma.menuCategory.findUnique.mockResolvedValue({
        id: "cat-1",
        storefrontId: "storefront-1",
      } as any);
      mockedPrisma.menuCategory.delete.mockResolvedValue({ id: "cat-1" } as any);

      await service.deleteMenuCategory("cat-1", "storefront-1", "delete");

      expect(mockedPrisma.menuItem.deleteMany).toHaveBeenCalledWith({
        where: { categoryId: "cat-1" },
      });
      expect(mockedPrisma.menuCategory.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    });
  });

  // A linked item's price is its product's price: an edit reaches both.
  describe("updateMenuItem (linked price)", () => {
    const item = (overrides: Record<string, unknown> = {}) => ({
      id: "item-1",
      storefrontId: "sf-1",
      categoryId: null,
      productId: "prod-1",
      department: "KITCHEN",
      name: "Earl grey",
      description: null,
      price: new Prisma.Decimal(30000),
      currency: "IDR",
      imageUrl: null,
      isAvailable: true,
      showOnCashier: true,
      isFeatured: false,
      displayOrder: 0,
      modifiers: null,
      buildYourOwn: false,
      ...overrides,
    });

    beforeEach(() => {
      vi.spyOn(service, "getOwnerCurrencyAndRate").mockResolvedValue({ currency: "IDR", rate: 1 });
      mockedPrisma.storefront.findUnique.mockResolvedValue({ storeId: "store-1" } as any);
      mockedPrisma.product.findFirst.mockResolvedValue({
        id: "prod-1",
        name: "Earl grey",
        sku: "EARL-GREY",
        sellingPrice: new Prisma.Decimal(30000),
        costPrice: new Prisma.Decimal(0),
      } as any);
      mockedPrisma.menuItem.findMany.mockResolvedValue([]);
      mockedPrisma.menuItem.update.mockImplementation((async (args: any) => ({
        ...item(),
        ...args.data,
      })) as any);
      mockedPrisma.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) =>
        fn(mockedPrisma)) as any);
    });

    it("sets the product's price in the same transaction when the price changed", async () => {
      mockedPrisma.menuItem.findUnique.mockResolvedValue(item() as any);

      await service.updateMenuItem("item-1", "sf-1", { price: 45000 });

      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { sellingPrice: new Prisma.Decimal("45000.00") },
      });
      expect(mockedPrisma.menuItem.update).toHaveBeenCalledTimes(1);
      expect(publishStoreEvent).toHaveBeenCalledWith("store-1", "product.changed", {
        action: "updated",
        entityId: "prod-1",
      });
    });

    it("does not push an unchanged price: the editor re-sends it on every save", async () => {
      mockedPrisma.menuItem.findUnique.mockResolvedValue(item() as any);

      await service.updateMenuItem("item-1", "sf-1", { price: 30000, name: "Earl grey tea" });

      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockedPrisma.product.update).not.toHaveBeenCalled();
      expect(mockedPrisma.menuItem.update).toHaveBeenCalledTimes(1);
    });

    it("leaves products alone for an unlinked item", async () => {
      mockedPrisma.menuItem.findUnique.mockResolvedValue(item({ productId: null }) as any);

      await service.updateMenuItem("item-1", "sf-1", { price: 45000 });

      expect(mockedPrisma.product.findFirst).not.toHaveBeenCalled();
      expect(mockedPrisma.product.update).not.toHaveBeenCalled();
    });

    it("leaves the product alone for a composable item priced 0", async () => {
      mockedPrisma.menuItem.findUnique.mockResolvedValue(item({ buildYourOwn: true }) as any);

      await service.updateMenuItem("item-1", "sf-1", { price: 0 });

      expect(mockedPrisma.product.update).not.toHaveBeenCalled();
    });

    it("converts a non-IDR price to the product's base currency", async () => {
      vi.spyOn(service, "getOwnerCurrencyAndRate").mockResolvedValue({
        currency: "EUR",
        rate: 0.0001,
      });
      mockedPrisma.menuItem.findUnique.mockResolvedValue(
        item({ price: new Prisma.Decimal(3), currency: "EUR" }) as any
      );

      await service.updateMenuItem("item-1", "sf-1", { price: 4.5 });

      expect(mockedPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { sellingPrice: new Prisma.Decimal("45000.00") },
      });
    });
  });
});
