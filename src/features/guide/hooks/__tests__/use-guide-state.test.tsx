import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { GuideState } from "@/lib/guide/contracts";
import { guideStateKey, useGuideState, type GuideStateQueryData } from "../use-guide-state";

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const state = (over: Partial<GuideState> = {}): GuideState => ({
  tourSeenAt: null,
  dismissedTips: [],
  dismissedChecklists: [],
  ...over,
});

const envelope = (data: unknown) => ({ success: true, data });

interface Reply {
  status: number;
  body?: unknown;
}

/**
 * fetch mock: GETs answer with `get`, PATCHes pop from `patches` (or echo
 * `patchDefault`), and every call is recorded.
 */
function mockFetch({
  get,
  patches = [],
  patchDefault,
}: {
  get: Reply;
  patches?: Array<Reply | Promise<Reply>>;
  patchDefault?: Reply;
}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const reply = init?.method === "PATCH" ? await (patches.shift() ?? patchDefault ?? get) : get;
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    };
  });
  global.fetch = fetchMock as never;
  return fetchMock;
}

const patchBodies = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([, init]) => JSON.parse(String(init!.body)));

beforeEach(() => {
  vi.restoreAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } },
  });
});

describe("useGuideState: reading", () => {
  it("loads the state from GET /api/user/guide-state", async () => {
    const fetchMock = mockFetch({
      get: {
        status: 200,
        body: envelope(state({ tourSeenAt: "2026-09-01T00:00:00.000Z", dismissedTips: ["stock"] })),
      },
    });

    const { result } = renderHook(() => useGuideState(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReady).toBe(false);

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/user/guide-state");
    expect(result.current.tourSeen).toBe(true);
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isTipDismissed("stock")).toBe(true);
    expect(result.current.isTipDismissed("finance")).toBe(false);
    expect(result.current.isChecklistDismissed("store_1")).toBe(false);
  });

  it("parses what the server sends (drops junk entries)", async () => {
    mockFetch({
      get: { status: 200, body: envelope({ dismissedTips: ["stock", "bogus"], extra: 1 }) },
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.state).toEqual(state({ dismissedTips: ["stock"] }));
  });

  it.each([401, 403])(
    "a %s reads as an empty, ready state — nothing thrown, nothing retried",
    async (status) => {
      const fetchMock = mockFetch({ get: { status, body: { success: false } } });
      const { result } = renderHook(() => useGuideState(), { wrapper });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(result.current.state).toEqual(state());
      expect(result.current.tourSeen).toBe(false);
      expect(result.current.isAvailable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("a server error is retried once, then not ready (so nothing auto-opens) with the empty state", async () => {
    const fetchMock = mockFetch({ get: { status: 500, body: { success: false } } });
    const { result } = renderHook(() => useGuideState(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isReady).toBe(false);
    expect(result.current.state).toEqual(state());
  });
});

describe("useGuideState: changes", () => {
  it("dismissTip updates at once, then PATCHes, then keeps the server's answer", async () => {
    let release: (reply: Reply) => void = () => {};
    const pending = new Promise<Reply>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patches: [pending],
    });

    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.dismissTip("stock"));
    await waitFor(() => expect(result.current.isTipDismissed("stock")).toBe(true));
    expect(patchBodies(fetchMock)).toEqual([{ dismissTip: "stock" }]);

    release({ status: 200, body: envelope(state({ dismissedTips: ["stock", "finance"] })) });
    await waitFor(() => expect(result.current.isTipDismissed("finance")).toBe(true));
  });

  it("rolls back when the PATCH fails", async () => {
    let release: (reply: Reply) => void = () => {};
    const pending = new Promise<Reply>((resolve) => {
      release = resolve;
    });
    mockFetch({
      get: { status: 200, body: envelope(state({ dismissedChecklists: ["store_a"] })) },
      patches: [pending],
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.dismissChecklist("store_theirs"));
    await waitFor(() => expect(result.current.isChecklistDismissed("store_theirs")).toBe(true));

    release({ status: 403, body: { success: false } });
    await waitFor(() => expect(result.current.isChecklistDismissed("store_theirs")).toBe(false));
    expect(result.current.isChecklistDismissed("store_a")).toBe(true);
  });

  it("sends each action as its patch", async () => {
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patchDefault: { status: 200, body: envelope(state()) },
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.markTourSeen();
      result.current.resetTour();
      result.current.restoreTips();
      result.current.dismissChecklist("s1");
      result.current.restoreChecklist("s1");
    });

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(5));
    expect(patchBodies(fetchMock)).toEqual([
      { tourSeen: true },
      { resetTour: true },
      { restoreTips: true },
      { dismissChecklist: "s1" },
      { restoreChecklist: "s1" },
    ]);
  });

  it("runs PATCHes one at a time, and a queued change isn't wiped when an earlier one finishes", async () => {
    let releaseFirst: (reply: Reply) => void = () => {};
    const first = new Promise<Reply>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patches: [
        first,
        {
          status: 200,
          body: envelope(
            state({ tourSeenAt: "2026-09-26T10:00:00.000Z", dismissedTips: ["stock"] })
          ),
        },
      ],
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.markTourSeen();
      result.current.dismissTip("stock");
    });

    // Both applied optimistically; only the first request is on the wire.
    await waitFor(() => expect(result.current.isTipDismissed("stock")).toBe(true));
    expect(result.current.tourSeen).toBe(true);
    expect(patchBodies(fetchMock)).toEqual([{ tourSeen: true }]);

    // The first answer doesn't know about the tip yet; the tip must survive it.
    releaseFirst({
      status: 200,
      body: envelope(state({ tourSeenAt: "2026-09-26T10:00:00.000Z" })),
    });
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(2));
    expect(result.current.isTipDismissed("stock")).toBe(true);

    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.state).toEqual(
      state({ tourSeenAt: "2026-09-26T10:00:00.000Z", dismissedTips: ["stock"] })
    );
  });

  it("two queued changes that both fail leave the state exactly as the server has it", async () => {
    let releaseFirst: (reply: Reply) => void = () => {};
    let releaseSecond: (reply: Reply) => void = () => {};
    const first = new Promise<Reply>((resolve) => {
      releaseFirst = resolve;
    });
    const second = new Promise<Reply>((resolve) => {
      releaseSecond = resolve;
    });
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patches: [first, second],
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.dismissChecklist("s1");
      result.current.restoreChecklist("s1");
    });
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1));
    expect(result.current.isChecklistDismissed("s1")).toBe(false);

    releaseFirst({ status: 500, body: { success: false } });
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(2));
    releaseSecond({ status: 500, body: { success: false } });
    await waitFor(() => expect(client.isMutating()).toBe(0));

    // Per-change snapshots put back "dismissed" here (the restore's snapshot
    // held the failed dismiss) although the server never stored it.
    expect(result.current.isChecklistDismissed("s1")).toBe(false);
    expect(result.current.state).toEqual(state());
  });

  it("an earlier change failing doesn't undo a change queued behind it", async () => {
    let releaseFirst: (reply: Reply) => void = () => {};
    let releaseSecond: (reply: Reply) => void = () => {};
    const first = new Promise<Reply>((resolve) => {
      releaseFirst = resolve;
    });
    const second = new Promise<Reply>((resolve) => {
      releaseSecond = resolve;
    });
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patches: [first, second],
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.markTourSeen();
      result.current.dismissTip("stock");
    });
    await waitFor(() => expect(result.current.isTipDismissed("stock")).toBe(true));
    expect(result.current.tourSeen).toBe(true);

    // The tour PATCH fails while the tip is still queued: only the tour reverts.
    releaseFirst({ status: 500, body: { success: false } });
    await waitFor(() => expect(result.current.tourSeen).toBe(false));
    expect(result.current.isTipDismissed("stock")).toBe(true);
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(2));
    expect(result.current.isTipDismissed("stock")).toBe(true);

    releaseSecond({ status: 200, body: envelope(state({ dismissedTips: ["stock"] })) });
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.state).toEqual(state({ dismissedTips: ["stock"] }));
  });

  it("a success with a change still queued keeps the server's answer plus that change", async () => {
    let releaseFirst: (reply: Reply) => void = () => {};
    const first = new Promise<Reply>((resolve) => {
      releaseFirst = resolve;
    });
    let releaseSecond: (reply: Reply) => void = () => {};
    const second = new Promise<Reply>((resolve) => {
      releaseSecond = resolve;
    });
    const fetchMock = mockFetch({
      get: { status: 200, body: envelope(state()) },
      patches: [first, second],
    });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.dismissTip("stock");
      result.current.dismissTip("finance");
    });
    await waitFor(() => expect(result.current.isTipDismissed("finance")).toBe(true));

    // The server also knows about a tip dismissed in another tab.
    releaseFirst({ status: 200, body: envelope(state({ dismissedTips: ["tables", "stock"] })) });
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(2));
    await waitFor(() => expect(result.current.isTipDismissed("tables")).toBe(true));
    expect(result.current.isTipDismissed("stock")).toBe(true);
    expect(result.current.isTipDismissed("finance")).toBe(true);

    // Then the queued one fails: back to exactly the server's last answer.
    releaseSecond({ status: 500, body: { success: false } });
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.state).toEqual(state({ dismissedTips: ["tables", "stock"] }));
  });

  it("when refused (401/403), changes stay local: applied in the cache, nothing sent", async () => {
    const fetchMock = mockFetch({ get: { status: 401, body: { success: false } } });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => result.current.dismissTip("finance"));

    await waitFor(() => expect(result.current.isTipDismissed("finance")).toBe(true));
    await new Promise((r) => setTimeout(r, 10));
    expect(patchBodies(fetchMock)).toEqual([]);
    expect(client.getQueryData<GuideStateQueryData>(guideStateKey)?.available).toBe(false);
  });

  it('shares one cache entry under the key ["guide-state"]', async () => {
    mockFetch({ get: { status: 200, body: envelope(state({ dismissedTips: ["tables"] })) } });
    const { result } = renderHook(() => useGuideState(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(guideStateKey).toEqual(["guide-state"]);
    expect(client.getQueryData<GuideStateQueryData>(["guide-state"])?.state.dismissedTips).toEqual([
      "tables",
    ]);
  });
});
