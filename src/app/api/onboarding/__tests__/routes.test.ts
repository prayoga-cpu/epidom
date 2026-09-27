import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * The setup wizard routes, through the REAL withApiHandler (auth, deactivated
 * accounts, rate limiting, Zod -> 400 mapping, AppError -> status mapping).
 * The session, rate limiter, audit capture and the onboarding service are
 * mocked; the service's own behaviour is covered in
 * src/lib/services/__tests__/onboarding.service.test.ts.
 */

const h = vi.hoisted(() => ({
  requireSessionApi: vi.fn(),
  checkRateLimitByUser: vi.fn(),
  getOnboardingState: vi.fn(),
  saveStoreStep: vi.fn(),
  saveStorefrontStep: vi.fn(),
  completeOnboarding: vi.fn(),
  checkSlugAvailability: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth/require-session", () => ({ requireSessionApi: h.requireSessionApi }));
vi.mock("@/lib/middleware/rate-limit", () => ({ checkRateLimitByUser: h.checkRateLimitByUser }));
vi.mock("@/lib/utils/store-verification", () => ({ verifyStoreAccess: vi.fn() }));
vi.mock("@/lib/auth/staff-principal-policy", () => ({ authorizeStaffPrincipal: vi.fn() }));
vi.mock("@/lib/audit/actor", () => ({
  resolveActor: vi.fn(async () => ({ type: "USER", userId: "user_1" })),
  publicActor: vi.fn(() => ({ type: "PUBLIC" })),
}));
vi.mock("@/lib/audit/activity", () => ({ captureRequestActivity: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/services/onboarding.service", () => ({
  getOnboardingState: h.getOnboardingState,
  saveStoreStep: h.saveStoreStep,
  saveStorefrontStep: h.saveStorefrontStep,
  completeOnboarding: h.completeOnboarding,
  checkSlugAvailability: h.checkSlugAvailability,
  // The real one is unit-tested with the service; here it only has to be wired.
  uiLocaleFromRequest: (request: Request) => request.headers.get("x-epidom-locale"),
}));

import { AppError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api/responses";
import { getRateLimitConfig, rateLimitConfig } from "@/config/rate-limit.config";
import { resolveRouteAction } from "@/lib/audit/route-map";
import { GET as getState } from "../state/route";
import { POST as postStore } from "../store/route";
import { POST as postStorefront } from "../storefront/route";
import { POST as postComplete } from "../complete/route";
import { GET as getSlugCheck } from "../slug-check/route";

const ctx = { params: Promise.resolve({}) };
const url = (path: string) => `http://localhost/api/onboarding/${path}`;
const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url(path), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

const STATE = { step: 2, completed: false, storeId: "store_1" };
const validStore = { name: "Crêperie du Port", countryCode: "fr", city: "Brest" };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSessionApi.mockResolvedValue({ user: { id: "user_1", deactivatedAt: null } });
  h.checkRateLimitByUser.mockResolvedValue(null);
  h.getOnboardingState.mockResolvedValue(STATE);
  h.saveStoreStep.mockResolvedValue(STATE);
  h.saveStorefrontStep.mockResolvedValue({ ...STATE, step: 3 });
  h.completeOnboarding.mockResolvedValue({
    storeId: "store_1",
    slug: "creperie-du-port",
    publicUrl: "https://epidom.fr/@creperie-du-port",
    goals: [],
  });
  h.checkSlugAvailability.mockResolvedValue({
    slug: "mon-cafe",
    available: true,
    suggestion: null,
  });
});

describe("auth and account state (every onboarding route)", () => {
  const calls: [string, () => Promise<Response>][] = [
    ["GET state", () => getState(new Request(url("state")), ctx)],
    ["POST store", () => postStore(post("store", validStore), ctx)],
    ["POST storefront", () => postStorefront(post("storefront", {}), ctx)],
    ["POST complete", () => postComplete(post("complete", {}), ctx)],
    ["GET slug-check", () => getSlugCheck(new Request(url("slug-check?slug=abc")), ctx)],
  ];

  it.each(calls)("%s: signed out is a 401 and runs nothing", async (_name, call) => {
    h.requireSessionApi.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 })
    );
    const res = await call();
    expect(res.status).toBe(401);
    for (const fn of [
      h.getOnboardingState,
      h.saveStoreStep,
      h.saveStorefrontStep,
      h.completeOnboarding,
      h.checkSlugAvailability,
    ]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(calls)("%s: a deactivated account is a 403", async (_name, call) => {
    h.requireSessionApi.mockResolvedValue({ user: { id: "user_1", deactivatedAt: new Date() } });
    expect((await call()).status).toBe(403);
  });

  it.each(calls)("%s: has its own rate-limit bucket", async (name, call) => {
    await call();
    const endpoint = h.checkRateLimitByUser.mock.calls[0][1];
    expect(endpoint).toMatch(/^\/api\/onboarding\/(state|store|storefront|complete|slug-check)$/);
    expect(endpoint.endsWith(name.split(" ")[1])).toBe(true);
  });

  it.each([
    "/api/onboarding/state",
    "/api/onboarding/store",
    "/api/onboarding/storefront",
    "/api/onboarding/complete",
    "/api/onboarding/slug-check",
  ])("%s has its own rate-limit entry (not the default)", (endpoint) => {
    expect(rateLimitConfig[endpoint], endpoint).toBeDefined();
    expect(getRateLimitConfig(endpoint)).not.toBe(rateLimitConfig.default);
  });

  it("the removed AI endpoints are gone from the rate limits", () => {
    expect(rateLimitConfig["/api/onboarding/generate-logo"]).toBeUndefined();
    expect(rateLimitConfig["/api/onboarding/suggest-menu"]).toBeUndefined();
  });

  it("the step saves are filed in the activity trail under their own codes", () => {
    expect(resolveRouteAction("POST", "/api/onboarding/store")?.code).toBe("onboarding.store.save");
    expect(resolveRouteAction("POST", "/api/onboarding/storefront")?.code).toBe(
      "onboarding.storefront.save"
    );
    expect(resolveRouteAction("POST", "/api/onboarding/complete")?.code).toBe(
      "onboarding.complete"
    );
    expect(resolveRouteAction("GET", "/api/onboarding/state")).toBeNull();
  });

  it("a rate-limited caller gets a 429", async () => {
    h.checkRateLimitByUser.mockResolvedValue({ limit: 20, remaining: 0, reset: 30 });
    const res = await postStore(post("store", validStore), ctx);
    expect(res.status).toBe(429);
    expect(h.saveStoreStep).not.toHaveBeenCalled();
  });
});

describe("GET /api/onboarding/state", () => {
  it("returns the caller's state in the success envelope", async () => {
    const res = await getState(new Request(url("state")), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, data: STATE });
    expect(h.getOnboardingState).toHaveBeenCalledWith("user_1");
  });
});

describe("POST /api/onboarding/store", () => {
  it("passes the parsed body (country upper-cased) and the request's UI language", async () => {
    const res = await postStore(post("store", validStore, { "x-epidom-locale": "fr" }), ctx);
    expect(res.status).toBe(200);
    expect(h.saveStoreStep).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ name: "Crêperie du Port", countryCode: "FR", city: "Brest" }),
      "fr"
    );
    expect((await res.json()).data).toEqual(STATE);
  });

  it("passes slugFromName (Use my store name) through", async () => {
    await postStore(post("store", { ...validStore, slugFromName: true }), ctx);
    expect(h.saveStoreStep).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ slugFromName: true }),
      null
    );
  });

  it.each([
    ["no body", undefined],
    ["broken JSON", "{not json"],
    ["missing name", { countryCode: "FR" }],
    ["unsupported country", { ...validStore, countryCode: "XX" }],
    ["unknown business type", { ...validStore, businessType: "spaceship" }],
    ["invalid timezone", { ...validStore, browserTimezone: "Mars/Olympus" }],
    ["invalid custom link", { ...validStore, slug: "Mon Café!" }],
    ["data: URI logo", { ...validStore, logoUrl: "data:image/svg+xml;base64,AAAA" }],
  ])("%s is a 400 validation error", async (_name, body) => {
    const res = await postStore(post("store", body), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(h.saveStoreStep).not.toHaveBeenCalled();
  });

  it("a taken link is a 409 carrying the suggestion", async () => {
    h.saveStoreStep.mockRejectedValue(
      new AppError("This store link is already taken.", ApiErrorCode.CONFLICT, 409, {
        reason: "slug_taken",
        slug: "la-creperie",
        suggestion: "la-creperie-2",
      })
    );
    const res = await postStore(post("store", { ...validStore, slug: "la-creperie" }), ctx);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatchObject({
      code: ApiErrorCode.CONFLICT,
      details: { reason: "slug_taken", suggestion: "la-creperie-2" },
    });
  });

  it("a store that is already live is a 409 already_completed (the wizard sends the owner to /stores)", async () => {
    h.saveStoreStep.mockRejectedValue(
      new AppError(
        "Setup is already complete. Edit your store from the Back Office instead.",
        ApiErrorCode.CONFLICT,
        409,
        { reason: "already_completed" }
      )
    );
    const res = await postStore(post("store", validStore), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({
      code: ApiErrorCode.CONFLICT,
      details: { reason: "already_completed" },
    });
  });
});

describe("POST /api/onboarding/storefront", () => {
  it("an empty body skips the step (no menu items)", async () => {
    const res = await postStorefront(post("storefront"), ctx);
    expect(res.status).toBe(200);
    expect(h.saveStorefrontStep).toHaveBeenCalledWith("user_1", { menuItems: [] });
  });

  it("passes up to three items through", async () => {
    const menuItems = [
      { id: "item_1", name: "Galette", price: 9.5 },
      { name: "Crêpe", price: 4.5 },
    ];
    await postStorefront(post("storefront", { menuItems, themeColor: "#123456" }), ctx);
    expect(h.saveStorefrontStep).toHaveBeenCalledWith("user_1", {
      menuItems,
      themeColor: "#123456",
    });
  });

  it("passes the ids of cleared rows through (the service deletes them)", async () => {
    await postStorefront(post("storefront", { menuItems: [], removedItemIds: ["item_2"] }), ctx);
    expect(h.saveStorefrontStep).toHaveBeenCalledWith("user_1", {
      menuItems: [],
      removedItemIds: ["item_2"],
    });
  });

  it.each([
    ["four items", { menuItems: [1, 2, 3, 4].map((n) => ({ name: `Item ${n}`, price: 1 })) }],
    ["four removed items", { removedItemIds: ["a", "b", "c", "d"] }],
    ["an empty removed id", { removedItemIds: [""] }],
    ["a negative price", { menuItems: [{ name: "Galette", price: -1 }] }],
    ["an unnamed item", { menuItems: [{ name: "  ", price: 1 }] }],
    ["a bad colour", { themeColor: "orange" }],
  ])("%s is a 400", async (_name, body) => {
    const res = await postStorefront(post("storefront", body), ctx);
    expect(res.status).toBe(400);
    expect(h.saveStorefrontStep).not.toHaveBeenCalled();
  });

  it("saving before step 1 is a 409 step_order", async () => {
    h.saveStorefrontStep.mockRejectedValue(
      new AppError("Finish the first step (your store) first.", ApiErrorCode.CONFLICT, 409, {
        reason: "step_order",
      })
    );
    const res = await postStorefront(post("storefront", {}), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error.details.reason).toBe("step_order");
  });
});

describe("POST /api/onboarding/complete", () => {
  it("an empty body means no goals", async () => {
    const res = await postComplete(post("complete"), ctx);
    expect(res.status).toBe(200);
    expect(h.completeOnboarding).toHaveBeenCalledWith("user_1", { goals: [] });
    expect((await res.json()).data.publicUrl).toBe("https://epidom.fr/@creperie-du-port");
  });

  it("de-duplicates goals", async () => {
    await postComplete(post("complete", { goals: ["counter", "storefront", "counter"] }), ctx);
    expect(h.completeOnboarding).toHaveBeenCalledWith("user_1", {
      goals: ["counter", "storefront"],
    });
  });

  it("an unknown goal is a 400", async () => {
    const res = await postComplete(post("complete", { goals: ["world-domination"] }), ctx);
    expect(res.status).toBe(400);
    expect(h.completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("GET /api/onboarding/slug-check", () => {
  it("passes the raw value to the service (which normalizes it)", async () => {
    const res = await getSlugCheck(new Request(url("slug-check?slug=Mon%20Caf%C3%A9")), ctx);
    expect(res.status).toBe(200);
    expect(h.checkSlugAvailability).toHaveBeenCalledWith("user_1", "Mon Café");
    expect((await res.json()).data).toEqual({
      slug: "mon-cafe",
      available: true,
      suggestion: null,
    });
  });

  it("a missing or empty slug is a 400", async () => {
    expect((await getSlugCheck(new Request(url("slug-check")), ctx)).status).toBe(400);
    expect((await getSlugCheck(new Request(url("slug-check?slug=")), ctx)).status).toBe(400);
    expect(h.checkSlugAvailability).not.toHaveBeenCalled();
  });
});
