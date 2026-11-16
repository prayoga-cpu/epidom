/**
 * Audit (and optionally repair) menu items whose price differs from the
 * inventory product they are linked to.
 *
 * Why: a menu item linked to a product (MenuItem.productId) and that product
 * must show the same price (see src/lib/services/linked-price.ts). Before that
 * was enforced, a price changed on one side (through the Claude connector, the
 * menu route or a catalogue import) never reached the other.
 *
 * Read-only unless --apply is given. Prices are compared in the store's own
 * currency (the product's IDR price converted at today's rate).
 *
 * Usage:
 *   pnpm tsx scripts/reconcile-linked-prices.ts                  # list mismatches, all stores
 *   pnpm tsx scripts/reconcile-linked-prices.ts --store <id>     # one store
 *   pnpm tsx scripts/reconcile-linked-prices.ts --apply --prefer=menu     # product takes the menu price
 *   pnpm tsx scripts/reconcile-linked-prices.ts --apply --prefer=product  # menu takes the product price
 *
 * --apply needs --prefer: neither side is right in general, so a person picks
 * after reading the list. Run against production only through the GitHub
 * workflow "Ops — Reconcile linked prices".
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";
import { storefrontService } from "../src/lib/services/storefront.service";
import {
  findPriceMismatches,
  reconcileMismatches,
} from "../src/lib/services/linked-price-reconcile";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const storeFlag = args.indexOf("--store");
const storeId = storeFlag >= 0 ? args[storeFlag + 1] : undefined;
const preferArg = args.find((a) => a.startsWith("--prefer="))?.split("=")[1];

async function main() {
  if (apply && preferArg !== "menu" && preferArg !== "product") {
    throw new Error("--apply needs --prefer=menu or --prefer=product");
  }

  const ownerRate = (id: string) => storefrontService.getOwnerCurrencyAndRate(id);
  const mismatches = await findPriceMismatches(prisma, ownerRate, { storeId });

  if (mismatches.length === 0) {
    console.log("No mismatches: every linked menu item matches its product's price.");
    return;
  }
  console.table(
    mismatches.map((m) => ({
      store: m.storeName,
      storeId: m.storeId,
      item: m.menuItemName,
      menuPrice: m.menuPrice,
      product: `${m.productName} (${m.productSku})`,
      productPrice: m.productPrice,
      currency: m.currency,
    }))
  );
  console.log(`${mismatches.length} mismatch(es).`);

  if (!apply) {
    console.log(
      "Dry run: nothing was changed. Re-run with --apply --prefer=menu|product to fix them."
    );
    return;
  }
  const fixed = await reconcileMismatches(
    prisma,
    mismatches,
    preferArg as "menu" | "product",
    ownerRate
  );
  console.log(
    `Fixed ${fixed} (${preferArg === "menu" ? "products took the menu price" : "menu items took the product price"}).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
