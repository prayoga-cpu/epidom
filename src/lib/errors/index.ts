/**
 * Custom Application Errors
 *
 * These errors are thrown by services and automatically mapped
 * to appropriate HTTP responses by handleApiError().
 *
 * Benefits:
 * - Type-safe error handling
 * - Consistent HTTP response mapping
 * - Business logic stays in services
 * - Testable error conditions
 */

import { ApiErrorCode } from "@/types/api/responses";

// ============================================
// Base Error Class
// ============================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================
// Authentication & Authorization Errors
// ============================================

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, ApiErrorCode.UNAUTHORIZED, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, ApiErrorCode.FORBIDDEN, 403);
  }
}

// ============================================
// Resource Errors
// ============================================

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      ApiErrorCode.NOT_FOUND,
      404,
      { resource, id }
    );
  }
}

export class BusinessNotFoundError extends AppError {
  constructor() {
    super("Business not found", ApiErrorCode.BUSINESS_NOT_FOUND, 404);
  }
}

export class StoreNotFoundError extends AppError {
  constructor(storeId?: string) {
    super(
      storeId ? `Store with id '${storeId}' not found` : "Store not found",
      ApiErrorCode.STORE_NOT_FOUND,
      404,
      { storeId }
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ApiErrorCode.VALIDATION_ERROR, 409, details);
  }
}

export class DuplicateError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      ApiErrorCode.VALIDATION_ERROR,
      409,
      { resource, field, value }
    );
  }
}

// ============================================
// Business Logic Errors
// ============================================

export class StoreLimitExceededError extends AppError {
  constructor(current: number, limit: number) {
    super(
      `Store limit exceeded. You have ${current}/${limit} stores. Please upgrade your plan.`,
      ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
      403,
      { current, limit, upgradeRequired: true }
    );
  }
}

export class ProductLimitExceededError extends AppError {
  constructor(current: number, limit: number) {
    super(
      `Product limit exceeded. You have ${current}/${limit} products.`,
      ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
      403,
      { current, limit, upgradeRequired: true }
    );
  }
}

export class InsufficientStockError extends AppError {
  constructor(materialName: string, required: number, available: number) {
    super(
      `Insufficient stock for '${materialName}'. Required: ${required}, Available: ${available}`,
      ApiErrorCode.INSUFFICIENT_STOCK,
      400,
      { materialName, required, available }
    );
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(feature: string) {
    super(
      `Active subscription required to access ${feature}`,
      ApiErrorCode.SUBSCRIPTION_REQUIRED,
      403,
      { feature }
    );
  }
}

export class SubscriptionInactiveError extends AppError {
  constructor() {
    super(
      "Your subscription is not active. Please subscribe to continue.",
      ApiErrorCode.SUBSCRIPTION_REQUIRED,
      403
    );
  }
}

// ============================================
// Validation Errors
// ============================================

export class ValidationError extends AppError {
  constructor(message: string, fields?: Array<{ field: string; message: string }>) {
    super(message, ApiErrorCode.VALIDATION_ERROR, 400, { fields });
  }
}

// ============================================
// Database Errors
// ============================================

export class DatabaseError extends AppError {
  constructor(message = "A database error occurred. Please try again.") {
    super(message, ApiErrorCode.DATABASE_ERROR, 503);
  }
}

export class DatabaseTimeoutError extends AppError {
  constructor() {
    super(
      "The request is taking too long. Please try again in a moment.",
      ApiErrorCode.DATABASE_ERROR,
      503
    );
  }
}

// ============================================
// Rate Limiting Errors
// ============================================

export class RateLimitExceededError extends AppError {
  constructor(resetInSeconds: number) {
    super(
      `Rate limit exceeded. Please try again in ${resetInSeconds} seconds.`,
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      { resetInSeconds }
    );
  }
}
