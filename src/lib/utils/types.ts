/**
 * Type Helpers
 *
 * Utility types and functions for type safety improvements.
 * Helps reduce the need for `as any` type assertions.
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Convert Prisma Decimal to number
 */
export function decimalToNumber(decimal: Decimal | string | number | null | undefined): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }
  if (typeof decimal === "number") {
    return decimal;
  }
  if (typeof decimal === "string") {
    return parseFloat(decimal) || 0;
  }
  return decimal.toNumber();
}

/**
 * Convert number to Prisma Decimal
 */
export function numberToDecimal(value: number | string | null | undefined): Decimal {
  const { Decimal } = require("@prisma/client/runtime/library");
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  if (typeof value === "string") {
    return new Decimal(value);
  }
  return new Decimal(value);
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
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
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
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

