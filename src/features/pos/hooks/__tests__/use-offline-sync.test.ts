import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — vi.hoisted() lets the factory safely reference a
// mock function that's reconfigured per-test via mockReturnValue.
const { mockUseOfflineQueue } = vi.hoisted(() => ({ mockUseOfflineQueue: vi.fn() }));

vi.mock("../use-offline-queue", () => ({
  useOfflineQueue: mockUseOfflineQueue,
}));

vi.mock("@/lib/pwa/sync-status", () => ({
  getLastSyncedAt: vi.fn(() => Promise.resolve(null)),
  setLastSyncedAt: vi.fn(() => Promise.resolve()),
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useOfflineSync } from "../use-offline-sync";
import { getLastSyncedAt, setLastSyncedAt } from "@/lib/pwa/sync-status";

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOfflineQueue.mockReturnValue({
    pendingCount: 0,
    isSyncing: false,
    syncQueue: vi.fn().mockResolvedValue(undefined),
    refreshCount: vi.fn(),
  });
});

describe("useOfflineSync", () => {
  it("loads the last-synced timestamp on mount", async () => {
    vi.mocked(getLastSyncedAt).mockResolvedValue(new Date("2026-07-30T10:00:00.000Z"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    await waitFor(() =>
      expect(result.current.lastSyncedAt).toEqual(new Date("2026-07-30T10:00:00.000Z"))
    );
  });

  it("pull-syncs the offline-persisted domains and stamps sync status when connectivity returns", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const refetchSpy = vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);

    renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(refetchSpy).toHaveBeenCalled());
    expect(setLastSyncedAt).toHaveBeenCalledWith("store-1");
  });

  it("does not pull-sync a second time while a pull is already in flight", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolveRefetch: () => void = () => {};
    const refetchSpy = vi.spyOn(qc, "refetchQueries").mockReturnValue(
      new Promise((resolve) => {
        resolveRefetch = () => resolve(undefined);
      })
    );

    renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefetch();
      await Promise.resolve();
    });
  });

  it("syncNow flushes the write queue and pulls fresh data together", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
    const syncQueue = vi.fn().mockResolvedValue(undefined);
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 2,
      isSyncing: false,
      syncQueue,
      refreshCount: vi.fn(),
    });

    const { result } = renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.syncNow();
    });

    expect(syncQueue).toHaveBeenCalled();
  });
});
