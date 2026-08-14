import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  OFFLINE_PAGES,
  collectOfflineDataStatus,
  countCachedRecords,
  offlinePagePath,
  offlinePagePaths,
} from "../offline-status";
import { isOfflinePersistedQueryKey, matchesOfflineDomain } from "../query-persister";

function domain(id: string) {
  const found = collectOfflineDataStatus(new QueryClient(), "store-1").find((d) => d.id === id);
  if (!found) throw new Error(`unknown domain ${id}`);
  return found;
}

describe("offline page registry", () => {
  it("builds store-scoped paths the service worker will accept as warmable", () => {
    const paths = offlinePagePaths("store-1");

    expect(paths).toHaveLength(OFFLINE_PAGES.length);
    // isWarmablePath in public/sw.js rejects anything outside /store/, so a
    // drift here would silently make every warm-up a no-op.
    expect(paths.every((path) => path.startsWith("/store/store-1/"))).toBe(true);
    expect(paths).toContain("/store/store-1/pos");
    expect(paths).toContain("/store/store-1/pos/orders");
  });

  it("returns nothing without a store, rather than a path with an empty segment", () => {
    expect(offlinePagePaths("")).toEqual([]);
  });

  it("only claims pages whose data domains are actually mirrored", () => {
    for (const page of OFFLINE_PAGES) {
      for (const id of page.domains) {
        expect(domain(id).id).toBe(id);
      }
    }
  });

  it("keeps the /go launcher's destination shape — never a query string", () => {
    // sw.js refuses to warm a URL carrying a search string (isShellCacheable),
    // because one filtered view would otherwise be cached as "the page".
    expect(offlinePagePaths("store-1").some((path) => path.includes("?"))).toBe(false);
    expect(offlinePagePath("store-1", OFFLINE_PAGES[0])).toBe("/store/store-1/pos");
  });
});

describe("countCachedRecords", () => {
  it("counts arrays and the common envelope shapes", () => {
    expect(countCachedRecords([1, 2, 3])).toBe(3);
    expect(countCachedRecords({ items: [1, 2] })).toBe(2);
    expect(countCachedRecords({ data: [1] })).toBe(1);
    expect(countCachedRecords({ orders: [] })).toBe(0);
  });

  it("treats a settings object as one record rather than zero", () => {
    expect(countCachedRecords({ soundEnabled: true, columns: 3 })).toBe(1);
  });

  it("reports nothing for absent data", () => {
    expect(countCachedRecords(null)).toBe(0);
    expect(countCachedRecords(undefined)).toBe(0);
    expect(countCachedRecords({})).toBe(0);
  });
});

describe("collectOfflineDataStatus", () => {
  it("reports a mirrored domain as ready, with its record count and stamp", () => {
    const client = new QueryClient();
    client.setQueryData(["pos", "menu", "store-1"], [{ id: "a" }, { id: "b" }]);

    const menu = collectOfflineDataStatus(client, "store-1").find((d) => d.id === "menu")!;

    expect(menu.ready).toBe(true);
    expect(menu.itemCount).toBe(2);
    expect(menu.updatedAt).toBeInstanceOf(Date);
    expect(menu.stale).toBe(false);
  });

  it("never counts another outlet's mirror as this store's", () => {
    const client = new QueryClient();
    client.setQueryData(["pos", "menu", "store-2"], [{ id: "a" }]);
    client.setQueryData(["materials", "store-2", "list"], [{ id: "m" }]);

    const status = collectOfflineDataStatus(client, "store-1");

    expect(status.every((d) => !d.ready)).toBe(true);
  });

  it("sums every cached query inside one domain", () => {
    const client = new QueryClient();
    client.setQueryData(["materials", "store-1", "list"], [{ id: "m1" }, { id: "m2" }]);
    client.setQueryData(["materials", "store-1", "low-stock"], [{ id: "m1" }]);

    const materials = collectOfflineDataStatus(client, "store-1").find(
      (d) => d.id === "materials"
    )!;

    expect(materials.ready).toBe(true);
    expect(materials.itemCount).toBe(3);
  });

  it("reports every domain as not ready when nothing has been fetched", () => {
    const status = collectOfflineDataStatus(new QueryClient(), "store-1");

    expect(status.length).toBeGreaterThan(0);
    expect(status.every((d) => !d.ready && d.itemCount === 0 && d.updatedAt === null)).toBe(true);
  });

  it("reports nothing without a store id", () => {
    const client = new QueryClient();
    client.setQueryData(["pos", "menu", "store-1"], [{ id: "a" }]);

    expect(collectOfflineDataStatus(client, "").every((d) => !d.ready)).toBe(true);
  });
});

describe("persistence and status agree on what is mirrored", () => {
  it("every key the persister keeps is attributable to a reported domain", () => {
    const keys = [
      ["pos", "menu", "store-1"],
      ["pos", "orders", "store-1"],
      ["pos", "staff-list", "store-1"],
      ["pos", "kds-settings", "store-1"],
      ["materials", "store-1", "list"],
      ["staff-schedules", "store-1", "2026-08-14", "2026-08-20"],
      ["staff", "store-1"],
    ];

    for (const key of keys) {
      expect(isOfflinePersistedQueryKey(key)).toBe(true);
      const client = new QueryClient();
      client.setQueryData(key, [{ id: "x" }]);
      expect(collectOfflineDataStatus(client, "store-1").some((d) => d.ready)).toBe(true);
    }
  });

  it("does not persist, or report, anything outside the mirrored set", () => {
    expect(isOfflinePersistedQueryKey(["finance", "store-1"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["storefront", "store-1"])).toBe(false);
  });

  it("refuses to attribute a key that stops before the store segment", () => {
    // ["materials"] alone is used for broad invalidation; counting it would
    // credit every outlet with data none of them necessarily have.
    expect(
      matchesOfflineDomain(
        ["materials"],
        { id: "materials", prefix: ["materials"], storeIdIndex: 1 },
        "store-1"
      )
    ).toBe(false);
  });
});
