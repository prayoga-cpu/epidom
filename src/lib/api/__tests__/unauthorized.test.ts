import { describe, it, expect } from "vitest";
import { ApiClientError } from "../client";
import { UnauthorizedError, isUnauthorizedError } from "../unauthorized";

const envelope = (code: string, message: string) =>
  ({ success: false, error: { code, message } }) as never;

describe("isUnauthorizedError", () => {
  it("recognises the error thrown for a 401", () => {
    const error = new UnauthorizedError();
    expect(error.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("recognises a 401 carried by the shared ApiClientError", () => {
    expect(
      isUnauthorizedError(new ApiClientError(envelope("UNAUTHORIZED", "Unauthorized"), 401))
    ).toBe(true);
  });

  it("does not treat 'signed in but not allowed' or a server fault as signed out", () => {
    expect(isUnauthorizedError(new ApiClientError(envelope("FORBIDDEN", "No"), 403))).toBe(false);
    expect(isUnauthorizedError(new ApiClientError(envelope("INTERNAL", "Boom"), 500))).toBe(false);
    // A bare Error that merely SAYS Unauthorized is text, not a verdict.
    expect(isUnauthorizedError(new Error("Unauthorized"))).toBe(false);
  });

  it("is safe on anything that isn't an error", () => {
    for (const value of [null, undefined, "401", 401, {}, { status: 401 }]) {
      expect(isUnauthorizedError(value)).toBe(false);
    }
  });
});
