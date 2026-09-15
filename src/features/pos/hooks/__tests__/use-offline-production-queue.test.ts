import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueue } = vi.hoisted(() => ({
  mockQueue: {
    listProductionQueue: vi.fn(),
    removeFromProductionQueue: vi.fn(),
    incrementProductionQueueAttempts: vi.fn(),
    productionQueueSize: vi.fn(),
  },
}));

vi.mock("@/lib/pwa/offline-production-queue", () => mockQueue);

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/pwa/sync-status", () => ({
  setLastSyncedAt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/utils/cache-helpers", () => ({
  invalidateMaterialRelatedQueries: vi.fn().mockResolvedValue(undefined),
  invalidateProductRelatedQueries: vi.fn().mockResolvedValue(undefined),
}));

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { useOfflineProductionQueue } from "../use-offline-production-queue";

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "p1",
    storeId: "store-1",
    productId: "prod-1",
    quantity: 10,
    queuedAt: "2026-09-15T00:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueue.productionQueueSize.mockResolvedValue(0);
  mockQueue.listProductionQueue.mockResolvedValue([]);
});

describe("useOfflineProductionQueue", () => {
  it("replays a queued quick-log with its id as the idempotency key", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry()]);
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(postSpy).toHaveBeenCalledWith("/stores/store-1/production/prep-list", {
      productId: "prod-1",
      quantity: 10,
      clientRequestId: "p1",
    });
    expect(mockQueue.removeFromProductionQueue).toHaveBeenCalledWith("p1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps a failed entry queued for retry rather than dropping it", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry()]);
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("network error"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(mockQueue.removeFromProductionQueue).not.toHaveBeenCalled();
    expect(mockQueue.incrementProductionQueueAttempts).toHaveBeenCalled();
  });

  it("drops an entry that exhausted its retry budget without ever sending it", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry({ attempts: 5 })]);
    const postSpy = vi.spyOn(apiClient, "post");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(postSpy).not.toHaveBeenCalled();
    expect(mockQueue.removeFromProductionQueue).toHaveBeenCalledWith("p1");
  });

  it("reflects queue size as pendingCount", async () => {
    mockQueue.productionQueueSize.mockResolvedValue(2);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(2));
  });
});
