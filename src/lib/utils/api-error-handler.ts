/**
 * API Error Handler Utility
 *
 * Provides consistent error handling for API routes with proper logging
 * and user-friendly error responses.
 *
 * Supports:
 * - Typed AppError classes (thrown by services)
 * - Zod validation errors
 * - Generic Error objects (pattern-matched by message)
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

interface ErrorHandlerOptions {
  endpoint: string;
  context?: Record<string, unknown>;
  customMessages?: Record<string, string>;
}

/**
 * Handle API errors with proper logging and user-friendly responses
 *
 * Priority order:
 * 1. AppError (typed application errors) - highest priority
 * 2. ZodError (validation errors)
 * 3. Error (pattern-matched by message content)
 * 4. Unknown errors (fallback to 500)
 *
 * @example
 * ```ts
 * // In service:
 * throw new StoreLimitExceededError(1, 1);
 *
 * // In API route (via withApiHandler):
 * // Automatically caught and converted to 403 response
 * ```
 */
export function handleApiError(error: unknown, options: ErrorHandlerOptions): NextResponse {
  const { endpoint, context = {}, customMessages = {} } = options;

  // ========================================
  // Handle Typed Application Errors (AppError)
  // ========================================
  // These are thrown by services for specific business logic errors
  if (error instanceof AppError) {
    // Log server errors (5xx) but not client errors (4xx)
    if (error.statusCode >= 500) {
      logger.error(`${error.name} at ${endpoint}`, error, context);
    }

    return NextResponse.json(createErrorResponse(error.code, error.message, error.details), {
      status: error.statusCode,
    });
  }

  // ========================================
  // Handle Zod Validation Errors
  // ========================================
  if (error instanceof ZodError) {
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        customMessages.validation || "Invalid input data",
        error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }))
      ),
      { status: 400 }
    );
  }

  // ========================================
  // Handle Generic Error Objects (Legacy/Fallback)
  // ========================================
  // Pattern-matching by error message content
  // This is kept for backward compatibility with existing error throws
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for specific error patterns
    if (message.includes("not found") || message.includes("does not exist")) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, customMessages.notFound || error.message),
        { status: 404 }
      );
    }

    if (
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("sku already exists")
    ) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          customMessages.conflict || error.message
        ),
        { status: 409 }
      );
    }

    if (
      message.includes("unauthorized") ||
      message.includes("permission") ||
      message.includes("does not belong")
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, customMessages.forbidden || error.message),
        { status: 403 }
      );
    }

    if (
      message.includes("insufficient") ||
      message.includes("not enough") ||
      message.includes("stock")
    ) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INSUFFICIENT_STOCK,
          customMessages.insufficient || error.message
        ),
        { status: 400 }
      );
    }

    if (
      message.includes("subscription") ||
      message.includes("plan limit") ||
      message.includes("upgrade")
    ) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
          customMessages.subscription || error.message
        ),
        { status: 403 }
      );
    }

    // Database/timeout errors
    if (
      message.includes("timeout") ||
      message.includes("deadlock") ||
      message.includes("lock") ||
      message.includes("p2034") ||
      message.includes("p2024")
    ) {
      logger.error(`Database error at ${endpoint}`, error, context);
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.DATABASE_ERROR,
          customMessages.database || "The request is taking too long. Please try again in a moment."
        ),
        { status: 503 }
      );
    }
  }

  // Log unexpected errors for monitoring
  logger.error(`Unexpected error at ${endpoint}`, error, context);

  // Return generic error response
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      customMessages.internal || "An unexpected error occurred. Please try again later."
    ),
    { status: 500 }
  );
}
