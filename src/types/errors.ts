/**
 * Custom error types for the application
 *
 * Provides type-safe error handling with proper error codes and context
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Subscription-related errors
 */
export class SubscriptionError extends AppError {
  constructor(
    message: string,
    public readonly upgradeRequired: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, "SUBSCRIPTION_FEATURE_LOCKED", 403, {
      upgradeRequired,
      ...context,
    });
    this.name = "SubscriptionError";
  }
}

/**
 * API errors
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number = 400,
    code: string = "API_ERROR",
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, context);
    this.name = "ApiError";
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string[]>,
    context?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", 400, {
      fields,
      ...context,
    });
    this.name = "ValidationError";
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    resource?: string,
    context?: Record<string, unknown>
  ) {
    super(message, "NOT_FOUND", 404, {
      resource,
      ...context,
    });
    this.name = "NotFoundError";
  }
}

/**
 * Unauthorized errors
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Unauthorized",
    context?: Record<string, unknown>
  ) {
    super(message, "UNAUTHORIZED", 401, context);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden errors
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Forbidden",
    context?: Record<string, unknown>
  ) {
    super(message, "FORBIDDEN", 403, context);
    this.name = "ForbiddenError";
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, "DATABASE_ERROR", 500, {
      originalError: originalError?.message,
      ...context,
    });
    this.name = "DatabaseError";
  }
}

/**
 * Helper function to create subscription error
 */
export function createSubscriptionError(
  message: string,
  upgradeRequired: boolean = true
): SubscriptionError {
  return new SubscriptionError(message, upgradeRequired);
}

/**
 * Helper function to check if error is of a specific type
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper function to get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Helper function to get error status code safely
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }
  return 500;
}

