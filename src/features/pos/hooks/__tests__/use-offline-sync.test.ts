import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — vi.hoisted() lets the factory safely reference a
// mock function that's reconfigured per-test via mockReturnValue.
const { mockUseOfflineQueue, mockUseOfflineTableQueue, mockUseOfflineProductionQueue, network } =
  vi.hoisted(() => ({
    mockUseOfflineQueue: vi.fn(),
    mockUseOfflineTableQueue: vi.fn(),
    mockUseOfflineProductionQueue: vi.fn(),
    // Captured `useOnlineRecovery` callback, so a test can drive the
    // offline -> online transition directly.
    network: { onRecovered: null as null | (() => void) },
  }));

vi.mock("../use-offline-queue", () => ({
  useOfflineQueue: mockUseOfflineQueue,
}));

vi.mock("../use-offline-table-queue", () => ({
  useOfflineTableQueue: mockUseOfflineTableQueue,
}));

vi.mock("../use-offline-production-queue", () => ({
  useOfflineProductionQueue: mockUseOfflineProductionQueue,
}));

// The hook no longer listens for the `window` "online" event — that event
// tracks the network interface rather than reachability, which is the whole
// reason it was replaced (see use-offline-sync.ts). Reconnect now arrives via
// useOnlineRecovery, driven by the probe in src/lib/pwa/reachability.ts, so
// these tests trigger that callback instead of dispatching a DOM event.
vi.mock("@/hooks/use-network-status", () => ({
  useOnlineStatus: () => true,
  useOnlineRecovery: (onRecovered: () => void) => {
    network.onRecovered = onRecovered;
  },
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
  network.onRecovered = null;
  mockUseOfflineQueue.mockReturnValue(writeQueue());
  mockUseOfflineTableQueue.mockReturnValue({
    pendingCount: 0,
    isSyncing: false,
    syncQueue: vi.fn().mockResolvedValue(undefined),
    refreshCount: vi.fn(),
  });
  mockUseOfflineProductionQueue.mockReturnValue(writeQueue());
});

/** A sale / production queue hook's return value. */
function writeQueue(overrides: Record<string, unknown> = {}) {
  return {
    entries: [],
    pendingCount: 0,
    attentionCount: 0,
    needsSignIn: false,
    isSyncing: false,
    syncQueue: vi.fn().mockResolvedValue(undefined),
    refreshCount: vi.fn(),
    retryParked: vi.fn().mockResolvedValue(undefined),
    discardEntry: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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
      network.onRecovered?.();
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
      network.onRecovered?.();
      network.onRecovered?.();
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

  it("syncNow flushes the table-status and production queues alongside orders", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
    const orderSync = vi.fn().mockResolvedValue(undefined);
    const tableSync = vi.fn().mockResolvedValue(undefined);
    const productionSync = vi.fn().mockResolvedValue(undefined);
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0,
      isSyncing: false,
      syncQueue: orderSync,
      refreshCount: vi.fn(),
    });
    mockUseOfflineTableQueue.mockReturnValue({
      pendingCount: 1,
      isSyncing: false,
      syncQueue: tableSync,
      refreshCount: vi.fn(),
    });
    mockUseOfflineProductionQueue.mockReturnValue({
      pendingCount: 1,
      isSyncing: false,
      syncQueue: productionSync,
      refreshCount: vi.fn(),
    });

    const { result } = renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    // pendingCount aggregates across all three queues.
    expect(result.current.pendingCount).toBe(2);

    await act(async () => {
      await result.current.syncNow();
    });

    expect(orderSync).toHaveBeenCalled();
    expect(tableSync).toHaveBeenCalled();
    expect(productionSync).toHaveBeenCalled();
  });
  it("adds up what needs attention and whether a sign-in is needed", () => {
    mockUseOfflineQueue.mockReturnValue(writeQueue({ attentionCount: 2, needsSignIn: true }));
    mockUseOfflineProductionQueue.mockReturnValue(writeQueue({ attentionCount: 1 }));
    const qc = new QueryClient();

    const { result } = renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    expect(result.current.attentionCount).toBe(3);
    expect(result.current.needsSignIn).toBe(true);
  });

  it("retry puts both queues' parked entries back; discard goes to the right queue", async () => {
    const sales = writeQueue();
    const production = writeQueue();
    mockUseOfflineQueue.mockReturnValue(sales);
    mockUseOfflineProductionQueue.mockReturnValue(production);
    const qc = new QueryClient();

    const { result } = renderHook(() => useOfflineSync("store-1"), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.retryParked();
      await result.current.discardQueued("sale", "s1");
      await result.current.discardQueued("production", "p1");
    });

    expect(sales.retryParked).toHaveBeenCalledTimes(1);
    expect(production.retryParked).toHaveBeenCalledTimes(1);
    expect(sales.discardEntry).toHaveBeenCalledWith("s1");
    expect(production.discardEntry).toHaveBeenCalledWith("p1");
  });
});
