import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueue } = vi.hoisted(() => ({
  mockQueue: {
    listTableQueue: vi.fn(),
    removeFromTableQueue: vi.fn(),
    incrementTableQueueAttempts: vi.fn(),
    tableQueueSize: vi.fn(),
  },
}));

vi.mock("@/lib/pwa/offline-table-queue", () => mockQueue);

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/pwa/sync-status", () => ({
  setLastSyncedAt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { toast } from "sonner";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { useOfflineTableQueue } from "../use-offline-table-queue";

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "q1",
    storeId: "store-1",
    tableId: "t1",
    status: "OCCUPIED",
    expectedStatus: "AVAILABLE",
    queuedAt: "2026-09-15T00:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueue.tableQueueSize.mockResolvedValue(0);
  mockQueue.listTableQueue.mockResolvedValue([]);
});

describe("useOfflineTableQueue", () => {
  it("replays a queued status change and removes it on success", async () => {
    mockQueue.listTableQueue.mockResolvedValue([entry()]);
    const patchSpy = vi.spyOn(apiClient, "patch").mockResolvedValue({});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineTableQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(patchSpy).toHaveBeenCalledWith("/stores/store-1/tables/t1", {
      status: "OCCUPIED",
      expectedStatus: "AVAILABLE",
    });
    expect(mockQueue.removeFromTableQueue).toHaveBeenCalledWith("q1");
    expect(mockQueue.incrementTableQueueAttempts).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("drops a conflicted entry (409) instead of retrying it", async () => {
    mockQueue.listTableQueue.mockResolvedValue([entry()]);
    vi.spyOn(apiClient, "patch").mockRejectedValue(
      new ApiClientError({ success: false, error: { code: "CONFLICT", message: "stale" } } as any, 409)
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useOfflineTableQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    // Conflict is final — dropped, not retried, and the real state is
    // re-fetched instead of being blindly overwritten again.
    expect(mockQueue.removeFromTableQueue).toHaveBeenCalledWith("q1");
    expect(mockQueue.incrementTableQueueAttempts).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tables", "store-1"] });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps a network-failed entry queued for retry", async () => {
    mockQueue.listTableQueue.mockResolvedValue([entry()]);
    vi.spyOn(apiClient, "patch").mockRejectedValue(new Error("network error"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineTableQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(mockQueue.removeFromTableQueue).not.toHaveBeenCalled();
    expect(mockQueue.incrementTableQueueAttempts).toHaveBeenCalled();
  });

  it("drops an entry that exhausted its retry budget without ever sending it", async () => {
    mockQueue.listTableQueue.mockResolvedValue([entry({ attempts: 5 })]);
    const patchSpy = vi.spyOn(apiClient, "patch");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineTableQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(patchSpy).not.toHaveBeenCalled();
    expect(mockQueue.removeFromTableQueue).toHaveBeenCalledWith("q1");
  });

  it("reflects queue size as pendingCount", async () => {
    mockQueue.tableQueueSize.mockResolvedValue(3);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineTableQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(3));
  });
});
