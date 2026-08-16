/**
 * Read-only integrity report for the two-tier stock model (Product.stockMode /
 * Product.primaryRecipeId).
 *
 * Run it after any migration that touches the model, and periodically in
 * production. It answers three questions that nothing else does:
 *   1. Does every product with recipe links have a primary elected? (A product
 *      without one deducts no ingredients on sale — the original defect.)
 *   2. Does any primaryRecipeId cross a store boundary? (The FK is global, so
 *      that would let one store drain another's inventory.)
 *   3. Is any drawn-shortfall debt failing to drain? (A figure that never
 *      settles means production runs are not netting against it, and the same
 *      materials get drawn twice.)
 *
 * Strictly read-only — it never writes. `--dry-run` is accepted and ignored so
 * the invocation matches the other scripts in this directory.
 *
 * Usage: pnpm tsx scripts/report-stock-mode-integrity.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

function section(title: string, rows: unknown[], detail?: (r: never) => string) {
  const ok = rows.length === 0;
  console.log(`\n${ok ? "OK  " : "FLAG"}  ${title} — ${rows.length}`);
  if (!ok && detail) {
    for (const r of rows.slice(0, 25)) console.log(`        ${detail(r as never)}`);
    if (rows.length > 25) console.log(`        … and ${rows.length - 25} more`);
  }
  return rows.length;
}

async function main() {
  console.log("Two-tier stock integrity report");
  console.log("================================");

  // Printed first so a PASS can be read in context: "0 flags" across 0 rows is
  // not evidence of anything.
  const [products, recipes, links, withPrimary, materials, orders] = await Promise.all([
    prisma.product.count(),
    prisma.recipe.count(),
    prisma.recipeProduct.count(),
    prisma.product.count({ where: { primaryRecipeId: { not: null } } }),
    prisma.material.count(),
    prisma.order.count(),
  ]);
  const modes = await prisma.product.groupBy({ by: ["stockMode"], _count: true });
  console.log(
    `\nScope: ${products} products, ${recipes} recipes, ${links} recipe links ` +
      `(${withPrimary} products have a primary), ${materials} materials, ${orders} orders`
  );
  console.log(`Modes: ${modes.map((m) => `${m.stockMode}=${m._count}`).join("  ") || "none"}`);

  let flags = 0;

  // A product carrying recipe links but no elected primary deducts no
  // ingredients on sale — the exact defect this release fixes, reintroduced.
  const linkedNoPrimary = await prisma.product.findMany({
    where: { primaryRecipeId: null, recipeProducts: { some: {} } },
    select: { id: true, name: true, storeId: true, stockMode: true },
  });
  flags += section(
    "Products with recipe links but no primaryRecipeId",
    linkedNoPrimary,
    (r: { name: string; storeId: string; stockMode: string }) =>
      `${r.name} (store ${r.storeId}, ${r.stockMode})`
  );

  // A cross-store primary would let store A drain store B's inventory and
  // broadcast B's material ids on A's realtime channel.
  const crossStore = await prisma.$queryRaw<
    { id: string; name: string; product_store: string; recipe_store: string }[]
  >`
    SELECT p."id", p."name", p."storeId" AS product_store, r."storeId" AS recipe_store
      FROM "products" p JOIN "recipes" r ON r."id" = p."primaryRecipeId"
     WHERE p."storeId" <> r."storeId"`;
  flags += section(
    "Cross-store primaryRecipeId (CRITICAL — tenant isolation)",
    crossStore,
    (r: { name: string; product_store: string; recipe_store: string }) =>
      `${r.name}: product store ${r.product_store} vs recipe store ${r.recipe_store}`
  );

  const crossStoreLinks = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM "recipe_products" rp
      JOIN "products" p ON p."id" = rp."productId"
      JOIN "recipes"  r ON r."id" = rp."recipeId"
     WHERE p."storeId" <> r."storeId"`;
  flags += section(
    "Cross-store recipe_products links (any)",
    Number(crossStoreLinks[0]?.count ?? 0) > 0 ? [crossStoreLinks[0]] : [],
    (r: { count: bigint }) => `${r.count} link(s)`
  );

  // MADE_TO_ORDER with no recipe silently deducts nothing on sale. Allowed by
  // design (blocking it would make the importer path fail), but must be loud.
  const mtoNoRecipe = await prisma.product.findMany({
    where: { stockMode: "MADE_TO_ORDER", primaryRecipeId: null },
    select: { id: true, name: true, storeId: true },
  });
  flags += section(
    "MADE_TO_ORDER products with no primary recipe (deduct nothing)",
    mtoNoRecipe,
    (r: { name: string; storeId: string }) => `${r.name} (store ${r.storeId})`
  );

  // Negative balances are the honest record of an oversell, but each one is a
  // physical-count problem only a human can close.
  const oversold = await prisma.product.findMany({
    where: { stockMode: "BATCH_PRODUCED", currentStock: { lt: 0 } },
    select: { id: true, name: true, storeId: true, currentStock: true, unit: true },
  });
  flags += section(
    "Oversold BATCH_PRODUCED products (negative balance)",
    oversold,
    (r: { name: string; currentStock: unknown; unit: string; storeId: string }) =>
      `${r.name}: ${String(r.currentStock)} ${r.unit} (store ${r.storeId})`
  );

  const negativeMaterials = await prisma.material.findMany({
    where: { currentStock: { lt: 0 } },
    select: { id: true, name: true, storeId: true, currentStock: true, unit: true },
  });
  flags += section(
    "Materials with a negative balance",
    negativeMaterials,
    (r: { name: string; currentStock: unknown; unit: string }) =>
      `${r.name}: ${String(r.currentStock)} ${r.unit}`
  );

  // Multi-link products where the migration picked the oldest link. The owner
  // should confirm the choice in the product form.
  const multi = await prisma.$queryRaw<{ id: string; name: string; links: bigint }[]>`
    SELECT p."id", p."name", count(*)::bigint AS links
      FROM "recipe_products" rp JOIN "products" p ON p."id" = rp."productId"
     GROUP BY p."id", p."name" HAVING count(*) > 1 ORDER BY count(*) DESC`;
  section(
    "Multi-recipe products (migration picked the oldest — owner review)",
    multi,
    (r: { name: string; links: bigint }) => `${r.name}: ${r.links} linked recipes`
  );

  // Unsettled fallback debt. A non-zero figure here is normal during service;
  // a figure that never drains means settlement is not being applied.
  const debt = await prisma.$queryRaw<{ count: bigint; qty: number | null }[]>`
    SELECT count(*)::bigint AS count,
           COALESCE(SUM("plannedQuantity" - "settledQuantity"), 0)::float8 AS qty
      FROM "production_batches"
     WHERE "materialsDrawnAt" IS NOT NULL
       AND "status" <> 'CANCELLED'
       AND "settledQuantity" < "plannedQuantity"`;
  section(
    "Outstanding drawn-shortfall debt (informational)",
    Number(debt[0]?.count ?? 0) > 0 ? [debt[0]] : [],
    (r: { count: bigint; qty: number }) => `${r.count} batch(es), ${r.qty} unit(s) unsettled`
  );

  console.log(
    `\n${flags === 0 ? "PASS — no integrity flags." : `FAIL — ${flags} row(s) across flagged sections.`}`
  );
  console.log(
    "Product.trackStock and RecipeProduct.isDefault were dropped in 20260816090000; stockMode and primaryRecipeId are now the only sources of truth."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
