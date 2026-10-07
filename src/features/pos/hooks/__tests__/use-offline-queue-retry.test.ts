import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queue = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
  reachable: true,
}));

vi.mock("@/lib/pwa/offline-queue", () => ({
  OFFLINE_QUEUE_CHANGED_EVENT: "epidom:offline-queue-changed",
  listQueue: vi.fn(async () => queue.entries),
  removeFromQueue: vi.fn(async () => {}),
  recordRejection: vi.fn(async (e: unknown) => e),
  requeueParked: vi.fn(async () => 0),
}));
vi.mock("@/lib/pwa/reachability", () => ({
  getReachabilitySnapshot: () => ({
    isOnline: queue.reachable,
    lastCheckedAt: null,
    consecutiveFailures: 0,
  }),
}));
vi.mock("@/lib/pwa/sync-status", () => ({ setLastSyncedAt: vi.fn(async () => {}) }));
vi.mock("@/lib/pwa/replay-queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/replay-queue")>()),
  replayQueue: vi.fn(async () => ({ synced: 0, parked: 0, stoppedBy: null })),
}));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(async () => ({})) } }));
// Stable like the real provider's: syncQueue depends on `t`, and a new function
// each render would re-run the hook's mount-time sync on every render.
const i18n = vi.hoisted(() => ({ t: (k: string) => k }));
vi.mock("@/components/lang/i18n-provider", () => ({ useI18n: () => i18n }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { replayQueue } from "@/lib/pwa/replay-queue";
import { apiClient } from "@/lib/api/client";
import { useOfflineQueue } from "../use-offline-queue";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

const pending = { id: "q1", storeId: "s1", queuedAt: "2026-10-06T01:00:00.000Z", order: {} };

describe("useOfflineQueue — a sale queued while the connection still reads online", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.clearAllMocks();
    queue.entries = [];
    queue.reachable = true;
  });
  afterEach(() => vi.useRealTimers());

  async function mountAndQueue() {
    await act(async () => {
      renderHook(() => useOfflineQueue("s1"), { wrapper });
    });
    // Let the mount-time refresh/sync pass (an empty queue) settle completely.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    vi.mocked(replayQueue).mockClear();
    queue.entries = [pending];
    await act(async () => {
      window.dispatchEvent(new Event("epidom:offline-queue-changed"));
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("is sent a few seconds later — a checkout that timed out never goes 'offline'", async () => {
    await mountAndQueue();
    expect(replayQueue).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(replayQueue).toHaveBeenCalledTimes(1);
  });

  it("sends an older queued sale dated by its queue time, and without the live mark", async () => {
    await mountAndQueue();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    const send = vi.mocked(replayQueue).mock.calls[0][1].send;
    await send(pending as never);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/stores/s1/pos/orders",
      { clientCreatedAt: "2026-10-06T01:00:00.000Z", clientRequestId: "q1" },
      expect.anything()
    );
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("liveCheckout");

    // A sale stamped at enqueue keeps its own time.
    vi.mocked(apiClient.post).mockClear();
    await send({ ...pending, order: { clientCreatedAt: "2026-10-05T23:50:00.000Z" } } as never);
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({
      clientCreatedAt: "2026-10-05T23:50:00.000Z",
    });
  });

  it("checks the connection again when the timer fires", async () => {
    await mountAndQueue();
    // The checkout's failure kicked a probe, which has since found the device offline.
    queue.reachable = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(replayQueue).not.toHaveBeenCalled();
  });

  it("keeps trying, backing off, while the sale stays unsent", async () => {
    vi.mocked(replayQueue).mockResolvedValue({ synced: 0, parked: 0, stoppedBy: "transient" });
    await mountAndQueue();
    vi.mocked(replayQueue).mockClear();
    vi.mocked(replayQueue).mockResolvedValue({ synced: 0, parked: 0, stoppedBy: "transient" });
    for (const [wait, calls] of [
      [5_000, 1],
      [15_000, 2],
      [60_000, 3],
      [60_000, 4],
    ] as const) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(wait);
      });
      expect(replayQueue).toHaveBeenCalledTimes(calls);
    }
  });

  it("stops retrying when a sign-in is needed", async () => {
    vi.mocked(replayQueue).mockResolvedValue({ synced: 0, parked: 0, stoppedBy: "auth" });
    await mountAndQueue();
    vi.mocked(replayQueue).mockClear();
    vi.mocked(replayQueue).mockResolvedValue({ synced: 0, parked: 0, stoppedBy: "auth" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000 + 15_000 + 60_000);
    });
    expect(replayQueue).toHaveBeenCalledTimes(1);
  });

  it("waits for the connection to come back when it is really offline", async () => {
    queue.reachable = false;
    await mountAndQueue();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(replayQueue).not.toHaveBeenCalled();
  });
});
