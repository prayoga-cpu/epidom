import { get, set, del } from "idb-keyval";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { QueryKey } from "@tanstack/react-query";

const PERSIST_KEY = "epidom-query-cache";

// idb-keyval exposes get/set/del; the async persister expects a Web
// Storage-like getItem/setItem/removeItem interface (its own async variant —
// see @tanstack/query-async-storage-persister), so this adapts one to the
// other rather than pulling in a second IndexedDB wrapper.
const idbAsyncStorage = {
  getItem: (key: string) => get<string>(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

export const queryPersister = createAsyncStoragePersister({
  storage: idbAsyncStorage,
  key: PERSIST_KEY,
});

/**
 * One mirrored domain: a query-key prefix, plus the metadata the Offline &
 * Sync panel needs to report on it by name.
 *
 * `storeIdIndex` is where the store id sits inside the key — index 1 for a
 * single-segment prefix (`["materials", storeId, …]`), index 2 for the
 * two-segment POS ones (`["pos", "menu", storeId]`). Without it the panel
 * would count another outlet's mirrored menu as this one's, which on a
 * multi-outlet account reads as "ready for offline" when nothing of the sort
 * is on the device.
 */
export interface OfflineDataDomain {
  /** Stable id; also the i18n key under `common.pwa.data.*`. */
  readonly id: string;
  readonly prefix: readonly string[];
  readonly storeIdIndex: number;
}

// Domains mirrored for offline use. Started as POS-core-only (menu, live
// order/KDS queue, cashier staff roster, KDS toggle) plus a read-only
// inventory/staff reference slice; now covers every screen whose data is
// small, bounded, and safe to show last-known-good offline — catalog/
// reference data (materials, recipes, products, suppliers), editor shells
// (storefront/menu), the floor plan (tables), and static per-store settings
// (production, schedule shifts, alerts, finance/receipt settings).
//
// Deliberately still excluded: Finance Reports, order/production history,
// Billing, Custom Development, and dashboard analytics. Each fails a
// different bar — Finance's queryKeys are combinatorial across
// date-range/staff/channel/payment-method filters (mirroring would
// opportunistically snowball every combo a user happened to view, not a
// bounded "last 30 days"), order/production history and dashboard analytics
// are unbounded live aggregates over the store's entire history with no
// server-side cap, and Billing/Custom Development are either Stripe-live or
// low-value enough that a stale mirror isn't worth the complexity. See
// offline-status.ts's OFFLINE_PAGES for the page-level shell-only treatment
// these get instead.
export const OFFLINE_DATA_DOMAINS: readonly OfflineDataDomain[] = [
  { id: "menu", prefix: ["pos", "menu"], storeIdIndex: 2 },
  { id: "orders", prefix: ["pos", "orders"], storeIdIndex: 2 },
  { id: "cashiers", prefix: ["pos", "staff-list"], storeIdIndex: 2 },
  { id: "kdsSettings", prefix: ["pos", "kds-settings"], storeIdIndex: 2 },
  { id: "materials", prefix: ["materials"], storeIdIndex: 1 },
  { id: "schedules", prefix: ["staff-schedules"], storeIdIndex: 1 },
  { id: "staff", prefix: ["staff"], storeIdIndex: 1 },
  { id: "recipes", prefix: ["recipes"], storeIdIndex: 1 },
  { id: "recipeDemand", prefix: ["recipe-demand"], storeIdIndex: 1 },
  { id: "products", prefix: ["products"], storeIdIndex: 1 },
  { id: "storefrontItemsLinked", prefix: ["storefront-items-linked"], storeIdIndex: 1 },
  { id: "suppliers", prefix: ["suppliers"], storeIdIndex: 1 },
  { id: "storefront", prefix: ["storefront"], storeIdIndex: 1 },
  { id: "customProductsSettings", prefix: ["custom-products", "settings"], storeIdIndex: 2 },
  { id: "tables", prefix: ["tables"], storeIdIndex: 1 },
  { id: "productionSettings", prefix: ["production", "settings"], storeIdIndex: 2 },
  { id: "scheduleShifts", prefix: ["schedule-shifts"], storeIdIndex: 1 },
  { id: "alerts", prefix: ["alerts", "list"], storeIdIndex: 2 },
  { id: "financeSettings", prefix: ["finance-settings"], storeIdIndex: 1 },
  { id: "receiptSettings", prefix: ["receipt-settings"], storeIdIndex: 1 },
];

/** Whether a query's cached data should survive a reload/offline session. */
export function isOfflinePersistedQueryKey(queryKey: QueryKey): boolean {
  return OFFLINE_DATA_DOMAINS.some((domain) =>
    domain.prefix.every((segment, i) => queryKey[i] === segment)
  );
}

/** Whether `queryKey` belongs to `domain` *and* to this store. */
export function matchesOfflineDomain(
  queryKey: QueryKey,
  domain: OfflineDataDomain,
  storeId: string
): boolean {
  if (!domain.prefix.every((segment, i) => queryKey[i] === segment)) return false;
  // A key that stops before the store segment (a global list, or a partial key
  // used only for invalidation) can't be attributed to one outlet, so it is
  // deliberately not counted for any of them.
  return queryKey[domain.storeIdIndex] === storeId;
}
