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

// Domains mirrored for offline use: POS core (menu, live order/KDS queue,
// cashier staff roster, KDS toggle) plus a read-only inventory/staff
// reference slice (materials, staff roster, staff schedules). Everything
// else — finance, admin/capacity analytics, marketing/storefront editor,
// order history & reporting — is intentionally excluded: large, changes
// constantly, and low-value to a cashier with no signal.
const PERSISTED_QUERY_KEY_PREFIXES: readonly (readonly string[])[] = [
  ["pos", "menu"],
  ["pos", "orders"],
  ["pos", "staff-list"],
  ["pos", "kds-settings"],
  ["materials"],
  ["staff-schedules"],
  ["staff"],
];

/** Whether a query's cached data should survive a reload/offline session. */
export function isOfflinePersistedQueryKey(queryKey: QueryKey): boolean {
  return PERSISTED_QUERY_KEY_PREFIXES.some((prefix) =>
    prefix.every((segment, i) => queryKey[i] === segment)
  );
}
