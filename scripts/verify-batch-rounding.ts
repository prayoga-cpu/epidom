/**
 * Demonstrates how a production run sizes its raw-material draw.
 *
 * The question this answers: a recipe yields 5 Baguettes and consumes 1000 g of
 * flour per batch. You ask the kitchen for 3. How much flour leaves?
 *
 * A batch is indivisible — you cannot bake 0.6 of a dough — so the honest
 * answer is one whole batch (1000 g), producing 5 Baguettes, not 3.
 *
 * Creates its own store and deletes it afterwards (`--keep` to inspect).
 *
 * Usage: pnpm tsx --env-file=.env scripts/verify-batch-rounding.ts
 */
import { PrismaClient, StockMode, RecipeType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

const keep = process.argv.includes("--keep");
const TAG = `BATCH-${Date.now()}`;

async function main() {
  console.log("Batch rounding — what a production run actually draws");
  console.log("====================================================\n");

  const business = await prisma.business.findFirst({ select: { id: true } });
  if (!business) throw new Error("No Business row found.");

  const store = await prisma.store.create({
    data: { businessId: business.id, name: `${TAG} Store`, productionEnabled: true },
    select: { id: true },
  });

  // 1 batch = 1000 g of flour and yields 5 Baguettes.
  const flour = await prisma.material.create({
    data: {
      storeId: store.id,
      sku: `${TAG}-FLOUR`,
      name: "Flour",
      unit: "g",
      unitCost: 0.01,
      currentStock: 10000,
      minStock: 0,
    },
    select: { id: true },
  });

  const recipe = await prisma.recipe.create({
    data: {
      storeId: store.id,
      name: "Baguette Tradition",
      yieldQuantity: 5,
      yieldUnit: "piece",
      productionTimeMinutes: 90,
      costPerBatch: 10,
      // Produced ahead in whole batches — the whole point of the check.
      type: RecipeType.BATCH,
      ingredients: { create: [{ materialId: flour.id, quantity: 1000, unit: "g" }] },
    },
    select: { id: true },
  });

  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      sku: `${TAG}-BAG`,
      name: "Baguette",
      costPrice: 2,
      sellingPrice: 5,
      currentStock: 0,
      minStock: 0,
      unit: "piece",
      stockMode: StockMode.BATCH_PRODUCED,
      primaryRecipeId: recipe.id,
      recipeProducts: { create: [{ recipeId: recipe.id }] },
    },
    select: { id: true },
  });

  const { productionBatchService } = await import("../src/lib/services/production-batch.service");

  const flourBefore = 10000;
  console.log("Recipe:  1 batch = 1000 g flour  →  yields 5 Baguettes");
  console.log(`Flour on hand: ${flourBefore} g\n`);
  console.log("Asking the kitchen for 3 Baguettes...\n");

  await productionBatchService.startProduction({
    storeId: store.id,
    productId: product.id,
    recipeId: recipe.id,
    plannedQuantity: 3,
    scheduledDate: new Date(),
  });

  const after = await prisma.material.findUnique({
    where: { id: flour.id },
    select: { currentStock: true },
  });
  const drawn = flourBefore - Number(after?.currentStock ?? 0);

  console.log(`Flour drawn: ${drawn} g`);
  console.log(`Batches this represents: ${drawn / 1000}\n`);

  const wholeBatch = drawn === 1000;
  const batch = await prisma.productionBatch.findFirst({
    where: { storeId: store.id },
    select: { plannedQuantity: true },
  });
  const willProduce = Number(batch?.plannedQuantity ?? 0);
  console.log(`Batch records it will produce: ${willProduce} Baguettes\n`);

  if (wholeBatch && willProduce === 5) {
    console.log("PASS — a whole batch was drawn. 3 requested, 5 baked, 1000 g out.");
  } else {
    console.log(`FAIL — drew ${drawn / 1000} of a batch.`);
    console.log("       A dough cannot be split. Asking for 3 of a 5-yield recipe must");
    console.log("       bake one whole batch: 1000 g out, 5 Baguettes on the shelf.");
  }

  if (keep) {
    console.log(`\nLeft in place. Store id: ${store.id}`);
  } else {
    await prisma.store.delete({ where: { id: store.id } });
    console.log(`\nCleaned up ${TAG}.`);
  }
  if (!wholeBatch || willProduce !== 5) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
