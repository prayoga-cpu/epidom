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

// Domains mirrored for offline use: POS core (menu, live order/KDS queue,
// cashier staff roster, KDS toggle) plus a read-only inventory/staff
// reference slice (materials, staff roster, staff schedules). Everything
// else — finance, admin/capacity analytics, marketing/storefront editor,
// order history & reporting — is intentionally excluded: large, changes
// constantly, and low-value to a cashier with no signal.
export const OFFLINE_DATA_DOMAINS: readonly OfflineDataDomain[] = [
  { id: "menu", prefix: ["pos", "menu"], storeIdIndex: 2 },
  { id: "orders", prefix: ["pos", "orders"], storeIdIndex: 2 },
  { id: "cashiers", prefix: ["pos", "staff-list"], storeIdIndex: 2 },
  { id: "kdsSettings", prefix: ["pos", "kds-settings"], storeIdIndex: 2 },
  { id: "materials", prefix: ["materials"], storeIdIndex: 1 },
  { id: "schedules", prefix: ["staff-schedules"], storeIdIndex: 1 },
  { id: "staff", prefix: ["staff"], storeIdIndex: 1 },
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
