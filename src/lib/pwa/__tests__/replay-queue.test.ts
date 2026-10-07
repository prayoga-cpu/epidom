import { describe, it, expect, vi, beforeEach } from "vitest";

const { reportNetworkFailure } = vi.hoisted(() => ({ reportNetworkFailure: vi.fn() }));
vi.mock("../reachability", () => ({ reportNetworkFailure }));

import { ApiClientError, ApiNetworkError } from "@/lib/api/client";
import { replayQueue } from "../replay-queue";
import type { SyncFailureRecord } from "../sync-failure";

const apiError = (status: number) =>
  new ApiClientError({ success: false, error: { code: "X", message: "no" } } as never, status);

type Entry = { id: string; needsAttention?: boolean };
const entries = (...ids: string[]): Entry[] => ids.map((id) => ({ id }));

function handlers(outcomes: Record<string, unknown>) {
  return {
    send: vi.fn(async (e: Entry) => {
      const outcome = outcomes[e.id];
      if (outcome) throw outcome;
    }),
    remove: vi.fn(async () => {}),
    reject: vi.fn(async (_entry: Entry, _failure: SyncFailureRecord, _error: unknown) => ({
      parked: false,
    })),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("replayQueue", () => {
  it("sends oldest first and removes each one that lands", async () => {
    const h = handlers({});
    const result = await replayQueue(entries("a", "b"), h);
    expect(h.send.mock.calls.map(([e]) => e.id)).toEqual(["a", "b"]);
    expect(h.remove).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ synced: 2, parked: 0, stoppedBy: null });
  });

  // The old loops counted these as attempts and deleted the sale on the fifth.
  it("a dropped connection stops the pass and touches nothing", async () => {
    const h = handlers({ b: new ApiNetworkError("Failed to fetch") });
    const result = await replayQueue(entries("a", "b", "c"), h);
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(h.remove).toHaveBeenCalledTimes(1);
    expect(h.reject).not.toHaveBeenCalled();
    expect(result.stoppedBy).toBe("transient");
    expect(reportNetworkFailure).toHaveBeenCalledTimes(1);
  });

  it("a 5xx stops the pass too, without probing the network", async () => {
    const h = handlers({ a: apiError(503) });
    const result = await replayQueue(entries("a", "b"), h);
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.reject).not.toHaveBeenCalled();
    expect(result.stoppedBy).toBe("transient");
    expect(reportNetworkFailure).not.toHaveBeenCalled();
  });

  it("an expired sign-in stops the pass and says so", async () => {
    const h = handlers({ a: apiError(401) });
    const result = await replayQueue(entries("a", "b"), h);
    expect(h.reject).not.toHaveBeenCalled();
    expect(result.stoppedBy).toBe("auth");
  });

  it("a refusal goes to reject and never blocks the entries behind it", async () => {
    const h = handlers({ a: apiError(422) });
    h.reject.mockResolvedValueOnce({ parked: true });
    const result = await replayQueue(entries("a", "b"), h);
    expect(h.reject).toHaveBeenCalledTimes(1);
    expect(h.reject.mock.calls[0][1]).toMatchObject({ status: 422, message: "no" });
    expect(h.remove).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ synced: 1, parked: 1, stoppedBy: null });
  });

  it("parked entries are skipped until a person puts them back", async () => {
    const h = handlers({});
    await replayQueue([{ id: "a", needsAttention: true }, { id: "b" }], h);
    expect(h.send.mock.calls.map(([e]) => e.id)).toEqual(["b"]);
  });
});
