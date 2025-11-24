/**
 * Server-Only Type Helpers
 *
 * Type helpers that require Node.js built-in modules or Prisma.
 * These should ONLY be used in server-side code (API routes, Server Components, services).
 */

import { Prisma } from "@prisma/client";

/**
 * Convert number to Prisma Decimal for database operations
 * This is the type-safe way to convert numbers to Prisma Decimal without `as any`
 *
 * ⚠️ SERVER-ONLY: This function uses Prisma Decimal which requires Node.js built-in modules
 */
export function toDecimal(value: number | string | null | undefined): Prisma.Decimal {
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
 * Type helper for Prisma update operations with Decimal fields
 * Converts number values to Prisma.Decimal for type-safe updates
 *
 * ⚠️ SERVER-ONLY: This function uses Prisma Decimal which requires Node.js built-in modules
 */
export function toPrismaDecimal<T extends Record<string, unknown>>(
  data: T
): {
  [K in keyof T]: T[K] extends number ? Prisma.Decimal : T[K];
} {
  const result = {} as {
    [K in keyof T]: T[K] extends number ? Prisma.Decimal : T[K];
  };

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "number") {
      (result as Record<string, unknown>)[key] = toDecimal(value);
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Convert number to Prisma Decimal (alias for toDecimal)
 *
 * ⚠️ SERVER-ONLY: This function uses Prisma Decimal which requires Node.js built-in modules
 */
export function numberToDecimal(value: number | string | null | undefined): Prisma.Decimal {
  return toDecimal(value);
}

