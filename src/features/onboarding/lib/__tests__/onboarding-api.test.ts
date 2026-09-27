import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import {
  ONBOARDING_CONFLICT,
  conflictReason,
  conflictSuggestion,
  onboardingApi,
} from "../onboarding-api";

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  }));
  global.fetch = fetchMock as never;
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onboardingApi", () => {
  it("unwraps the success envelope", async () => {
    mockFetchOnce(200, {
      success: true,
      data: { slug: "mon-cafe", available: true, suggestion: null },
    });
    await expect(onboardingApi.checkSlug("mon-cafe")).resolves.toEqual({
      slug: "mon-cafe",
      available: true,
      suggestion: null,
    });
  });

  it("sends step 1 with the UI language header", async () => {
    const fetchMock = mockFetchOnce(200, { success: true, data: { step: 2 } });
    await onboardingApi.saveStore({ name: "Mon Café", countryCode: "FR" } as never, "fr");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/onboarding/store");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-epidom-locale"]).toBe("fr");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Mon Café", countryCode: "FR" });
  });

  it("encodes the slug in the check URL", async () => {
    const fetchMock = mockFetchOnce(200, { success: true, data: {} });
    await onboardingApi.checkSlug("a b");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/onboarding/slug-check?slug=a%20b"
    );
  });

  it("throws an ApiClientError carrying the 409 reason and suggestion", async () => {
    mockFetchOnce(409, {
      success: false,
      error: {
        code: "CONFLICT",
        message: "This store link is already taken.",
        details: { reason: "slug_taken", slug: "mon-cafe", suggestion: "mon-cafe-2" },
      },
    });
    const error = await onboardingApi
      .saveStore({ name: "Mon Café", countryCode: "FR", slug: "mon-cafe" } as never, "fr")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(409);
    expect(conflictReason(error)).toBe(ONBOARDING_CONFLICT.slugTaken);
    expect(conflictSuggestion(error)).toBe("mon-cafe-2");
  });

  it("throws on a non-JSON failure too", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new Error("not json");
      },
    })) as never;
    const error = await onboardingApi.getState().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(502);
    expect(conflictReason(error)).toBeNull();
  });
});

describe("conflictReason", () => {
  it("ignores anything that isn't a wizard 409", () => {
    expect(conflictReason(new Error("x"))).toBeNull();
    expect(
      conflictReason(
        new ApiClientError(
          { success: false, error: { code: "CONFLICT" as never, message: "", details: [] } },
          409
        )
      )
    ).toBeNull();
    expect(
      conflictReason(
        new ApiClientError(
          {
            success: false,
            error: { code: "CONFLICT" as never, message: "", details: { reason: "other" } },
          },
          409
        )
      )
    ).toBeNull();
  });

  it("uses the same reason strings as the service", async () => {
    const { ONBOARDING_CONFLICT_REASON } = await import("@/lib/services/onboarding.service");
    expect(ONBOARDING_CONFLICT).toEqual(ONBOARDING_CONFLICT_REASON);
  });
});
