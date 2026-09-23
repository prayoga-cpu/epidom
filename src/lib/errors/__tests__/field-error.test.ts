import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { handleApiError } from "@/lib/utils/api-error-handler";
import { FieldConflictError, FieldError } from "../field-error";
import { ApiErrorCode } from "@/types/api/responses";

describe("FieldError", () => {
  it("reaches the client as { field, message }[] — the shape applyServerFieldErrors reads", async () => {
    const res = handleApiError(new FieldError("phone", "Enter a valid phone number"), {
      endpoint: "/x",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(body.error.message).toBe("Enter a valid phone number");
    expect(body.error.details).toEqual([{ field: "phone", message: "Enter a valid phone number" }]);
  });

  it("FieldConflictError is HTTP 409 with the CONFLICT code", async () => {
    const res = handleApiError(new FieldConflictError("code", "already exists"), {
      endpoint: "/x",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(ApiErrorCode.CONFLICT);
    expect(body.error.details).toEqual([{ field: "code", message: "already exists" }]);
  });
});
