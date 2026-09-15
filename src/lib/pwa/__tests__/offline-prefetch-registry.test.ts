import { describe, it, expect, vi, afterEach } from "vitest";
import { OFFLINE_PREFETCH_ENTRIES } from "../offline-prefetch-registry";
import { isOfflinePersistedQueryKey } from "../query-persister";
import { apiClient } from "@/lib/api/client";

describe("OFFLINE_PREFETCH_ENTRIES", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("every entry's key would actually be persisted by the offline mirror", () => {
    // The whole point of proactive priming is to seed a cache entry the
    // persister will keep — an entry whose buildKey the domain allowlist
    // doesn't recognize would prefetch data that gets dropped on the next
    // dehydrate, silently wasting the request.
    for (const entry of OFFLINE_PREFETCH_ENTRIES) {
      const key = entry.buildKey("store-1");
      expect(isOfflinePersistedQueryKey(key), `entry "${entry.id}" -> ${JSON.stringify(key)}`).toBe(
        true
      );
    }
  });

  it("every entry's key is scoped to the store it was built for", () => {
    for (const entry of OFFLINE_PREFETCH_ENTRIES) {
      const keyA = JSON.stringify(entry.buildKey("store-a"));
      const keyB = JSON.stringify(entry.buildKey("store-b"));
      expect(keyA, `entry "${entry.id}" ignores storeId`).not.toBe(keyB);
    }
  });

  it("ids are unique so a duplicate entry can't silently shadow another", () => {
    const ids = OFFLINE_PREFETCH_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fetch() calls the same-shaped endpoint the key implies (menu domain)", async () => {
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({ categories: [] });
    const entry = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "menu")!;
    await entry.fetch("store-1");
    expect(spy).toHaveBeenCalledWith("/stores/store-1/pos/menu");
  });

  it("cashiers entry unwraps { staff } to the bare array, matching usePosStaffList's cache shape", async () => {
    const spy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ staff: [{ id: "s1", name: "A", isActive: true }] });
    const entry = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "cashiers")!;
    const result = await entry.fetch("store-1");
    expect(spy).toHaveBeenCalledWith("/stores/store-1/staff");
    expect(result).toEqual([{ id: "s1", name: "A", isActive: true }]);
  });

  it("staff entry keeps the { staff } wrapper, matching staff-client's cache shape", async () => {
    const payload = { staff: [{ id: "s1" }] };
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue(payload);
    const entry = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "staff")!;
    const result = await entry.fetch("store-1");
    expect(spy).toHaveBeenCalledWith("/stores/store-1/staff");
    expect(result).toEqual(payload);
  });

  it("products (STANDARD) and customProducts (CUSTOM) build distinct keys sharing the products domain", () => {
    const products = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "products")!;
    const custom = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "customProducts")!;
    const productsKey = products.buildKey("store-1");
    const customKey = custom.buildKey("store-1");

    expect(JSON.stringify(productsKey)).not.toBe(JSON.stringify(customKey));
    expect(isOfflinePersistedQueryKey(productsKey)).toBe(true);
    expect(isOfflinePersistedQueryKey(customKey)).toBe(true);
  });

  it("schedules entry requests a Monday-to-Sunday window", async () => {
    const spy = vi.spyOn(apiClient, "get").mockResolvedValue({ schedules: [] });
    const entry = OFFLINE_PREFETCH_ENTRIES.find((e) => e.id === "schedules")!;
    await entry.fetch("store-1");

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, params] = spy.mock.calls[0] as [string, { from: string; to: string }];
    expect(url).toBe("/stores/store-1/staff-schedules");
    const fromDay = new Date(`${params.from}T00:00:00Z`).getUTCDay();
    expect(fromDay).toBe(1); // Monday
    const spanDays =
      (new Date(`${params.to}T00:00:00Z`).getTime() - new Date(`${params.from}T00:00:00Z`).getTime()) /
      86_400_000;
    expect(spanDays).toBe(6); // Mon..Sun inclusive
  });
});
