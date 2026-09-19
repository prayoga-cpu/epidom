import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api/client";
import { ApiErrorCode } from "@/types/api/responses";
import {
  applyPatch,
  invalidatePosCaches,
  promotionKeys,
  retryTransientOnly,
} from "../promotion-keys";

const apiError = (status: number, code: ApiErrorCode) =>
  new ApiClientError({ success: false, error: { code, message: "nope" } }, status);

describe("promotionKeys", () => {
  it("keeps the Back Office lists apart from the POS caches of the same data", () => {
    // The till caches only the ACTIVE presets under ["pos", "discount-presets", id]; this tab
    // caches all of them. A shared key would let one overwrite the other.
    expect(promotionKeys.presets("s1")).not.toEqual(["pos", "discount-presets", "s1"]);
    expect(promotionKeys.loyalty("s1")).not.toEqual(["pos", "loyalty-settings", "s1"]);
  });

  it("scopes every key to the store", () => {
    expect(promotionKeys.presets("a")).not.toEqual(promotionKeys.presets("b"));
    expect(promotionKeys.coupons("a")).not.toEqual(promotionKeys.coupons("b"));
    expect(promotionKeys.loyalty("a")).not.toEqual(promotionKeys.loyalty("b"));
  });
});

describe("retryTransientOnly", () => {
  it("never retries a 4xx — above all the 403 that means 'upgrade your plan'", () => {
    expect(retryTransientOnly(0, apiError(403, ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED))).toBe(
      false
    );
    expect(retryTransientOnly(0, apiError(400, ApiErrorCode.VALIDATION_ERROR))).toBe(false);
    expect(retryTransientOnly(0, apiError(404, ApiErrorCode.NOT_FOUND))).toBe(false);
  });

  it("retries a server error or a network failure, but only twice", () => {
    expect(retryTransientOnly(0, apiError(500, ApiErrorCode.INTERNAL_ERROR))).toBe(true);
    expect(retryTransientOnly(1, new Error("Network error occurred"))).toBe(true);
    expect(retryTransientOnly(2, new Error("Network error occurred"))).toBe(false);
  });
});

describe("applyPatch", () => {
  it("merges the defined fields", () => {
    expect(applyPatch({ id: "1", name: "A", isActive: true }, { isActive: false })).toEqual({
      id: "1",
      name: "A",
      isActive: false,
    });
  });

  it("does not let an undefined key wipe a stored value", () => {
    expect(applyPatch({ id: "1", name: "A" }, { name: undefined })).toEqual({ id: "1", name: "A" });
  });

  it("lets an explicit null through — that is how a bound is cleared", () => {
    expect(applyPatch({ id: "1", maxUses: 5 as number | null }, { maxUses: null })).toEqual({
      id: "1",
      maxUses: null,
    });
  });
});

describe("invalidatePosCaches", () => {
  it("invalidates the till's cached presets and loyalty rules for the store", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidatePosCaches(client, "s1", "presets");
    await invalidatePosCaches(client, "s1", "loyalty");

    expect(spy).toHaveBeenNthCalledWith(1, { queryKey: ["pos", "discount-presets", "s1"] });
    expect(spy).toHaveBeenNthCalledWith(2, { queryKey: ["pos", "loyalty-settings", "s1"] });
  });
});
