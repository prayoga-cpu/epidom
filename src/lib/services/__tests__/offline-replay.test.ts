import { describe, it, expect } from "vitest";
import {
  CLOCK_SKEW_TOLERANCE_MS,
  MAX_OFFLINE_AGE_MS,
  isOfflineReplay,
  resolveOfflineOccurredAt,
} from "../offline-replay";

const NOW = new Date("2026-10-05T12:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("resolveOfflineOccurredAt", () => {
  it("a replay keeps the time the sale was rung up", () => {
    const soldAt = at(-14 * 60 * 60 * 1000);
    expect(
      resolveOfflineOccurredAt({ clientRequestId: "q1", clientCreatedAt: soldAt }, NOW)
    ).toEqual(new Date(soldAt));
  });

  it("an online checkout (no clientCreatedAt) is stamped by the server", () => {
    expect(resolveOfflineOccurredAt({ clientRequestId: "q1" }, NOW)).toBeNull();
  });

  it("a time without an idempotency key is not a replay and is ignored", () => {
    expect(resolveOfflineOccurredAt({ clientCreatedAt: at(-60_000) }, NOW)).toBeNull();
  });

  it("a little in the future is clock drift: recorded as now", () => {
    expect(
      resolveOfflineOccurredAt({ clientRequestId: "q1", clientCreatedAt: at(60_000) }, NOW)
    ).toEqual(NOW);
  });

  it("far in the future is a broken clock: not trusted", () => {
    expect(
      resolveOfflineOccurredAt(
        { clientRequestId: "q1", clientCreatedAt: at(CLOCK_SKEW_TOLERANCE_MS + 1) },
        NOW
      )
    ).toBeNull();
  });

  it("older than the window is not trusted either", () => {
    expect(
      resolveOfflineOccurredAt(
        { clientRequestId: "q1", clientCreatedAt: at(-MAX_OFFLINE_AGE_MS - 1) },
        NOW
      )
    ).toBeNull();
    const oldButValid = at(-MAX_OFFLINE_AGE_MS + 60_000);
    expect(
      resolveOfflineOccurredAt({ clientRequestId: "q1", clientCreatedAt: oldButValid }, NOW)
    ).toEqual(new Date(oldButValid));
  });
});

describe("isOfflineReplay", () => {
  it("is a replay when the queue stamped the sale's own time", () => {
    expect(
      isOfflineReplay({ clientRequestId: "q1", clientCreatedAt: "2026-10-06T01:00:00Z" })
    ).toBe(true);
  });
  it("is a replay for a bare key from a till still on the previous release", () => {
    expect(isOfflineReplay({ clientRequestId: "q1" })).toBe(true);
  });
  it("is NOT a replay for the live checkout, which marks itself", () => {
    expect(isOfflineReplay({ clientRequestId: "live-1", liveCheckout: true })).toBe(false);
  });
  it("is never a replay without an idempotency key", () => {
    expect(isOfflineReplay({})).toBe(false);
  });
});
