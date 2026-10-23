import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// The repository is built on an injected fake client; keep the real one (and
// its database connection) out of the test.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ProductRepository } from "../product.repository";
import { ValidationError } from "@/lib/errors";

const db = {
  material: { count: vi.fn() },
  productOptionGroup: { deleteMany: vi.fn(), create: vi.fn() },
  product: { findUnique: vi.fn() },
};
let repo: ProductRepository;

const step = (materialId?: string) => ({
  name: "Base",
  isRequired: true,
  maxSelections: 1,
  options: [
    { name: "Rice", priceAdjustment: 0, materialId, materialQty: materialId ? 150 : undefined },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.product.findUnique.mockResolvedValue({ id: "p1" });
  repo = new ProductRepository(db as unknown as PrismaClient);
});

describe("ProductRepository.updateOptionGroups — linked materials stay in the store", () => {
  it("saves choices linked to this store's materials", async () => {
    db.material.count.mockResolvedValue(1);

    await repo.updateOptionGroups("p1", "store-1", [step("mat-1"), step("mat-1")]);

    expect(db.material.count).toHaveBeenCalledWith({
      where: { id: { in: ["mat-1"] }, storeId: "store-1" },
    });
    expect(db.productOptionGroup.create).toHaveBeenCalledTimes(2);
  });

  it("refuses a material from another store, before touching the groups", async () => {
    db.material.count.mockResolvedValue(0);

    await expect(
      repo.updateOptionGroups("p1", "store-1", [step("mat-foreign")])
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.productOptionGroup.deleteMany).not.toHaveBeenCalled();
  });

  it("skips the check when no choice links a material", async () => {
    await repo.updateOptionGroups("p1", "store-1", [step()]);

    expect(db.material.count).not.toHaveBeenCalled();
    expect(db.productOptionGroup.create).toHaveBeenCalledTimes(1);
  });
});
