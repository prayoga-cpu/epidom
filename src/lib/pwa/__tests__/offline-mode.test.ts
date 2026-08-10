import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
}));

import { isOfflineModeEnabled, setOfflineModeEnabled, getOfflineModeState } from "../offline-mode";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("offline-mode", () => {
  it("defaults to disabled for a store that has never set the flag", async () => {
    expect(await isOfflineModeEnabled("store-1")).toBe(false);
  });

  it("persists enabling and disabling", async () => {
    await setOfflineModeEnabled("store-1", true);
    expect(await isOfflineModeEnabled("store-1")).toBe(true);

    await setOfflineModeEnabled("store-1", false);
    expect(await isOfflineModeEnabled("store-1")).toBe(false);
  });

  it("keeps the flag namespaced per store", async () => {
    await setOfflineModeEnabled("store-1", true);
    expect(await isOfflineModeEnabled("store-2")).toBe(false);
  });

  it("distinguishes never-decided (null) from explicitly disabled (false)", async () => {
    expect(await getOfflineModeState("store-1")).toBeNull();

    await setOfflineModeEnabled("store-1", false);
    expect(await getOfflineModeState("store-1")).toBe(false);
    // isOfflineModeEnabled collapses both to false — only getOfflineModeState tells them apart
    expect(await isOfflineModeEnabled("store-1")).toBe(false);
  });
});
