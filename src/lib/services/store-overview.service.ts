import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { ACTIVE_STAFF_WHERE } from "@/lib/auth/staff-link";
import { resolveCurrencyAndMarket } from "./finance-settings.service";
import type { StoreOverview } from "@/types/api/store-overview";

export interface StoreOverviewScope {
  /** The caller's own business, from the session. Null when they own none. */
  businessId: string | null;
  /** The one store the caller's account is linked to as staff, or null. */
  linkedStoreId: string | null;
  /**
   * False when the browser is acting as a non-OWNER PIN persona. Then no store
   * gets totals, and the totals queries are skipped.
   */
  includeTotals: boolean;
}

/** Trimmed text, or null when it is missing, "" or only whitespace. */
function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * What the Your Stores cards show beyond the bare store row: storefront
 * branding, the slogan, the store's currency and market, and (for the owner)
 * all-time totals. Returns one row per store the caller can see (their own
 * business's stores plus their linked-staff store), newest first.
 *
 * The number of queries does not grow with the number of stores: one
 * store.findMany, plus three groupBy calls when totals are included, all run
 * in parallel.
 *
 * Totals are only ever computed for the caller's own business. The groupBy
 * calls are scoped by `store: { businessId }`, where businessId comes from the
 * session, never from the client. A linked-staff store belongs to another
 * business, so it gets its branding, currency and market but `stats: null`.
 *
 * Nothing is created here. A store with no storefront row yet gets null
 * branding and a null tagline.
 */
export async function getStoreOverviews({
  businessId,
  linkedStoreId,
  includeTotals,
}: StoreOverviewScope): Promise<StoreOverview[]> {
  const visible = [
    ...(businessId ? [{ businessId }] : []),
    ...(linkedStoreId ? [{ id: linkedStoreId }] : []),
  ];
  if (visible.length === 0) return [];

  // One OR query, so a store that is both owned and staff-linked (an ownership
  // transfer to a former staffer) comes back once.
  const storesPromise = prisma.store.findMany({
    where: { OR: visible },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessId: true,
      syncFinanceWithBusiness: true,
      financeSettings: { select: { currency: true, market: true } },
      business: { select: { financeSettings: { select: { currency: true, market: true } } } },
      storefront: {
        select: { tagline: true, logoUrl: true, heroImageUrl: true, themeColor: true },
      },
    },
  });

  const totalsPromise =
    includeTotals && businessId
      ? Promise.all([
          // Revenue as the Dashboard, Finance and Owner summaries define it:
          // Σ total over orders not CANCELLED/HELD, with no payment-status
          // filter and no refund deduction. Here it covers all time.
          prisma.order.groupBy({
            by: ["storeId"],
            where: { store: { businessId }, status: { notIn: NON_REVENUE_STATUSES } },
            _sum: { total: true },
          }),
          prisma.customer.groupBy({
            by: ["storeId"],
            where: { store: { businessId } },
            _count: { _all: true },
          }),
          prisma.staffMember.groupBy({
            by: ["storeId"],
            where: { store: { businessId }, ...ACTIVE_STAFF_WHERE },
            _count: { _all: true },
          }),
        ])
      : null;

  const [stores, totals] = await Promise.all([storesPromise, totalsPromise]);

  const revenueBy = new Map(
    (totals?.[0] ?? []).map((row) => [
      row.storeId,
      Math.round(Number(row._sum.total ?? 0) * 100) / 100,
    ])
  );
  const customersBy = new Map((totals?.[1] ?? []).map((row) => [row.storeId, row._count._all]));
  const staffBy = new Map((totals?.[2] ?? []).map((row) => [row.storeId, row._count._all]));

  return stores.map((store) => {
    // Same rule as getFinanceSettings: a store synced to its business reads the
    // business's row, even when it also has its own row.
    const { currency, market } = resolveCurrencyAndMarket(
      store.syncFinanceWithBusiness ? store.business.financeSettings : store.financeSettings
    );
    const owned = totals !== null && store.businessId === businessId;

    return {
      storeId: store.id,
      tagline: nonBlank(store.storefront?.tagline),
      logoUrl: nonBlank(store.storefront?.logoUrl),
      coverUrl: nonBlank(store.storefront?.heroImageUrl),
      themeColor: store.storefront?.themeColor ?? null,
      currency,
      market,
      stats: owned
        ? {
            revenue: revenueBy.get(store.id) ?? 0,
            customerCount: customersBy.get(store.id) ?? 0,
            staffCount: staffBy.get(store.id) ?? 0,
          }
        : null,
    };
  });
}
