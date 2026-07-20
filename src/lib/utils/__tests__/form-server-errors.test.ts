import { describe, it, expect, vi } from "vitest";
import { applyServerFieldErrors } from "../form-server-errors";
import { ApiClientError } from "@/lib/api/client";
import { ApiErrorCode } from "@/types/api/responses";

function makeForm() {
  return { setError: vi.fn() } as any;
}

describe("applyServerFieldErrors", () => {
  it("returns null for a plain Error (no field details)", () => {
    const form = makeForm();
    const result = applyServerFieldErrors(form, new Error("network error"));
    expect(result).toBeNull();
    expect(form.setError).not.toHaveBeenCalled();
  });

  it("returns null for an ApiClientError with no details", () => {
    const form = makeForm();
    const error = new ApiClientError(
      {
        success: false,
        error: { code: ApiErrorCode.VALIDATION_ERROR, message: "Invalid input data" },
      },
      400
    );
    const result = applyServerFieldErrors(form, error);
    expect(result).toBeNull();
    expect(form.setError).not.toHaveBeenCalled();
  });

  it("sets a field error per detail and returns a readable summary", () => {
    const form = makeForm();
    const error = new ApiClientError(
      {
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: "Invalid input data",
          details: [
            { field: "sku", message: "SKU is required" },
            {
              field: "minStock",
              message: "Minimum stock must be less than or equal to maximum stock",
            },
          ],
        },
      },
      400
    );

    const result = applyServerFieldErrors(form, error);

    expect(form.setError).toHaveBeenCalledTimes(2);
    expect(form.setError).toHaveBeenCalledWith("sku", {
      type: "server",
      message: "SKU is required",
    });
    expect(form.setError).toHaveBeenCalledWith("minStock", {
      type: "server",
      message: "Minimum stock must be less than or equal to maximum stock",
    });
    expect(result).toBe(
      "sku: SKU is required · minStock: Minimum stock must be less than or equal to maximum stock"
    );
  });
});
