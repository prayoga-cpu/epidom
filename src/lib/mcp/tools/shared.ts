import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services/storefront.service";
import type { McpStoreContext } from "../authorize";

/**
 * Costs on Material, Product, MaterialSupplier and supplier orders are stored
 * in the platform base currency (IDR); a tool reads and writes the store's own
 * currency. `toStore` formats a stored amount, `toBase` converts one typed in
 * the store's currency for storage — the same conversion the app's forms make.
 */
export async function baseCurrency(storeId: string) {
  const { currency, rate } = await storefrontService.getOwnerCurrencyAndRate(storeId);
  return {
    currency,
    convert: (amount: unknown) =>
      money(storefrontService.convertBaseToOwnerSync(num(amount), rate)),
    toBase: (amountInStoreCurrency: number) =>
      storefrontService.convertOwnerToBaseSync(amountInStoreCurrency, rate),
  };
}

/** The business's timezone, which every report period is resolved in. */
export async function storeTimezone(ctx: McpStoreContext): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.store.businessId },
    select: { timezone: true },
  });
  return business?.timezone ?? "Asia/Jakarta";
}

/** The page grants each area's tools admit staff with. */
export const PAGES = {
  finance: ["/finance"],
  orders: ["/pos/orders", "/dashboard"],
  inventory: ["/management", "/data", "/alerts"],
  catalog: ["/data", "/management"],
  menu: ["/menu", "/storefront"],
  roster: ["/schedule"],
  ownSchedule: ["/schedule", "/pos/schedule"],
  customers: ["/customers"],
} as const;

/** Every store tool's first argument. */
export const storeIdInput = {
  storeId: z.string().min(1).describe("The store, from list_stores."),
};

/** Paging for list tools: a page size and the cursor the previous page returned. */
export const pageInput = {
  limit: z.number().int().min(1).max(100).default(25).describe("Rows per page (max 100)."),
  cursor: z.string().optional().describe("The nextCursor from the previous page."),
};

/**
 * Keep a page and report whether there is another. Callers fetch limit + 1
 * rows; the extra one only proves there is more.
 */
export function page<T extends { id: string }>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

/** Prisma cursor arguments for `cursor` (skip the cursor row itself). */
export function cursorArgs(cursor: string | undefined): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

/** Decimal-ish → number for counts and ratios (never for money in results). */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Money/quantity as a decimal string with fixed places, the form tools return. */
export function money(value: unknown, places = 2): string {
  return num(value).toFixed(places);
}
