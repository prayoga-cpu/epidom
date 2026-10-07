import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueue } = vi.hoisted(() => ({
  mockQueue: {
    listProductionQueue: vi.fn(),
    removeFromProductionQueue: vi.fn(),
    recordProductionRejection: vi.fn(),
    requeueParkedProduction: vi.fn(),
  },
}));

vi.mock("@/lib/pwa/offline-production-queue", () => mockQueue);

// The replay loop pings the probe on a dropped connection; keep it inert here.
vi.mock("@/lib/pwa/reachability", () => ({ reportNetworkFailure: vi.fn() }));

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
import { apiClient, ApiClientError, ApiNetworkError } from "@/lib/api/client";
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
  mockQueue.listProductionQueue.mockResolvedValue([]);
});

const refusal = () =>
  new ApiClientError(
    { success: false, error: { code: "INVALID_INPUT", message: "Product not found" } } as never,
    404
  );

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

  it("a dropped connection leaves the entry exactly as it was", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry()]);
    vi.spyOn(apiClient, "post").mockRejectedValue(new ApiNetworkError("Failed to fetch"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(mockQueue.removeFromProductionQueue).not.toHaveBeenCalled();
    expect(mockQueue.recordProductionRejection).not.toHaveBeenCalled();
  });

  it("a refusal is recorded, and parking it warns rather than deleting it", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry({ attempts: 4 })]);
    mockQueue.recordProductionRejection.mockResolvedValue(
      entry({ attempts: 5, needsAttention: true })
    );
    vi.spyOn(apiClient, "post").mockRejectedValue(refusal());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(mockQueue.recordProductionRejection).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      expect.objectContaining({ status: 404, message: "Product not found" }),
      5
    );
    expect(mockQueue.removeFromProductionQueue).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("never replays a parked entry on its own", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([entry({ attempts: 5, needsAttention: true })]);
    const postSpy = vi.spyOn(apiClient, "post");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(postSpy).not.toHaveBeenCalled();
    expect(mockQueue.removeFromProductionQueue).not.toHaveBeenCalled();
  });

  it("counts only this store's entries, parked ones separately", async () => {
    mockQueue.listProductionQueue.mockResolvedValue([
      entry({ id: "a" }),
      entry({ id: "b", needsAttention: true }),
      entry({ id: "c", storeId: "store-2" }),
    ]);
    vi.spyOn(apiClient, "post").mockRejectedValue(new ApiNetworkError("offline"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useOfflineProductionQueue("store-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(result.current.attentionCount).toBe(1);
  });
});
