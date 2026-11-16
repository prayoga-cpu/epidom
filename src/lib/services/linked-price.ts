import { Prisma, type MenuItem, type PrismaClient } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

/**
 * One price for a product and every menu item that sells it.
 *
 * A menu item linked to an inventory product (MenuItem.productId) is the same
 * thing on sale twice: the till and storefront read MenuItem.price, the
 * Inventory page and the margin reports read Product.sellingPrice. They must
 * never disagree, so a change to either side is written to both, in the
 * caller's transaction. Product is the source of truth (the menu editor
 * already locks a linked item's price and sends people to the Product form);
 * the menu price is its mirror.
 *
 * Currency: Product.sellingPrice is stored in the platform base currency
 * (IDR); MenuItem.price is a literal amount in the store's own currency.
 * Callers pass the store's `rate` (IDR → store currency, 1 for IDR) so this
 * file stays free of services. Menu items always receive the literal amount
 * the person typed, never a round trip through the base currency, so a
 * moving exchange rate can't make the two sides drift apart.
 *
 * Callers: the Claude connector's menu tools (src/lib/mcp/tools/menu.ts), the
 * app's PATCH menu item route (storefrontService.updateMenuItem) and the
 * reconcile script (scripts/reconcile-linked-prices.ts).
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Product.sellingPrice is Decimal(10, 2). */
export const MAX_PRODUCT_PRICE = 99_999_999.99;

// The same formulas as storefrontService.convertOwnerToBaseSync and
// convertBaseToOwnerSync, kept here so this module needs no service import.
export const ownerToBase = (price: number, rate: number): number =>
  rate === 1 ? price : Math.round((price / rate) * 100) / 100;
export const baseToOwner = (price: number, rate: number): number =>
  rate === 1 ? price : Math.round(price * rate * 100) / 100;

/** Equal to the cent, in the store's own currency. */
export const samePrice = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;

const fixed = (value: unknown): string => Number(value).toFixed(2);

/** The product price a menu price implies, or a refusal when it can't be stored. */
export function baseForOwnerPrice(ownerPrice: number, rate: number): number {
  const base = ownerToBase(ownerPrice, rate);
  if (!Number.isFinite(base) || base < 0 || base > MAX_PRODUCT_PRICE) {
    throw new ValidationError(
      `A price of ${ownerPrice} is too large to store on the linked product (the limit is ${MAX_PRODUCT_PRICE.toLocaleString("en-US")} in the base currency).`
    );
  }
  return base;
}

export interface LinkedPriceInput {
  storeId: string;
  productId: string;
  /** The price, in the store's own currency (what a menu item holds). */
  ownerPrice: number;
  currency: string;
  /** IDR → store currency, 1 when the store's currency is IDR. */
  rate: number;
  /** Menu items the caller writes itself; they are left alone here. */
  excludeItemIds?: string[];
}

export interface LinkedPriceInspection {
  productId: string;
  productName: string;
  productSku: string;
  /** Product.sellingPrice as stored (base currency), before and after. */
  before: string;
  after: string;
  /** The same two prices in the store's currency, for people to read. */
  beforeOwner: string;
  afterOwner: string;
  /** False when the product already sells at this price. */
  productChanged: boolean;
  /** The new price is below the product's cost price. */
  belowCost: boolean;
  /** Other menu items linked to the product whose price differs. */
  siblings: MenuItem[];
}

/** What setting this price would change, without writing anything. */
export async function inspectLinkedPrice(
  db: Db,
  input: LinkedPriceInput
): Promise<LinkedPriceInspection | null> {
  const product = await db.product.findFirst({
    where: { id: input.productId, storeId: input.storeId },
    select: { id: true, name: true, sku: true, sellingPrice: true, costPrice: true },
  });
  if (!product) return null;

  const exclude = input.excludeItemIds ?? [];
  const items = await db.menuItem.findMany({
    where: {
      productId: product.id,
      storefront: { storeId: input.storeId },
      ...(exclude.length > 0 && { id: { notIn: exclude } }),
    },
  });

  const after = baseForOwnerPrice(input.ownerPrice, input.rate);
  const currentOwner = baseToOwner(Number(product.sellingPrice), input.rate);
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    before: fixed(product.sellingPrice),
    after: fixed(after),
    beforeOwner: fixed(currentOwner),
    afterOwner: fixed(input.ownerPrice),
    productChanged: !samePrice(currentOwner, input.ownerPrice),
    belowCost: Number(product.costPrice) > 0 && after < Number(product.costPrice),
    siblings: items.filter((item) => !samePrice(Number(item.price), input.ownerPrice)),
  };
}

export interface LinkedPriceApplied extends LinkedPriceInspection {
  /** The siblings as they were, and as they are now. */
  siblingsAfter: MenuItem[];
}

/**
 * Set the product's price and the price of every other menu item linked to it.
 * Run it inside the transaction that changes the menu item itself.
 */
export async function applyLinkedPrice(
  tx: Db,
  input: LinkedPriceInput
): Promise<LinkedPriceApplied> {
  const found = await inspectLinkedPrice(tx, input);
  if (!found) throw new Error("Product not found or does not belong to this store");

  if (found.productChanged) {
    await tx.product.update({
      where: { id: found.productId },
      data: { sellingPrice: new Prisma.Decimal(found.after) },
    });
  }

  let siblingsAfter: MenuItem[] = [];
  if (found.siblings.length > 0) {
    const ids = found.siblings.map((item) => item.id);
    await tx.menuItem.updateMany({
      where: { id: { in: ids } },
      data: { price: new Prisma.Decimal(input.ownerPrice), currency: input.currency },
    });
    siblingsAfter = await tx.menuItem.findMany({ where: { id: { in: ids } } });
  }
  return { ...found, siblingsAfter };
}
