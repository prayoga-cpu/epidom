import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertType, MovementType, OrderItemStatus, StockMode } from "@prisma/client";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.

var txMock: any;
var prismaMock: any;
var world: any;
var productionBatchServiceMock: any;

/**
 * The rows this order touches, in memory.
 *
 * `balances` is the ONLY source of on-hand stock, because every balance the
 * service acts on is now read INSIDE the transaction (`tx.product.findMany`) —
 * a split computed from a pre-transaction read is a lost update under
 * concurrent delivery. Product fixtures still carry `currentStock` because
 * Prisma's include would return it, but it is seeded from the same number and
 * never read by the code under test.
 */
function resetWorld() {
  world = {
    /** id → current stock, for products and materials alike. */
    balances: {} as Record<string, number>,
    /** id → material row as `tx.material.findMany` would return it. */
    materials: {} as Record<string, any>,
    /** SALE movements already on the order (idempotency guard + reversal replay). */
    sales: [] as any[],
    /** RETURN movements carrying `reversesMovementId` (cycle scoping). */
    returns: [] as any[],
    /** The movement immediately preceding a floored historical SALE row. */
    priorMovement: null as any,
  };
}

/**
 * A fresh transaction client per `$transaction` call.
 *
 * `product.update` / `material.update` mirror Prisma's atomic
 * `{ decrement }` / `{ increment }`: they MUTATE the balance and return the
 * post-write row. The service writes `balanceAfter` straight from that return
 * value, so a mock that returned `{}` would let every ledger assertion pass
 * against `undefined`.
 */
function makeTx() {
  const applyDelta = ({ where, data }: any) => {
    const change = data.currentStock ?? {};
    const delta =
      change.decrement !== undefined ? -Number(change.decrement) : Number(change.increment ?? 0);
    world.balances[where.id] = (world.balances[where.id] ?? 0) + delta;
    return { currentStock: world.balances[where.id] };
  };

  return {
    product: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.id.in as string[]).map((id) => ({ id, currentStock: world.balances[id] ?? 0 }))
      ),
      update: vi.fn(async (args: any) => applyDelta(args)),
    },
    material: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.id.in as string[])
          .filter((id) => world.materials[id])
          .map((id) => ({ ...world.materials[id], currentStock: world.balances[id] ?? 0 }))
      ),
      update: vi.fn(async (args: any) => applyDelta(args)),
    },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    orderItem: { update: vi.fn().mockResolvedValue({}) },
    order: { update: vi.fn().mockResolvedValue({}) },
  };
}

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findUnique: vi.fn() },
    material: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.id.in as string[])
          .filter((id) => world.materials[id])
          .map((id) => ({ ...world.materials[id], currentStock: world.balances[id] ?? 0 }))
      ),
    },
    stockMovement: {
      // Two callers, told apart by their `where`: reversedSaleIds() asks for
      // RETURN rows, the reversal replay asks for SALE rows minus whatever a
      // RETURN already undid.
      findMany: vi.fn(async ({ where }: any) => {
        if (where.type === MovementType.RETURN) {
          return world.returns
            .filter((r: any) => r.reversesMovementId != null)
            .map((r: any) => ({ reversesMovementId: r.reversesMovementId }));
        }
        const excluded: string[] = where.NOT?.id?.in ?? [];
        return world.sales.filter((s: any) => !excluded.includes(s.id));
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        // "What did this row actually remove" lookup inside reverseStockForOrder.
        if (where.createdAt) return world.priorMovement;
        const excluded: string[] = where.NOT?.id?.in ?? [];
        return world.sales.find((s: any) => !excluded.includes(s.id)) ?? null;
      }),
    },
    alert: { findFirst: vi.fn(), create: vi.fn() },
    // fireLowStockAlert resolves the store owner's email to send a MagicBell
    // alert alongside the Alert row — see stock-alerts.helpers.ts.
    user: { findUnique: vi.fn().mockResolvedValue({ email: "owner@example.com" }) },
    $transaction: vi.fn(async (fn: any, _opts?: any) => {
      txMock = makeTx();
      return fn(txMock);
    }),
  };
  return { prisma: prismaMock };
});
vi.mock("@/lib/utils/types.server", () => ({
  toDecimal: (n: number) => n,
}));
vi.mock("@/lib/magicbell/client", () => ({
  sendMerchantAlert: vi.fn(),
}));
// Imported lazily by deductStockForOrder to break an import cycle; mocked so
// the shortfall hand-off can be asserted without dragging the whole
// production-batch surface (and its own prisma reads) into this suite.
vi.mock("@/lib/services/production-batch.service", () => {
  productionBatchServiceMock = { recordDrawnShortfalls: vi.fn().mockResolvedValue(undefined) };
  return { productionBatchService: productionBatchServiceMock };
});

import { deductStockForOrder, reverseStockForOrder } from "@/lib/services/stock-deduction.service";

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Shaped to mirror what Prisma ACTUALLY returns for `primaryRecipeInclude`:
// `product.primaryRecipe` is one recipe object (or null) with its ingredients
// joined to their materials. There is deliberately no `isDefault` anywhere —
// the old fixtures hand-built `recipeProducts: [{ isDefault: true, ... }]`,
// which no writer has ever produced, so the suite was green over a `where`
// clause that matched nothing in production for months.

const FLOUR = { id: "mat-1", name: "Flour", unit: "g", minStock: 50, unitCost: 0.01 };

function seedMaterial(material: any, stock: number) {
  world.materials[material.id] = material;
  world.balances[material.id] = stock;
  return material;
}

function makeRecipe(overrides: any = {}) {
  return {
    id: "recipe-1",
    yieldQuantity: 1,
    ingredients: [
      { materialId: "mat-1", quantity: 100, unit: "g", material: { ...FLOUR, currentStock: 500 } },
    ],
    ...overrides,
  };
}

/** `stock` seeds the in-transaction balance; everything else is the product row. */
function makeProduct({ stock = 10, ...overrides }: any = {}) {
  const product = {
    id: "prod-1",
    name: "Baguette",
    unit: "piece",
    minStock: 0,
    costPrice: 4,
    stockMode: StockMode.BATCH_PRODUCED,
    primaryRecipeId: "recipe-1",
    primaryRecipe: makeRecipe(),
    currentStock: stock,
    ...overrides,
  };
  world.balances[product.id] = stock;
  return product;
}

function makeItem(overrides: any = {}) {
  return {
    id: "item-1",
    quantity: 1,
    status: OrderItemStatus.SERVED,
    product: null,
    menuItem: null,
    selectedOptions: null,
    ...overrides,
  };
}

function makeOrder(items: any[], overrides: any = {}) {
  return {
    id: "order-1",
    orderNumber: "ORD-001",
    storeId: "store-1",
    store: { business: { userId: "user-1" } },
    items,
    ...overrides,
  };
}

/** Every `tx.stockMovement.create` payload written during the last run. */
function movements() {
  return txMock.stockMovement.create.mock.calls.map((call: any[]) => call[0].data);
}
function materialMovements() {
  return movements().filter((m: any) => m.materialId);
}
function productMovements() {
  return movements().filter((m: any) => m.productId);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deductStockForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorld();
    txMock = makeTx();
    seedMaterial(FLOUR, 500);
    prismaMock.alert.findFirst.mockResolvedValue(null);
    prismaMock.alert.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValue({ email: "owner@example.com" });
  });

  it("returns 0/0 when order not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0 });
  });

  it("returns 0/0 when storeId mismatch", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct() })], { storeId: "other-store" })
    );
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0 });
  });

  it("wraps all writes in one Serializable transaction", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct() })])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" })
    );
  });

  it("stamps stockDeductedAt on the order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct() })])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(txMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { stockDeductedAt: expect.any(Date) },
      })
    );
  });

  // ── Stock modes ─────────────────────────────────────────────────────────────

  describe("BATCH_PRODUCED", () => {
    it("draws the counted balance and STOPS — no material movement at all", async () => {
      // THE double-deduction fix: this product's ingredients were consumed when
      // its batch was produced. Deducting the recipe again on top of the count
      // is exactly the double-count that made every margin report wrong.
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([makeItem({ quantity: 3, product: makeProduct({ stock: 10 }) })])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(result.deducted).toBe(1);
      expect(result.shortfalls).toBeUndefined();
      expect(txMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1" },
          data: { currentStock: { decrement: 3 } },
        })
      );
      expect(world.balances["prod-1"]).toBe(7);
      expect(txMock.material.update).not.toHaveBeenCalled();
      expect(materialMovements()).toEqual([]);
      expect(world.balances["mat-1"]).toBe(500);
    });

    it("draws stock to zero, explodes the recipe for the remainder only, and reports the shortfall", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([makeItem({ quantity: 5, product: makeProduct({ stock: 2 }) })])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      // 2 from the count, 3 cooked to order.
      expect(txMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { decrement: 2 } } })
      );
      expect(world.balances["prod-1"]).toBe(0);
      // 3 units × 100 g (NOT 5 × 100 g).
      expect(txMock.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mat-1" },
          data: { currentStock: { decrement: 300 } },
        })
      );
      expect(world.balances["mat-1"]).toBe(200);
      expect(result.deducted).toBe(2);
      expect(result.shortfalls).toEqual([{ productId: "prod-1", quantity: 3 }]);
    });

    it("hands the shortfall to the ORDER_SHORTFALL settlement ledger", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([makeItem({ quantity: 5, product: makeProduct({ stock: 2 }) })])
      );

      await deductStockForOrder("order-1", "store-1");

      expect(productionBatchServiceMock.recordDrawnShortfalls).toHaveBeenCalledWith(
        "order-1",
        "store-1",
        [{ productId: "prod-1", quantity: 3 }]
      );
    });

    it("never touches the settlement ledger when the count covered the order", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([makeItem({ quantity: 3, product: makeProduct({ stock: 10 }) })])
      );
      await deductStockForOrder("order-1", "store-1");
      expect(productionBatchServiceMock.recordDrawnShortfalls).not.toHaveBeenCalled();
    });

    it("with no primary recipe, books the whole quantity against the count and lets it go negative", async () => {
      // Oversold, honestly recorded: Σ movement.quantity still reconciles with
      // currentStock, and the UI surfaces it rather than silently clamping.
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 3,
            product: makeProduct({ stock: 1, primaryRecipe: null, primaryRecipeId: null }),
          }),
        ])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(result.deducted).toBe(1);
      expect(result.shortfalls).toBeUndefined();
      expect(world.balances["prod-1"]).toBe(-2);
      expect(productMovements()).toEqual([
        expect.objectContaining({ type: MovementType.SALE, quantity: -3, balanceAfter: -2 }),
      ]);
      expect(txMock.material.update).not.toHaveBeenCalled();
    });

    it("self-heals a legacy negative balance with a ledgered ADJUSTMENT before splitting", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([makeItem({ quantity: 3, product: makeProduct({ stock: -2 }) })])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(txMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { increment: 2 } } })
      );
      expect(movements()).toContainEqual(
        expect.objectContaining({
          productId: "prod-1",
          type: MovementType.ADJUSTMENT,
          quantity: 2,
          reason: "NEGATIVE_BALANCE_CLEARED",
        })
      );
      // Healed to 0, so the whole order falls through to the recipe.
      expect(result.shortfalls).toEqual([{ productId: "prod-1", quantity: 3 }]);
      expect(world.balances["prod-1"]).toBe(0);
    });
  });

  describe("MADE_TO_ORDER", () => {
    it("writes NO product movement and explodes the recipe for every unit", async () => {
      // THE zero-deduction fix: there is no counted balance to draw, so before
      // the rewrite these lines moved nothing whatsoever.
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 2,
            product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
          }),
        ])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(txMock.product.update).not.toHaveBeenCalled();
      expect(productMovements()).toEqual([]);
      expect(txMock.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mat-1" },
          data: { currentStock: { decrement: 200 } },
        })
      );
      expect(result.deducted).toBe(1);
      expect(result.shortfalls).toBeUndefined();
    });

    it("ignores any counted balance the row happens to carry", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 2,
            product: makeProduct({ stock: 50, stockMode: StockMode.MADE_TO_ORDER }),
          }),
        ])
      );

      await deductStockForOrder("order-1", "store-1");

      expect(world.balances["prod-1"]).toBe(50);
      expect(world.balances["mat-1"]).toBe(300);
    });

    it("converts the ingredient's recipe unit into the material's own stock unit", async () => {
      // A "500 g" ingredient against kg-tracked stock must move 0.05 kg for a
      // tenth of a batch, not 50 units of "kg".
      seedMaterial({ id: "mat-2", name: "FARINE T55", unit: "kg", minStock: 0, unitCost: 1.2 }, 20);
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 1,
            product: makeProduct({
              stock: 0,
              stockMode: StockMode.MADE_TO_ORDER,
              primaryRecipe: makeRecipe({
                yieldQuantity: 10,
                ingredients: [
                  {
                    materialId: "mat-2",
                    quantity: 500,
                    unit: "g",
                    material: { id: "mat-2", name: "FARINE T55", unit: "kg", currentStock: 20 },
                  },
                ],
              }),
            }),
          }),
        ])
      );

      await deductStockForOrder("order-1", "store-1");

      expect(txMock.material.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: { decrement: 0.05 } } })
      );
      expect(materialMovements()).toEqual([
        expect.objectContaining({ quantity: -0.05, unit: "kg", balanceAfter: 19.95 }),
      ]);
    });
  });

  describe("UNTRACKED", () => {
    it("moves nothing but still freezes the per-line cost snapshot", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            id: "item-service",
            quantity: 2,
            product: makeProduct({
              stock: 0,
              stockMode: StockMode.UNTRACKED,
              costPrice: 20,
              primaryRecipe: null,
              primaryRecipeId: null,
            }),
          }),
        ])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(result).toEqual({ deducted: 0, skipped: 0 });
      expect(txMock.product.update).not.toHaveBeenCalled();
      expect(txMock.material.update).not.toHaveBeenCalled();
      expect(movements()).toEqual([]);
      // Finance margin reads this for untracked lines too — without it the
      // line books at 100% margin.
      expect(txMock.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-service" },
          data: { unitCostSnapshot: 20, optionCostSnapshot: 0 },
        })
      );
    });

    it("still snapshots even when it carries a primary recipe", async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 1,
            product: makeProduct({ stock: 5, stockMode: StockMode.UNTRACKED, costPrice: 7 }),
          }),
        ])
      );

      await deductStockForOrder("order-1", "store-1");

      expect(txMock.material.update).not.toHaveBeenCalled();
      expect(world.balances["prod-1"]).toBe(5);
      expect(txMock.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitCostSnapshot: 7 }) })
      );
    });
  });

  // ── Aggregation ─────────────────────────────────────────────────────────────

  it("sums two lines of the SAME product BEFORE the stock split", async () => {
    // Evaluated independently, each line would see the full on-hand 4 and both
    // would claim it — 7 units drawn from a balance of 4, and no shortfall
    // recorded at all.
    const product = makeProduct({ stock: 4 });
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({ id: "item-1", quantity: 2, product }),
        makeItem({ id: "item-2", quantity: 3, product }),
      ])
    );

    const result = await deductStockForOrder("order-1", "store-1");

    expect(txMock.product.update).toHaveBeenCalledTimes(1);
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { decrement: 4 } } })
    );
    expect(world.balances["prod-1"]).toBe(0);
    // Exactly one unit fell through: (2 + 3) - 4.
    expect(result.shortfalls).toEqual([{ productId: "prod-1", quantity: 1 }]);
    expect(txMock.material.update).toHaveBeenCalledTimes(1);
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { decrement: 100 } } })
    );
    expect(result.deducted).toBe(2);
  });

  it("collapses one material shared by two different products into a single movement", async () => {
    const other = {
      ...makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
      id: "prod-2",
      name: "Croissant",
    };
    world.balances["prod-2"] = 0;
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          id: "item-1",
          quantity: 1,
          product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
        }),
        makeItem({ id: "item-2", quantity: 2, product: other }),
      ])
    );

    await deductStockForOrder("order-1", "store-1");

    expect(txMock.material.update).toHaveBeenCalledTimes(1);
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { decrement: 300 } } })
    );
    expect(materialMovements()).toHaveLength(1);
  });

  // ── Rounding at Decimal(10,3) ───────────────────────────────────────────────

  describe("rounding", () => {
    it("writes NO movement and reports a requirement that rounds away to 0.000", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // 0.4 g of saffron against kg-tracked stock is 0.0004 kg → 0.000.
      seedMaterial({ id: "mat-saffron", name: "Saffron", unit: "kg", minStock: 0, unitCost: 5 }, 2);
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 1,
            product: makeProduct({
              stock: 0,
              stockMode: StockMode.MADE_TO_ORDER,
              primaryRecipe: makeRecipe({
                ingredients: [
                  {
                    materialId: "mat-saffron",
                    quantity: 0.4,
                    unit: "g",
                    material: { id: "mat-saffron", name: "Saffron", unit: "kg", currentStock: 2 },
                  },
                ],
              }),
            }),
          }),
        ])
      );

      const result = await deductStockForOrder("order-1", "store-1");

      expect(result.belowPrecision).toEqual(["mat-saffron"]);
      expect(result.deducted).toBe(0);
      expect(txMock.material.update).not.toHaveBeenCalled();
      expect(materialMovements()).toEqual([]);
      expect(world.balances["mat-saffron"]).toBe(2);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("rounds to 0.000"));
      warnSpy.mockRestore();
    });

    it("rounds ONCE and writes the identical figure to the balance and the movement", async () => {
      // Postgres rounds each Decimal(10,3) column independently, so an
      // unrounded 0.0185 would store -0.019 in the movement while moving the
      // balance by 0.018 — 0.001 of permanent drift per sale.
      seedMaterial({ id: "mat-yeast", name: "Yeast", unit: "kg", minStock: 0, unitCost: 3 }, 1);
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder([
          makeItem({
            quantity: 1,
            product: makeProduct({
              stock: 0,
              stockMode: StockMode.MADE_TO_ORDER,
              primaryRecipe: makeRecipe({
                ingredients: [
                  {
                    materialId: "mat-yeast",
                    quantity: 0.0185,
                    unit: "kg",
                    material: { id: "mat-yeast", name: "Yeast", unit: "kg", currentStock: 1 },
                  },
                ],
              }),
            }),
          }),
        ])
      );

      await deductStockForOrder("order-1", "store-1");

      const [updateCall] = txMock.material.update.mock.calls;
      expect(updateCall[0].data.currentStock.decrement).toBe(0.019);
      expect(materialMovements()[0].quantity).toBe(-0.019);
      expect(materialMovements()[0].quantity).toBe(-updateCall[0].data.currentStock.decrement);
    });
  });

  // ── Ledger rows ─────────────────────────────────────────────────────────────

  it("creates a product SALE movement with negative quantity and the post-write balance", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct({ stock: 10 }) })])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(productMovements()).toEqual([
      expect.objectContaining({
        productId: "prod-1",
        orderId: "order-1",
        type: MovementType.SALE,
        quantity: -2,
        balanceAfter: 8,
        notes: "Auto-deducted for order ORD-001",
      }),
    ]);
  });

  it("creates a material SALE movement with negative scaled quantity", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          quantity: 2,
          product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
        }),
      ])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(materialMovements()).toEqual([
      expect.objectContaining({
        materialId: "mat-1",
        type: MovementType.SALE,
        quantity: -200,
        balanceAfter: 300,
      }),
    ]);
  });

  // ── Item resolution ─────────────────────────────────────────────────────────

  it("skips item with no product and logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.order.findUnique.mockResolvedValue(makeOrder([makeItem({ quantity: 1 })]));
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.skipped).toBe(1);
    expect(result.deducted).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no product found"));
    warnSpy.mockRestore();
  });

  it("resolves menuItem product when direct product is null", async () => {
    const product = makeProduct({ stock: 10 });
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: null, menuItem: { product } })])
    );
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.deducted).toBe(1);
    expect(world.balances["prod-1"]).toBe(8);
  });

  it("deducts product stock but skips ingredients when yieldQuantity is 0", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          quantity: 3,
          product: makeProduct({ stock: 2, primaryRecipe: makeRecipe({ yieldQuantity: 0 }) }),
        }),
      ])
    );

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result.deducted).toBe(1); // the counted portion only
    expect(txMock.material.update).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("yieldQuantity=0"));
    warnSpy.mockRestore();
  });

  // ── Idempotency, cycle-scoped ───────────────────────────────────────────────

  it("is a no-op while an UNREVERSED SALE movement exists for the order", async () => {
    world.sales = [{ id: "sale-1" }];
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0, alreadyDeducted: true });
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deducts again once a RETURN carrying reversesMovementId has undone the SALE", async () => {
    // DELIVERED → CANCELLED → DELIVERED must deduct a second time. Before the
    // RETURN link existed the guard made re-delivery a permanent no-op.
    world.sales = [{ id: "sale-1" }];
    world.returns = [{ reversesMovementId: "sale-1" }];
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct({ stock: 10 }) })])
    );

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result.alreadyDeducted).toBeUndefined();
    expect(result.deducted).toBe(1);
    expect(world.balances["prod-1"]).toBe(8);
    // The guard must exclude only the reversed SALE, not every SALE.
    expect(prismaMock.stockMovement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { id: { in: ["sale-1"] } } }),
      })
    );
  });

  it("stays a no-op when a SECOND SALE cycle is open even though an older one was reversed", async () => {
    world.sales = [{ id: "sale-1" }, { id: "sale-2" }];
    world.returns = [{ reversesMovementId: "sale-1" }];
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0, alreadyDeducted: true });
  });

  // ── Alerts ──────────────────────────────────────────────────────────────────

  it("creates CRITICAL_STOCK alert when material falls below minStock", async () => {
    world.balances["mat-1"] = 100; // 100 - 200 = -100, min 50 → critical
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          quantity: 2,
          product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
        }),
      ])
    );

    await deductStockForOrder("order-1", "store-1");

    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AlertType.CRITICAL_STOCK,
          entityType: "material",
          entityId: "mat-1",
        }),
      })
    );
  });

  it("creates a LOW_STOCK alert for the product when it drops below minStock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct({ stock: 10, minStock: 20 }) })])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AlertType.LOW_STOCK,
          entityType: "product",
          entityId: "prod-1",
        }),
      })
    );
  });

  it("still raises the par-level alert for a product that sold PAST zero", async () => {
    // The shortfall portion writes no product movement, so without the
    // dedicated shortfall pass the alert would go silent exactly on the days
    // the owner sells out.
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([makeItem({ quantity: 2, product: makeProduct({ stock: 0, minStock: 4 }) })])
    );

    await deductStockForOrder("order-1", "store-1");

    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: "product", entityId: "prod-1" }),
      })
    );
  });

  it("does NOT create duplicate alert when unread alert already exists", async () => {
    prismaMock.alert.findFirst.mockResolvedValue({ id: "existing-alert" });
    world.balances["mat-1"] = 10;
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          quantity: 2,
          product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
        }),
      ])
    );
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("does not create alert when stock stays above minStock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder([
        makeItem({
          quantity: 2,
          product: makeProduct({ stock: 0, stockMode: StockMode.MADE_TO_ORDER }),
        }),
      ])
    ); // material 500 - 200 = 300 > 50, product minStock 0
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });
});

// ── Reversal ──────────────────────────────────────────────────────────────────

describe("reverseStockForOrder", () => {
  const PRODUCT_SALE = {
    id: "sale-product",
    productId: "prod-1",
    materialId: null,
    quantity: -3,
    unit: "piece",
    balanceAfter: 7,
    createdAt: new Date("2026-08-14T10:00:00Z"),
  };
  const MATERIAL_SALE = {
    id: "sale-material",
    productId: null,
    materialId: "mat-1",
    quantity: -200,
    unit: "g",
    balanceAfter: 300,
    createdAt: new Date("2026-08-14T10:00:01Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetWorld();
    txMock = makeTx();
    seedMaterial(FLOUR, 300);
    world.balances["prod-1"] = 7;
    world.sales = [PRODUCT_SALE, MATERIAL_SALE];
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      storeId: "store-1",
      orderNumber: "ORD-001",
    });
  });

  it("returns 0 when the order belongs to another store", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      storeId: "other-store",
      orderNumber: "ORD-001",
    });
    await expect(reverseStockForOrder("order-1", "store-1")).resolves.toEqual({ reversed: 0 });
  });

  it("restores finished goods ONLY by default — the flour is inside food that was handed over", async () => {
    const result = await reverseStockForOrder("order-1", "store-1");

    expect(result).toEqual({ reversed: 1 });
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: { currentStock: { increment: 3 } },
      })
    );
    expect(world.balances["prod-1"]).toBe(10);
    expect(txMock.material.update).not.toHaveBeenCalled();
    expect(world.balances["mat-1"]).toBe(300);
  });

  it("restores raw materials too when the operator states the food was never made", async () => {
    const result = await reverseStockForOrder("order-1", "store-1", { foodWasNeverMade: true });

    expect(result).toEqual({ reversed: 2 });
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mat-1" },
        data: { currentStock: { increment: 200 } },
      })
    );
    expect(world.balances["mat-1"]).toBe(500);
    expect(world.balances["prod-1"]).toBe(10);
  });

  it("writes each RETURN with the id of the exact SALE it reverses", async () => {
    await reverseStockForOrder("order-1", "store-1", { foodWasNeverMade: true });

    expect(movements()).toEqual([
      expect.objectContaining({
        productId: "prod-1",
        type: MovementType.RETURN,
        quantity: 3,
        reversesMovementId: "sale-product",
      }),
      expect.objectContaining({
        materialId: "mat-1",
        type: MovementType.RETURN,
        quantity: 200,
        reversesMovementId: "sale-material",
      }),
    ]);
  });

  it("never replays a SALE a RETURN already reversed (cancel → re-deliver → cancel)", async () => {
    world.returns = [{ reversesMovementId: "sale-product" }];

    const result = await reverseStockForOrder("order-1", "store-1");

    expect(result).toEqual({ reversed: 0 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(world.balances["prod-1"]).toBe(7);
  });

  it("caps the restore at what a historical floored row PROVES was removed", async () => {
    // Pre-clamp-removal rows recorded the full quantity while flooring
    // balanceAfter at 0; restoring abs(quantity) would fabricate stock.
    world.balances["prod-1"] = 0;
    world.sales = [{ ...PRODUCT_SALE, quantity: -5, balanceAfter: 0 }];
    world.priorMovement = { balanceAfter: 2 };

    await reverseStockForOrder("order-1", "store-1");

    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { increment: 2 } } })
    );
    expect(world.balances["prod-1"]).toBe(2);
  });

  it("trusts the recorded quantity when no prior movement exists to prove inflation", async () => {
    world.balances["prod-1"] = 0;
    world.sales = [{ ...PRODUCT_SALE, quantity: -5, balanceAfter: 0 }];
    world.priorMovement = null;

    await reverseStockForOrder("order-1", "store-1");

    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { increment: 5 } } })
    );
  });
});
