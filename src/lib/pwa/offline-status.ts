/**
 * The client half of the offline-readiness contract with `public/sw.js`.
 *
 * "Offline Mode is on" and "this screen opens without a connection" are two
 * different claims, and until now the app only ever made the first one. This
 * module is what lets the UI make the second one honestly: it names the pages
 * that are supposed to work offline, asks the service worker which of them are
 * actually on the device, and asks it to fetch the ones that aren't.
 *
 * Every message type here has a matching handler in `public/sw.js` — keep the
 * two in step.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { OFFLINE_DATA_DOMAINS, matchesOfflineDomain } from "./query-persister";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * A dashboard section that should open without a connection, and the mirrored
 * data domains it reads.
 *
 * `domains: []` is a real, deliberate state — the page's shell is worth having
 * on the device (it is where a cold offline launch often lands) but none of its
 * figures are mirrored, so it will render its empty/error states. The panel
 * says exactly that rather than showing a green tick over a blank dashboard.
 *
 * Everything absent from this list — finance, storefront editor, billing,
 * admin — is not offline-capable and is not claimed to be.
 */
export interface OfflinePage {
  /** Stable id; also the i18n key under `common.pwa.page.*`. */
  readonly id: string;
  /** Path suffix under `/store/{storeId}`. */
  readonly section: string;
  /** Ids from `OFFLINE_DATA_DOMAINS` that this page needs to be useful. */
  readonly domains: readonly string[];
}

export const OFFLINE_PAGES: readonly OfflinePage[] = [
  { id: "pos", section: "/pos", domains: ["menu", "cashiers", "kdsSettings"] },
  { id: "orders", section: "/pos/orders", domains: ["orders"] },
  { id: "kds", section: "/pos/kds", domains: ["orders", "kdsSettings"] },
  { id: "data", section: "/data", domains: ["materials"] },
  { id: "staff", section: "/staff", domains: ["staff"] },
  { id: "schedule", section: "/schedule", domains: ["schedules"] },
  { id: "dashboard", section: "/dashboard", domains: [] },
];

export function offlinePagePath(storeId: string, page: OfflinePage): string {
  return `/store/${storeId}${page.section}`;
}

export function offlinePagePaths(storeId: string): string[] {
  if (!storeId) return [];
  return OFFLINE_PAGES.map((page) => offlinePagePath(storeId, page));
}

// ---------------------------------------------------------------------------
// Service worker bridge
// ---------------------------------------------------------------------------

export interface ServiceWorkerOfflineStatus {
  /** Cache generation the worker is running, e.g. `epidom-v5`. */
  cacheVersion: string;
  /**
   * `true` on localhost, where the worker deliberately serves nothing from
   * cache so it can't fight HMR. Offline genuinely does not work in that mode,
   * and the panel has to say so — testing offline against `pnpm dev` and
   * concluding the feature is broken is the single easiest way to misread this.
   */
  devPassthrough: boolean;
  /** Pathnames currently held in the offline app-shell cache. */
  shellPaths: string[];
  /** Entries in the static-asset cache (JS/CSS/font/image). */
  assetCount: number;
  offlinePageReady: boolean;
}

export interface WarmShellResult {
  path: string;
  ok: boolean;
  /** `dev` | `offline` | `auth` | `storage` | `rejected` | `http-<status>` */
  reason?: string;
  /** `_next/static` bundles cached for this page. */
  assets?: number;
}

export interface WarmShellReply {
  devPassthrough: boolean;
  results: WarmShellResult[];
}

/** Whether a worker is installed *and* driving this page's requests. */
export function isServiceWorkerControlling(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    !!navigator.serviceWorker.controller
  );
}

/**
 * Round-trips one message to the active worker over a MessageChannel.
 *
 * Resolves `null` rather than rejecting on every failure path — no worker yet,
 * a worker that never answers, a `postMessage` that throws. Callers render
 * "unknown" from that, which is the truthful reading and keeps a diagnostics
 * panel from being the thing that throws.
 *
 * The `controller` check is the load-bearing one: a freshly registered worker
 * controls nothing until the next navigation, and asking it about caches it is
 * not yet serving from would report a readiness the page does not have.
 */
async function askServiceWorker<T>(message: object, timeoutMs: number): Promise<T | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return null;

  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.onmessage = null;
      channel.port1.close();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent) => finish(event.data as T);

    try {
      controller.postMessage(message, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

export function getServiceWorkerOfflineStatus(): Promise<ServiceWorkerOfflineStatus | null> {
  return askServiceWorker<ServiceWorkerOfflineStatus>({ type: "GET_OFFLINE_STATUS" }, 8_000);
}

/**
 * Asks the worker to fetch and store the given pages (and the JS bundles they
 * boot from) for offline use.
 *
 * The long timeout is not padding: each entry is a full server-rendered
 * dashboard document plus its chunks, fetched one at a time over whatever
 * connection the device has left.
 */
export function warmOfflineShell(paths: string[]): Promise<WarmShellReply | null> {
  if (paths.length === 0) return Promise.resolve({ devPassthrough: false, results: [] });
  return askServiceWorker<WarmShellReply>({ type: "WARM_SHELL", paths }, 90_000);
}

// ---------------------------------------------------------------------------
// Mirrored data
// ---------------------------------------------------------------------------

export interface OfflineDomainStatus {
  id: string;
  /** At least one query for this store holds usable cached data. */
  ready: boolean;
  /** Rows across every cached query for this domain (best effort — see below). */
  itemCount: number;
  /** Newest successful fetch across those queries. */
  updatedAt: Date | null;
  /** Cached, but the last refetch failed — the figures are last-known-good. */
  stale: boolean;
}

/**
 * Rows in a cached query payload.
 *
 * Endpoints in this app return an array, `{ data: [...] }`, or a paginated
 * `{ items: [...] }` depending on age, and a couple return a single settings
 * object. Rather than special-casing seven query shapes for a diagnostics
 * count, probe the common containers and fall back to "1 record" for a
 * non-empty object — an approximate count is worth far more here than a blank.
 */
export function countCachedRecords(data: unknown): number {
  if (data == null) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data !== "object") return 1;

  for (const key of ["items", "data", "orders", "results", "records"]) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value.length;
  }
  return Object.keys(data as Record<string, unknown>).length > 0 ? 1 : 0;
}

/**
 * What is mirrored for `storeId` right now, read straight from the live query
 * cache — which is the same cache the persister dehydrates to IndexedDB, so
 * "ready" here means "would still be here after a reload with no network".
 */
export function collectOfflineDataStatus(
  queryClient: QueryClient,
  storeId: string
): OfflineDomainStatus[] {
  const queries = queryClient.getQueryCache().getAll();

  return OFFLINE_DATA_DOMAINS.map((domain) => {
    const status: OfflineDomainStatus = {
      id: domain.id,
      ready: false,
      itemCount: 0,
      updatedAt: null,
      stale: false,
    };
    if (!storeId) return status;

    for (const query of queries) {
      if (!matchesOfflineDomain(query.queryKey as QueryKey, domain, storeId)) continue;
      const state = query.state;
      if (state.data === undefined) continue;

      status.ready = true;
      status.itemCount += countCachedRecords(state.data);
      if (state.dataUpdatedAt) {
        const updatedAt = new Date(state.dataUpdatedAt);
        if (!status.updatedAt || updatedAt > status.updatedAt) status.updatedAt = updatedAt;
      }
      // Data present *and* the last fetch errored: the mirror is usable but
      // known to be behind, which is a different thing to report than "ready".
      if (state.status === "error") status.stale = true;
    }

    return status;
  });
}
