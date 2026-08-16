/**
 * End-to-end verification of the automated flow:
 *
 *     order  →  stock reduction  →  finance report
 *
 * Exercises the REAL service code — `deductStockForOrder`, `sumCogsBase`,
 * `reverseStockForOrder`, `quickLogProduction` — against a real database, not
 * mocks. Everything it creates is prefixed `E2E-` and torn down afterwards.
 *
 * What it proves, scenario by scenario:
 *   1. BATCH_PRODUCED sale draws the counted balance and NOT the ingredients
 *      (the double-deduction fix).
 *   2. BATCH_PRODUCED sold past its balance falls through to raw materials for
 *      the uncovered part only, and records the debt.
 *   3. MADE_TO_ORDER sale draws raw materials for every unit and writes no
 *      product movement (the zero-deduction fix).
 *   4. UNTRACKED sale moves nothing but still freezes a cost snapshot.
 *   5. Finance COGS reflects those sales — the figure that used to read ~0.
 *   6. Logging prep afterwards does NOT draw the same ingredients twice.
 *   7. Cancelling restores finished goods but not ingredients already cooked.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/verify-stock-flow.ts
 *   pnpm tsx --env-file=.env scripts/verify-stock-flow.ts --keep   # inspect in the UI
 *
 * SAFE TO RUN against the development branch. It creates its own store and
 * deletes it (cascading) unless --keep is passed.
 */
import { PrismaClient, StockMode, MovementType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

const keep = process.argv.includes("--keep");
const TAG = `E2E-${Date.now()}`;

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(
      `  ✗ ${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function heading(text: string) {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

async function num(model: "product" | "material", id: string): Promise<number> {
  const row =
    model === "product"
      ? await prisma.product.findUnique({ where: { id }, select: { currentStock: true } })
      : await prisma.material.findUnique({ where: { id }, select: { currentStock: true } });
  return Number(row?.currentStock ?? 0);
}

async function main() {
  console.log("Epidom — end-to-end stock flow verification");
  console.log("===========================================");
  console.log(`Tag: ${TAG}${keep ? "  (--keep: data will be left in place)" : ""}`);

  // ── Scaffold ──────────────────────────────────────────────────────────────
  // Attach to any existing user/business so the store is reachable in the UI.
  const business = await prisma.business.findFirst({ select: { id: true, userId: true } });
  if (!business) throw new Error("No Business row found — seed one first.");

  const store = await prisma.store.create({
    data: {
      businessId: business.id,
      name: `${TAG} Test Store`,
      // No `slug` on Store — that lives on Storefront, which this flow does
      // not need.
      productionEnabled: true,
    },
    select: { id: true, name: true },
  });
  console.log(`Store: ${store.name} (${store.id})`);

  // Raw material: flour, 10 000 g on hand at 0.01 per g.
  const flour = await prisma.material.create({
    data: {
      storeId: store.id,
      sku: `${TAG}-FLOUR`,
      name: "E2E Flour",
      unit: "g",
      unitCost: 0.01,
      currentStock: 10000,
      minStock: 0,
    },
    select: { id: true },
  });

  // Recipe: 1 croissant = 100 g of flour → cost 1.00 per unit.
  const recipe = await prisma.recipe.create({
    data: {
      storeId: store.id,
      name: "E2E Croissant",
      yieldQuantity: 1,
      yieldUnit: "piece",
      productionTimeMinutes: 30,
      costPerBatch: 1,
      ingredients: { create: [{ materialId: flour.id, quantity: 100, unit: "g" }] },
    },
    select: { id: true },
  });

  async function makeProduct(name: string, mode: StockMode, stock: number, linkRecipe: boolean) {
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        sku: `${TAG}-${name}`,
        name: `E2E ${name}`,
        costPrice: 1,
        sellingPrice: 5,
        currentStock: stock,
        minStock: 0,
        unit: "piece",
        stockMode: mode,
        ...(linkRecipe && {
          primaryRecipeId: recipe.id,
          recipeProducts: { create: [{ recipeId: recipe.id }] },
        }),
      },
      select: { id: true },
    });
    return product.id;
  }

  const batchId = await makeProduct("BATCH", StockMode.BATCH_PRODUCED, 10, true);
  const shortId = await makeProduct("SHORT", StockMode.BATCH_PRODUCED, 2, true);
  const mtoId = await makeProduct("MTO", StockMode.MADE_TO_ORDER, 0, true);
  const untrackedId = await makeProduct("SERVICE", StockMode.UNTRACKED, 0, false);

  const { deductStockForOrder, reverseStockForOrder } = await import(
    "../src/lib/services/stock-deduction.service"
  );
  const { sumCogsBase } = await import("../src/lib/finance/cogs");
  const { productionBatchService } = await import("../src/lib/services/production-batch.service");

  let orderSeq = 0;
  async function placeOrder(lines: { productId: string; qty: number }[]) {
    orderSeq++;
    return prisma.order.create({
      data: {
        storeId: store.id,
        orderNumber: `${TAG}-${orderSeq}`,
        customerName: "E2E",
        orderType: "TAKEAWAY",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        status: "DELIVERED",
        deliveredDate: new Date(),
        source: "POS",
        subtotal: 5 * lines.reduce((s, l) => s + l.qty, 0),
        total: 5 * lines.reduce((s, l) => s + l.qty, 0),
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            name: "E2E line",
            quantity: l.qty,
            unit: "piece",
            unitPrice: 5,
            total: 5 * l.qty,
          })),
        },
      },
      select: { id: true },
    });
  }

  // ── 1. Batch-produced sale draws finished goods only ─────────────────────
  heading("1. Batch-produced sale — draws the shelf, NOT the ingredients");
  const flourBefore = await num("material", flour.id);
  const order1 = await placeOrder([{ productId: batchId, qty: 3 }]);
  await deductStockForOrder(order1.id, store.id);

  check("product stock 10 → 7", await num("product", batchId), 7);
  check(
    "flour untouched (already spent at production)",
    await num("material", flour.id),
    flourBefore
  );

  // ── 2. Selling past the counted balance falls through to materials ───────
  heading("2. Sold past the shelf — the uncovered part draws ingredients");
  const order2 = await placeOrder([{ productId: shortId, qty: 5 }]);
  await deductStockForOrder(order2.id, store.id);

  check("product drawn to 0 (had 2)", await num("product", shortId), 0);
  // 3 uncovered units × 100 g = 300 g.
  check("flour 10000 → 9700 for the 3 uncovered", await num("material", flour.id), 9700);
  const debt = await productionBatchService.getOutstandingDrawnShortfall(shortId);
  check("3 units of debt recorded", debt, 3);

  // ── 3. Made-to-order draws materials for every unit ──────────────────────
  heading("3. Made-to-order — every unit draws ingredients, no shelf movement");
  const order3 = await placeOrder([{ productId: mtoId, qty: 2 }]);
  await deductStockForOrder(order3.id, store.id);

  check("flour 9700 → 9500 (2 × 100 g)", await num("material", flour.id), 9500);
  check("no counted balance touched", await num("product", mtoId), 0);
  const mtoProductMoves = await prisma.stockMovement.count({
    where: { orderId: order3.id, productId: { not: null } },
  });
  check("no product movement written", mtoProductMoves, 0);

  // ── 4. Untracked moves nothing but still costs ───────────────────────────
  heading("4. Untracked — nothing moves, but the cost is still frozen");
  const order4 = await placeOrder([{ productId: untrackedId, qty: 4 }]);
  await deductStockForOrder(order4.id, store.id);

  const untrackedMoves = await prisma.stockMovement.count({ where: { orderId: order4.id } });
  check("no stock movements at all", untrackedMoves, 0);
  const snap = await prisma.orderItem.findFirst({
    where: { orderId: order4.id },
    select: { unitCostSnapshot: true },
  });
  check("cost snapshot still written", Number(snap?.unitCostSnapshot ?? -1), 1);

  // ── 5. Finance picks it all up ───────────────────────────────────────────
  heading("5. Finance report — COGS reflects the sales");
  const cogs = await sumCogsBase({ storeId: store.id });
  // 3 batch @1 + 5 short @1 + 2 mto @1 + 4 service @1 = 14.00 of frozen cost.
  check("COGS from frozen snapshots", Math.round(cogs.cogsBase * 100) / 100, 14);
  check("no uncosted lines", cogs.unknownCostLines, 0);
  console.log(`      (a store on the old code would report 0.00 here)`);

  // ── 6. Logging prep afterwards must not double-draw ──────────────────────
  heading("6. Logging the prep run afterwards — no double draw");
  const flourBeforePrep = await num("material", flour.id);
  await productionBatchService.quickLogProduction({
    storeId: store.id,
    productId: shortId,
    quantity: 10,
  });
  // 10 baked, 3 already paid for in ingredients → only 7 × 100 g leaves.
  check("flour drawn for 7, not 10", flourBeforePrep - (await num("material", flour.id)), 700);
  check("shelf credited 7, not 10", await num("product", shortId), 7);
  check(
    "debt fully settled",
    await productionBatchService.getOutstandingDrawnShortfall(shortId),
    0
  );

  // ── 7. Cancelling restores the shelf, not the ingredients ────────────────
  heading("7. Cancelling a delivered order — shelf back, ingredients stay spent");
  const flourBeforeCancel = await num("material", flour.id);
  await reverseStockForOrder(order1.id, store.id);

  check("3 finished goods returned to the shelf", await num("product", batchId), 10);
  check("ingredients NOT credited back", await num("material", flour.id), flourBeforeCancel);
  const returns = await prisma.stockMovement.count({
    where: { orderId: order1.id, type: MovementType.RETURN },
  });
  check("RETURN movements written", returns, 1);

  // ── Ledger integrity ─────────────────────────────────────────────────────
  heading("8. Ledger closes — Σ movements == current balance");
  // SIGN CONVENTION, which is NOT uniform in this schema and predates the
  // two-tier work: SALE and WASTE store a negative quantity, but PRODUCTION_OUT
  // stores a POSITIVE magnitude even though it is an outflow. Summing the
  // column naively therefore never reconciles for any material used in
  // production. Normalised here rather than flipped in the data: historical
  // rows already use this convention, and a half-migrated ledger would be worse
  // than a consistent but odd one.
  const OUTFLOW_STORED_POSITIVE = new Set<MovementType>([MovementType.PRODUCTION_OUT]);

  for (const [label, id, kind] of [
    ["flour", flour.id, "material"],
    ["batch product", batchId, "product"],
  ] as const) {
    const rows = await prisma.stockMovement.findMany({
      where: kind === "material" ? { materialId: id } : { productId: id },
      select: { type: true, quantity: true },
    });
    const net = rows.reduce((sum, m) => {
      const q = Number(m.quantity);
      return sum + (OUTFLOW_STORED_POSITIVE.has(m.type) ? -Math.abs(q) : q);
    }, 0);
    const opening = kind === "material" ? 10000 : 10;
    check(
      `${label}: opening + Σ movements == balance`,
      Math.round((opening + net) * 1000) / 1000,
      Math.round((await num(kind, id)) * 1000) / 1000
    );
  }

  // ── Teardown ─────────────────────────────────────────────────────────────
  if (keep) {
    console.log(`\nLeft in place for inspection. Store id: ${store.id}`);
    console.log(`Delete later with:  DELETE FROM stores WHERE id = '${store.id}';`);
  } else {
    await prisma.store.delete({ where: { id: store.id } });
    console.log(`\nCleaned up ${TAG}.`);
  }

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
