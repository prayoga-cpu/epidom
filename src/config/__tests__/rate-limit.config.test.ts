import { describe, it, expect } from "vitest";
import { getRateLimitConfig, rateLimitConfig } from "../rate-limit.config";

// Every route added or extended by the cashier revamp (2.88.0) must carry its OWN
// entry. A missing one is silent — getRateLimitConfig just falls back to the
// default — so this list is the only thing that notices a route that shipped
// without one. The strings are the `rateLimitEndpoint` values the routes pass to
// withApiHandler, verbatim.
const REVAMP_ENDPOINTS = [
  "/api/stores/[id]/customers",
  "/api/stores/[id]/customers/[customerId]",
  "/api/stores/[id]/customers/[customerId]/points",
  "/api/stores/[id]/customers/export",
  "/api/stores/[id]/discount-presets",
  "/api/stores/[id]/discount-presets/[presetId]",
  "/api/stores/[id]/coupons",
  "/api/stores/[id]/coupons/[couponId]",
  "/api/stores/[id]/coupons/validate",
  "/api/stores/[id]/loyalty-settings",
  "/api/stores/[id]/pos/orders/merge",
  "/api/stores/[id]/pos/orders/[orderId]/refund",
  "/api/stores/[id]/pos/orders/[orderId]/send-receipt",
  "/api/stores/[id]/pos/orders/[orderId]/send-receipt-email",
];

describe("rate limits for the cashier revamp routes", () => {
  it.each(REVAMP_ENDPOINTS)("%s has its own entry (not the default)", (endpoint) => {
    expect(rateLimitConfig[endpoint], endpoint).toBeDefined();
    expect(getRateLimitConfig(endpoint)).toBe(rateLimitConfig[endpoint]);
    expect(getRateLimitConfig(endpoint)).not.toBe(rateLimitConfig.default);
  });

  it("keeps the limits sensible: the guessable and heavy endpoints are tighter than a plain read", () => {
    const limit = (e: string) => rateLimitConfig[e].limit;
    // A coupon code is guessable input.
    expect(limit("/api/stores/[id]/coupons/validate")).toBeLessThan(rateLimitConfig.default.limit);
    // Exports are heavy; manual point edits and merges are rare and consequential.
    expect(limit("/api/stores/[id]/customers/export")).toBeLessThanOrEqual(10);
    expect(limit("/api/stores/[id]/customers/[customerId]/points")).toBeLessThanOrEqual(30);
    expect(limit("/api/stores/[id]/pos/orders/merge")).toBeLessThanOrEqual(30);
    // Receipt sends cost a WhatsApp message / an e-mail.
    expect(limit("/api/stores/[id]/pos/orders/[orderId]/send-receipt")).toBeLessThanOrEqual(30);
    expect(limit("/api/stores/[id]/pos/orders/[orderId]/send-receipt-email")).toBeLessThanOrEqual(
      30
    );
    // The POS customer box searches as the cashier types, so it gets headroom.
    expect(limit("/api/stores/[id]/customers")).toBeGreaterThanOrEqual(
      rateLimitConfig.default.limit
    );
  });

  it("every window is a positive number of seconds", () => {
    for (const endpoint of REVAMP_ENDPOINTS) {
      expect(rateLimitConfig[endpoint].window).toBeGreaterThan(0);
      expect(rateLimitConfig[endpoint].limit).toBeGreaterThan(0);
    }
  });
});
