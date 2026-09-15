/**
 * Proactive offline priming — the fetch side of the offline-mirroring contract.
 *
 * Historically, `primeOfflineData` (use-offline-mode.ts) only ever
 * `refetchQueries`'d whatever was *already* in the React Query cache — so a
 * domain whose screen nobody had opened yet this session could never be
 * mirrored, no matter how many times "Save pages for offline" was pressed.
 * This registry is what fixes that: one entry per offline-mirrored domain,
 * each able to fetch its own default view from a cold start, independent of
 * whether any component has mounted yet.
 *
 * Every `buildKey` here must produce the exact queryKey the *real* screen's
 * `useQuery` would produce on its own first render — otherwise the prefetched
 * entry sits in the cache under a key the live component never asks for, and
 * priming silently does nothing useful. For the filtered/paginated domains
 * (materials, recipes, products, suppliers) that means replicating each
 * screen's own default filter object; `normalizeFilters` (query-key-helpers)
 * strips undefined/null/"" fields and sorts keys, so only the *surviving*
 * values need to match — not field order or which optional keys were passed.
 *
 * Keep this in step with `OFFLINE_DATA_DOMAINS` (query-persister.ts) and
 * `OFFLINE_PAGES` (offline-status.ts): a domain only needs an entry here if
 * something should proactively prime it (vs. staying opportunistic).
 */

import type { QueryKey } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import { todayLocalISO } from "@/lib/utils/date-range";
import { addDaysToDateKey } from "@/lib/attendance/business-date";

export interface OfflinePrefetchEntry {
  /** Diagnostic id only — several entries may share one OFFLINE_DATA_DOMAINS id (e.g. "products" and its CUSTOM-line sibling). */
  id: string;
  buildKey: (storeId: string) => QueryKey;
  fetch: (storeId: string) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Shared defaults — duplicated from each screen's own default filter/range
// state, on purpose (same convention as the existing SUPPLIER_PREFETCH_FILTERS
// constant in materials-section.tsx: "must match" is enforced by comment and
// by the offline-status test suite, not by a shared import, so a low-level
// pwa/ module never has to reach into feature-owned UI component files).
// ---------------------------------------------------------------------------

const MATERIALS_DEFAULT_FILTERS = {
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 50,
};

const RECIPES_DEFAULT_FILTERS = {
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 100,
};

const PRODUCTS_STANDARD_DEFAULT_FILTERS = {
  stock: "all",
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 20,
  productLine: "STANDARD",
};

const PRODUCTS_CUSTOM_DEFAULT_FILTERS = {
  sortBy: "createdAt",
  sortOrder: "desc",
  productLine: "CUSTOM",
};

const SUPPLIERS_DEFAULT_FILTERS = {
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 20,
};

function toQueryParams(filters: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  }
  return params;
}

/** Monday of `dateKey`'s week, UTC. Mirrors the private helper in schedule-client.tsx. */
function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // days since Monday
  return addDaysToDateKey(dateKey, -offset);
}

/** Current week (Mon-Sun) — Schedule's own default range on first render. */
function currentWeekRange(): { from: string; to: string } {
  const from = mondayOf(todayLocalISO());
  return { from, to: addDaysToDateKey(from, 6) };
}

export const OFFLINE_PREFETCH_ENTRIES: readonly OfflinePrefetchEntry[] = [
  // ---- POS core (existing domains) ----
  {
    id: "menu",
    buildKey: (storeId) => ["pos", "menu", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/pos/menu`),
  },
  {
    id: "orders",
    buildKey: (storeId) => ["pos", "orders", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/pos/orders`),
  },
  {
    id: "cashiers",
    // use-pos-staff-list.ts unwraps { staff } -> staff before caching, so the
    // prefetched entry must be the bare array too, or a live mount (which
    // always goes through that same unwrap) would never see it as a hit.
    buildKey: (storeId) => ["pos", "staff-list", storeId],
    fetch: (storeId) =>
      apiClient
        .get<{ staff: unknown[] }>(`/stores/${storeId}/staff`)
        .then((res) => res.staff),
  },
  {
    id: "kdsSettings",
    buildKey: (storeId) => ["pos", "kds-settings", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/pos/kds/settings`),
  },
  {
    id: "materials",
    buildKey: (storeId) => [
      "materials",
      storeId,
      "list",
      normalizeFilters(MATERIALS_DEFAULT_FILTERS),
    ],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/materials`, toQueryParams(MATERIALS_DEFAULT_FILTERS)),
  },
  {
    id: "schedules",
    buildKey: (storeId) => {
      const { from, to } = currentWeekRange();
      return ["staff-schedules", storeId, from, to];
    },
    fetch: (storeId) => {
      const { from, to } = currentWeekRange();
      return apiClient.get(`/stores/${storeId}/staff-schedules`, { from, to });
    },
  },
  {
    id: "staff",
    // staff-client.tsx keeps the { staff } wrapper as-is — do NOT unwrap here.
    buildKey: (storeId) => ["staff", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/staff`),
  },

  // ---- Data / Stock reference catalogs ----
  {
    id: "recipes",
    buildKey: (storeId) => [
      "recipes",
      storeId,
      "list",
      normalizeFilters(RECIPES_DEFAULT_FILTERS),
    ],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/recipes`, toQueryParams(RECIPES_DEFAULT_FILTERS)),
  },
  {
    id: "recipeDemand",
    buildKey: (storeId) => ["recipe-demand", storeId],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/recipes/demand`).then((data) => data ?? []),
  },
  {
    id: "products",
    buildKey: (storeId) => [
      "products",
      storeId,
      "list",
      normalizeFilters(PRODUCTS_STANDARD_DEFAULT_FILTERS),
    ],
    fetch: (storeId) =>
      apiClient.get(
        `/stores/${storeId}/products`,
        toQueryParams(PRODUCTS_STANDARD_DEFAULT_FILTERS)
      ),
  },
  {
    id: "customProducts",
    buildKey: (storeId) => [
      "products",
      storeId,
      "list",
      normalizeFilters(PRODUCTS_CUSTOM_DEFAULT_FILTERS),
    ],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/products`, toQueryParams(PRODUCTS_CUSTOM_DEFAULT_FILTERS)),
  },
  {
    id: "storefrontItemsLinked",
    buildKey: (storeId) => ["storefront-items-linked", storeId],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/storefront/items`).then((data) => data ?? []),
  },
  {
    id: "suppliers",
    buildKey: (storeId) => [
      "suppliers",
      storeId,
      "list",
      normalizeFilters(SUPPLIERS_DEFAULT_FILTERS),
    ],
    fetch: (storeId) =>
      apiClient.get(`/stores/${storeId}/suppliers`, toQueryParams(SUPPLIERS_DEFAULT_FILTERS)),
  },

  // ---- Menu / Storefront editor ----
  {
    id: "storefront",
    buildKey: (storeId) => ["storefront", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/storefront`),
  },
  {
    id: "customProductsSettings",
    buildKey: (storeId) => ["custom-products", "settings", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/custom-products/settings`),
  },

  // ---- Tables ----
  {
    id: "tables",
    buildKey: (storeId) => ["tables", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/tables`),
  },

  // ---- Production ----
  {
    id: "productionSettings",
    buildKey: (storeId) => ["production", "settings", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/production/settings`),
  },

  // ---- Schedule (secondary reference list) ----
  {
    id: "scheduleShifts",
    buildKey: (storeId) => ["schedule-shifts", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/schedule-shifts`),
  },

  // ---- Alerts ----
  {
    id: "alerts",
    buildKey: (storeId) => ["alerts", "list", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/alerts`),
  },

  // ---- Profile (finance/receipt settings only — profile itself is
  // user-scoped, not store-scoped, and doesn't fit this store-keyed registry) ----
  {
    id: "financeSettings",
    buildKey: (storeId) => ["finance-settings", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/finance/settings`),
  },
  {
    id: "receiptSettings",
    buildKey: (storeId) => ["receipt-settings", storeId],
    fetch: (storeId) => apiClient.get(`/stores/${storeId}/receipt-settings`),
  },
];
