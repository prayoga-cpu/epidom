/**
 * One-off repair: re-point every product-linked MenuItem at the MenuCategory
 * matching its Product's current `category` string.
 *
 * Why this is needed: until the category-sync fix in ProductService.
 * updateProduct, changing a product's category updated the Product row but
 * left the linked MenuItem filed under its old MenuCategory — so POS Cashier
 * and the public storefront (both of which group by MenuCategory, not by the
 * Product's free-text field) kept showing the stale heading indefinitely.
 * New edits stay in sync on their own; this repairs the drift that already
 * accumulated.
 *
 * Idempotent — re-running it is a no-op once everything matches. Read-only
 * for products; only ever moves a MenuItem between categories (and creates a
 * MenuCategory when the target doesn't exist yet).
 *
 * Usage: pnpm tsx scripts/repair-menu-item-categories.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const items = await prisma.menuItem.findMany({
    where: { productId: { not: null } },
    select: {
      id: true,
      name: true,
      storefrontId: true,
      category: { select: { id: true, name: true } },
      product: { select: { category: true } },
    },
  });

  let repaired = 0;
  let alreadyCorrect = 0;

  for (const item of items) {
    const target = item.product?.category?.trim() || null;
    const current = item.category?.name ?? null;

    // Same category (case-insensitively, matching resolveMenuCategoryId's own
    // comparison), or both unset — nothing to do.
    if ((target ?? "").toLowerCase() === (current ?? "").toLowerCase()) {
      alreadyCorrect++;
      continue;
    }

    let categoryId: string | null = null;
    if (target) {
      const existing = await prisma.menuCategory.findFirst({
        where: { storefrontId: item.storefrontId, name: { equals: target, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        categoryId = existing.id;
      } else if (!dryRun) {
        const maxOrder = await prisma.menuCategory.aggregate({
          where: { storefrontId: item.storefrontId },
          _max: { displayOrder: true },
        });
        const created = await prisma.menuCategory.create({
          data: {
            storefrontId: item.storefrontId,
            name: target,
            displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
          },
          select: { id: true },
        });
        categoryId = created.id;
      }
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}${item.name}: ${current ?? "(uncategorized)"} -> ${target ?? "(uncategorized)"}`
    );

    if (!dryRun) {
      await prisma.menuItem.update({ where: { id: item.id }, data: { categoryId } });
    }
    repaired++;
  }

  console.log(
    `\n${dryRun ? "[dry-run] would repair" : "Repaired"} ${repaired} menu item(s); ${alreadyCorrect} already correct.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
