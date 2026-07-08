/**
 * Rate Limiter Tests
 *
 * Regression coverage for the per-path scoping bug: the underlying counter
 * used to be keyed only by identifier (user/IP), so every rate-limited
 * endpoint a caller hit shared one bucket — routine calls to a generous
 * endpoint (e.g. /api/subscriptions/status) could silently exhaust the much
 * tighter budget of an unrelated endpoint (e.g. /api/subscriptions/checkout).
 */

import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  it("enforces the configured limit for a single path", async () => {
    const identifier = "user:rate-test-single";
    const path = "/api/subscriptions/cleanup"; // limit: 2, window: 60

    const first = await checkRateLimit(identifier, path);
    const second = await checkRateLimit(identifier, path);
    const third = await checkRateLimit(identifier, path);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
  });

  it("keeps separate endpoints independent for the same identifier", async () => {
    const identifier = "user:rate-test-scope";

    // Exhaust the tight endpoint's budget first.
    await checkRateLimit(identifier, "/api/subscriptions/cleanup"); // limit: 2
    await checkRateLimit(identifier, "/api/subscriptions/cleanup");
    const cleanupExceeded = await checkRateLimit(identifier, "/api/subscriptions/cleanup");
    expect(cleanupExceeded.success).toBe(false);

    // A different endpoint for the SAME identifier must be unaffected —
    // this is the first call against it, so it should have a full budget.
    const checkout = await checkRateLimit(identifier, "/api/subscriptions/checkout"); // limit: 5
    expect(checkout.success).toBe(true);
    expect(checkout.remaining).toBe(4);
  });
});
