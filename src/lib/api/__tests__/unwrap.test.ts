import { describe, it, expect } from "vitest";
import { unwrapApiData, unwrapApiError } from "../unwrap";
import { createSuccessResponse, createErrorResponse } from "@/types/api/responses";
import { ApiErrorCode } from "@/types/api/responses";

describe("unwrapApiData", () => {
  it("returns the payload from a createSuccessResponse envelope", () => {
    // Built with the real helper so this test tracks the envelope's actual
    // shape rather than a hand-written copy of it.
    const envelope = createSuccessResponse({ orders: [{ id: "a" }] });
    expect(unwrapApiData<{ orders: Array<{ id: string }> }>(envelope)).toEqual({
      orders: [{ id: "a" }],
    });
  });

  it("passes a bare, un-enveloped payload through untouched", () => {
    // Not every route wraps, and server-rendered initialData never does.
    const bare = { movements: [{ id: "m1" }], total: 1 };
    expect(unwrapApiData(bare)).toBe(bare);
  });

  it("does not unwrap an error envelope", () => {
    const envelope = createErrorResponse(ApiErrorCode.NOT_FOUND, "nope");
    expect(unwrapApiData(envelope)).toBe(envelope);
  });

  it("keeps a payload that legitimately has its own `data` key", () => {
    // `success` is what identifies the envelope — a payload merely containing
    // `data` must not be stripped.
    const payload = { data: [1, 2, 3] };
    expect(unwrapApiData(payload)).toBe(payload);
  });

  it("tolerates null and undefined", () => {
    expect(unwrapApiData(null)).toBeNull();
    expect(unwrapApiData(undefined)).toBeUndefined();
  });

  it("is idempotent — unwrapping twice is harmless", () => {
    const once = unwrapApiData<{ orders: unknown[] }>(createSuccessResponse({ orders: [] }));
    expect(unwrapApiData(once)).toEqual({ orders: [] });
  });

  it("returns the envelope itself when data is absent", () => {
    const weird = { success: true, meta: {} };
    expect(unwrapApiData(weird)).toBe(weird);
  });
});

describe("unwrapApiError", () => {
  it("reads code and message out of a createErrorResponse envelope", () => {
    const envelope = createErrorResponse(
      ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
      "Upgrade required"
    );
    expect(unwrapApiError(envelope)).toEqual({
      code: "SUBSCRIPTION_FEATURE_LOCKED",
      message: "Upgrade required",
    });
  });

  it("falls back to a top-level code/message", () => {
    expect(unwrapApiError({ code: "X", message: "boom" })).toEqual({ code: "X", message: "boom" });
  });

  it("handles the older shape where `error` is a plain string", () => {
    expect(unwrapApiError({ error: "something failed" }).message).toBe("something failed");
  });

  it("returns undefined fields rather than throwing on junk", () => {
    expect(unwrapApiError(null)).toEqual({ code: undefined, message: undefined });
    expect(unwrapApiError({})).toEqual({ code: undefined, message: undefined });
  });

  it("never yields the object that rendered as [object Object]", () => {
    // Callers used to do `error.error` and interpolate it into a message.
    const envelope = createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Bad input");
    const { message } = unwrapApiError(envelope);
    expect(typeof message).toBe("string");
    expect(String(message)).not.toContain("[object Object]");
  });
});
