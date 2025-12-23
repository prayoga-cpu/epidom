import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAlertsForPage } from "../data-fetchers";

// Mock the prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    material: {
      findMany: vi.fn(),
    },
  },
}));

// Access the mocked prisma globally or by importing
import { prisma } from "@/lib/prisma";

describe("fetchAlertsForPage", () => {
  const storeId = "store-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty alerts if no low stock items found", async () => {
    // Mock $queryRaw to return empty array
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const result = await fetchAlertsForPage(storeId);

    expect(prisma.$queryRaw).toHaveBeenCalledWith(
      expect.anything(), // Template strings are hard to match exactly, but we can verify call
      storeId
    );
    expect(prisma.material.findMany).not.toHaveBeenCalled();
    expect(result.alerts).toEqual([]);
  });

  it("should fetch details and return alerts for low stock items", async () => {
    // Mock $queryRaw to return some IDs
    const mockIds = [{ id: "mat-1" }, { id: "mat-2" }];
    (prisma.$queryRaw as any).mockResolvedValue(mockIds);

    // Mock findMany to return full material objects
    const mockMaterials = [
      {
        id: "mat-1",
        name: "Material 1",
        sku: "M1",
        unit: "kg",
        currentStock: 5,
        minStock: 10, // 50%
        materialSuppliers: [],
      },
      {
        id: "mat-2",
        name: "Material 2",
        sku: "M2",
        unit: "kg",
        currentStock: 1,
        minStock: 10, // 10% (Critical)
        materialSuppliers: [
          {
            supplier: { id: "sup-1", name: "Supplier 1", phone: "123", email: "s@g.com" },
            price: 100,
            isPreferred: true,
          },
        ],
      },
    ];
    (prisma.material.findMany as any).mockResolvedValue(mockMaterials);

    const result = await fetchAlertsForPage(storeId);

    expect(prisma.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["mat-1", "mat-2"] },
        },
      })
    );

    expect(result.alerts).toHaveLength(2);

    // Check sorting: logic sorts by stock percentage (critical first)
    // Mat 2 (10%) should be first, Mat 1 (50%) second
    expect(result.alerts[0].id).toBe("mat-2");
    expect(result.alerts[0].severity).toBe("critical");

    expect(result.alerts[1].id).toBe("mat-1");
    expect(result.alerts[1].severity).toBe("warning");
  });
});
