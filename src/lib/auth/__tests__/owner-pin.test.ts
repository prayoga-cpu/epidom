import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { toPublicBusiness } from "../owner-pin";
import { getRateLimitConfig, rateLimitConfig } from "@/config/rate-limit.config";

const HASH = "$2a$10$abcdefghijklmnopqrstuuM2m4o0nN6wWm1l1y8y0Yb0Yb0Yb0Yb0";

describe("toPublicBusiness", () => {
  it("drops ownerPin and says a PIN is set, keeping every other field", () => {
    const out = toPublicBusiness({ id: "b", name: "Kopi", ownerPin: HASH, stores: [] });

    expect(out).toEqual({ id: "b", name: "Kopi", stores: [], hasOwnerPin: true });
    expect(out).not.toHaveProperty("ownerPin");
    expect(JSON.stringify(out)).not.toContain(HASH);
  });

  it("hasOwnerPin: false for a null or empty PIN", () => {
    expect(toPublicBusiness({ id: "b", ownerPin: null })).toEqual({ id: "b", hasOwnerPin: false });
    expect(toPublicBusiness({ id: "b", ownerPin: "" })).toEqual({ id: "b", hasOwnerPin: false });
  });

  it("is idempotent: a row that was already made public keeps its flag", () => {
    const once = toPublicBusiness({ id: "b", ownerPin: HASH });
    expect(toPublicBusiness(once)).toEqual({ id: "b", hasOwnerPin: true });
    expect(toPublicBusiness({ id: "b" })).toEqual({ id: "b", hasOwnerPin: false });
  });

  it("a real ownerPin wins over a stale flag", () => {
    expect(toPublicBusiness({ id: "b", ownerPin: null, hasOwnerPin: true })).toEqual({
      id: "b",
      hasOwnerPin: false,
    });
  });
});

describe("POST /api/user/verify-owner-pin rate limit (online brute force of the 4-digit PIN)", () => {
  const ENDPOINT = "/api/user/verify-owner-pin";

  it("has its own strict entry, not the 100/min default", () => {
    expect(rateLimitConfig[ENDPOINT]).toBeDefined();
    expect(getRateLimitConfig(ENDPOINT)).toBe(rateLimitConfig[ENDPOINT]);
    expect(getRateLimitConfig(ENDPOINT).limit).toBeLessThanOrEqual(5);
    expect(getRateLimitConfig(ENDPOINT).window).toBeGreaterThanOrEqual(60);
  });

  it("is the key the route actually passes to withApiHandler", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../app/api/user/verify-owner-pin/route.ts"),
      "utf8"
    );
    expect(source).toContain(`rateLimitEndpoint: "${ENDPOINT}"`);
  });
});
