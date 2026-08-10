import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
}));

import { getLastSyncedAt, setLastSyncedAt } from "../sync-status";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("sync-status", () => {
  it("returns null when a store has never synced", async () => {
    expect(await getLastSyncedAt("store-1")).toBeNull();
  });

  it("round-trips a timestamp through the ISO string it's stored as", async () => {
    const at = new Date("2026-07-30T15:45:00.000Z");
    await setLastSyncedAt("store-1", at);

    const result = await getLastSyncedAt("store-1");
    expect(result).toEqual(at);
  });

  it("keeps timestamps namespaced per store — one store's sync doesn't affect another's", async () => {
    await setLastSyncedAt("store-1", new Date("2026-07-30T10:00:00.000Z"));
    await setLastSyncedAt("store-2", new Date("2026-07-31T10:00:00.000Z"));

    expect(await getLastSyncedAt("store-1")).toEqual(new Date("2026-07-30T10:00:00.000Z"));
    expect(await getLastSyncedAt("store-2")).toEqual(new Date("2026-07-31T10:00:00.000Z"));
  });

  it("defaults to the current time when no date is given", async () => {
    const before = Date.now();
    await setLastSyncedAt("store-1");
    const after = Date.now();

    const result = await getLastSyncedAt("store-1");
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThanOrEqual(before);
    expect(result!.getTime()).toBeLessThanOrEqual(after);
  });
});
