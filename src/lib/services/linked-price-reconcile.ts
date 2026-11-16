import { Prisma, type PrismaClient } from "@prisma/client";
import { baseToOwner, ownerToBase, samePrice } from "./linked-price";

/**
 * Audit and repair of menu items whose price differs from the product they are
 * linked to (see linked-price.ts for why they must agree). Used by
 * scripts/reconcile-linked-prices.ts and the "Ops — Reconcile linked prices"
 * workflow.
 *
 * Prices are compared in the store's own currency, because Product.sellingPrice
 * is stored in IDR and MenuItem.price in the store's currency: the product's
 * price is converted at today's rate and compared to the cent.
 */

export interface PriceMismatch {
  storeId: string;
  storeName: string;
  currency: string;
  menuItemId: string;
  menuItemName: string;
  /** MenuItem.price, store currency. */
  menuPrice: string;
  productId: string;
  productName: string;
  productSku: string;
  /** Product.sellingPrice as stored (IDR) and in the store's currency. */
  productPriceBase: string;
  productPrice: string;
}

/** The store's currency and IDR → currency rate, the way the app resolves them. */
export type OwnerRateLookup = (storeId: string) => Promise<{ currency: string; rate: number }>;

export async function findPriceMismatches(
  db: PrismaClient,
  ownerRate: OwnerRateLookup,
  opts: { storeId?: string } = {}
): Promise<PriceMismatch[]> {
  const items = await db.menuItem.findMany({
    where: {
      productId: { not: null },
      ...(opts.storeId && { storefront: { storeId: opts.storeId } }),
    },
    orderBy: [{ storefrontId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      price: true,
      storefront: { select: { storeId: true, store: { select: { name: true } } } },
      product: { select: { id: true, name: true, sku: true, sellingPrice: true } },
    },
  });

  const rates = new Map<string, { currency: string; rate: number }>();
  const mismatches: PriceMismatch[] = [];
  for (const item of items) {
    if (!item.product) continue;
    const storeId = item.storefront.storeId;
    let owner = rates.get(storeId);
    if (!owner) {
      owner = await ownerRate(storeId);
      rates.set(storeId, owner);
    }
    const productOwnerPrice = baseToOwner(Number(item.product.sellingPrice), owner.rate);
    if (samePrice(productOwnerPrice, Number(item.price))) continue;
    mismatches.push({
      storeId,
      storeName: item.storefront.store.name,
      currency: owner.currency,
      menuItemId: item.id,
      menuItemName: item.name,
      menuPrice: Number(item.price).toFixed(2),
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      productPriceBase: Number(item.product.sellingPrice).toFixed(2),
      productPrice: productOwnerPrice.toFixed(2),
    });
  }
  return mismatches;
}

/**
 * Make each mismatch agree. `menu` sets the product to the menu item's price
 * (what a person changed on the menu), `product` sets the menu item to the
 * product's. A person chooses per run: neither side is right in general.
 */
export async function reconcileMismatches(
  db: PrismaClient,
  mismatches: PriceMismatch[],
  prefer: "menu" | "product",
  ownerRate: OwnerRateLookup
): Promise<number> {
  let fixed = 0;
  for (const mismatch of mismatches) {
    const owner = await ownerRate(mismatch.storeId);
    await db.$transaction(async (tx) => {
      if (prefer === "menu") {
        await tx.product.update({
          where: { id: mismatch.productId },
          data: {
            sellingPrice: new Prisma.Decimal(ownerToBase(Number(mismatch.menuPrice), owner.rate)),
          },
        });
      } else {
        await tx.menuItem.update({
          where: { id: mismatch.menuItemId },
          data: { price: new Prisma.Decimal(mismatch.productPrice), currency: owner.currency },
        });
      }
    });
    fixed++;
  }
  return fixed;
}
