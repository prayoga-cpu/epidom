/**
 * API Error Handler Tests
 *
 * Tests for centralized API error handling utility.
 */

import { describe, it, expect, vi } from "vitest";
import { ZodError, z } from "zod";
import { handleApiError } from "../api-error-handler";
import { ApiErrorCode } from "@/types/api/responses";

describe("handleApiError", () => {
  const defaultOptions = {
    endpoint: "GET /api/test",
    context: { testId: "123" },
  };

  describe("Zod validation errors", () => {
    it("should return 400 for ZodError", async () => {
      const schema = z.object({ name: z.string().min(2) });
      let zodError: ZodError | null = null;

      try {
        schema.parse({ name: "" });
      } catch (error) {
        zodError = error as ZodError;
      }

      const response = handleApiError(zodError, defaultOptions);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(body.error.details).toBeDefined();
    });
  });

  describe("Not found errors", () => {
    it("should return 404 for 'not found' message", async () => {
      const error = new Error("Material not found");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it("should return 404 for 'does not exist' message", async () => {
      const error = new Error("User does not exist");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(404);
    });
  });

  describe("Conflict errors", () => {
    it("should return 409 for 'already exists' message", async () => {
      const error = new Error("A material with this SKU already exists");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    });

    it("should return 409 for 'duplicate' message", async () => {
      const error = new Error("Duplicate entry");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(409);
    });
  });

  describe("Authorization errors", () => {
    it("should return 403 for 'unauthorized' message", async () => {
      const error = new Error("Unauthorized access");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.FORBIDDEN);
    });

    it("should return 403 for 'does not belong' message", async () => {
      const error = new Error("Store does not belong to this user");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(403);
    });
  });

  describe("Stock errors", () => {
    it("should return 400 for insufficient stock", async () => {
      const error = new Error("Insufficient stock for this operation");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.INSUFFICIENT_STOCK);
    });
  });

  describe("Subscription errors", () => {
    it("should return 403 for subscription limit", async () => {
      const error = new Error("Plan limit exceeded. Please upgrade your subscription.");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
    });
  });

  describe("Database errors", () => {
    it("should return 503 for timeout errors", async () => {
      const error = new Error("Transaction timeout after 10000ms");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.DATABASE_ERROR);
    });
  });

  describe("Generic errors", () => {
    it("should return 500 for unknown errors", async () => {
      const error = new Error("Something unexpected happened");
      const response = handleApiError(error, defaultOptions);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
    });

    it("should return 500 for non-Error objects", async () => {
      const response = handleApiError("string error", defaultOptions);

      expect(response.status).toBe(500);
    });
  });

  describe("Custom messages", () => {
    it("should use custom messages when provided", async () => {
      const error = new Error("Material not found");
      const response = handleApiError(error, {
        ...defaultOptions,
        customMessages: {
          notFound: "Custom not found message",
        },
      });

      const body = await response.json();
      expect(body.error.message).toBe("Custom not found message");
    });
  });
});
