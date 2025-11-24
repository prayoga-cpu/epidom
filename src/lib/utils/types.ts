/**
 * Client-Safe Type Helpers
 *
 * Utility types and functions for type safety improvements.
 * These helpers are safe to use in both client and server components.
 *
 * ⚠️ For server-only helpers (Decimal conversion), use `@/lib/utils/types.server`
 */

import type { AppError, SubscriptionError } from "@/types/errors";

/**
 * Convert Prisma Decimal to number (client-safe)
 * Works with Decimal objects, strings, numbers, or null/undefined
 */
export function decimalToNumber(
  decimal: unknown
): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }
  if (typeof decimal === "number") {
    return decimal;
  }
  if (typeof decimal === "string") {
    return parseFloat(decimal) || 0;
  }
  // If it's a Decimal object, try to convert it
  if (typeof decimal === "object" && decimal !== null && "toNumber" in decimal && typeof (decimal as { toNumber: () => number }).toNumber === "function") {
    return (decimal as { toNumber: () => number }).toNumber();
  }
  return 0;
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for AppError (custom error type)
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && "code" in error && "statusCode" in error;
}

/**
 * Type guard for SubscriptionError
 */
export function isSubscriptionError(error: unknown): error is SubscriptionError {
  return (
    isAppError(error) &&
    error.code === "SUBSCRIPTION_FEATURE_LOCKED" &&
    "upgradeRequired" in error
  );
}

/**
 * Type guard for Date objects
 * Use this instead of instanceof Date for better type narrowing
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date || (typeof value === "object" && value !== null && "getTime" in value && typeof (value as Date).getTime === "function");
}

/**
 * Type guard for objects with a specific property
 */
export function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return typeof obj === "object" && obj !== null && prop in obj;
}

/**
 * Type guard for API error responses
 */
export function isApiErrorResponse(obj: unknown): obj is {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "success" in obj &&
    obj.success === false &&
    "error" in obj &&
    typeof obj.error === "object" &&
    obj.error !== null &&
    "code" in obj.error &&
    "message" in obj.error
  );
}

/**
 * Type guard for error objects with a specific code
 */
export function isErrorWithCode<T extends string>(
  error: unknown,
  code: T
): error is { code: T; message: string; [key: string]: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (isApiErrorResponse(error)) {
    return error.error.message;
  }
  return "An unknown error occurred";
}

/**
 * Type helper for Prisma include types
 */
export type PrismaInclude<T> = {
  [K in keyof T]?: boolean | PrismaInclude<T[K]>;
};

/**
 * Type helper for making all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Type helper for extracting the return type of a function
 */
export type ReturnType<T extends (...args: any[]) => any> = T extends (
  ...args: any[]
) => infer R
  ? R
  : never;

