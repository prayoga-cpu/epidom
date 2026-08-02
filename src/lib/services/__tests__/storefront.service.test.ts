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
    },
  },
}));

import { StorefrontService } from "../storefront.service";
import { prisma } from "@/lib/prisma";

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
});
