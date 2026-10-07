import { describe, it, expect } from "vitest";
import { ApiClientError, ApiNetworkError } from "@/lib/api/client";
import { classifySyncFailure, describeSyncFailure } from "../sync-failure";

const apiError = (status: number) =>
  new ApiClientError(
    { success: false, error: { code: "X", message: `status ${status}` } } as never,
    status
  );

describe("classifySyncFailure", () => {
  it("no answer from our API is transient", () => {
    expect(classifySyncFailure(new ApiNetworkError("Failed to fetch"))).toBe("transient");
    expect(classifySyncFailure(new ApiNetworkError("Request timed out", true))).toBe("transient");
    expect(classifySyncFailure(new TypeError("Failed to fetch"))).toBe("transient");
  });

  it("server trouble and rate limits are transient", () => {
    for (const status of [408, 429, 500, 502, 503]) {
      expect(classifySyncFailure(apiError(status))).toBe("transient");
    }
  });

  it("an expired sign-in is its own kind", () => {
    expect(classifySyncFailure(apiError(401))).toBe("auth");
  });

  it("any other 4xx is a real refusal", () => {
    for (const status of [400, 403, 404, 409, 422]) {
      expect(classifySyncFailure(apiError(status))).toBe("rejected");
    }
  });
});

describe("describeSyncFailure", () => {
  it("keeps the status and the server's message", () => {
    const record = describeSyncFailure(apiError(422));
    expect(record.status).toBe(422);
    expect(record.message).toBe("status 422");
    expect(() => new Date(record.at).toISOString()).not.toThrow();
  });

  it("a network failure has no status", () => {
    expect(describeSyncFailure(new ApiNetworkError("offline")).status).toBeNull();
  });
});
