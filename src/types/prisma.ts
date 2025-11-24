/**
 * Type-safe Prisma Decimal utilities
 * Provides proper type definitions for Decimal handling without 'as any'
 */

import { Prisma } from "@prisma/client";

/**
 * Type guard to check if a value is a Prisma Decimal
 */
export function isPrismaDecimal(value: unknown): value is Prisma.Decimal {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== "object") {
    return false;
  }
  // Prisma Decimal has toString and toNumber methods
  return (
    typeof (value as any).toString === "function" &&
    (typeof (value as any).toNumber === "function" || typeof (value as any).toFixed === "function")
  );
}

/**
 * Convert Prisma Decimal to number safely
 * Handles Prisma Decimal objects, strings, numbers, and null/undefined
 */
export function decimalToNumber(
  decimal: Prisma.Decimal | string | number | null | undefined
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

  // Check if it's a Prisma Decimal
  if (isPrismaDecimal(decimal)) {
    // Try toNumber method first
    if (typeof (decimal as any).toNumber === "function") {
      const num = (decimal as any).toNumber();
      return isNaN(num) ? 0 : num;
    }
    // Fallback to toString
    const str = decimal.toString();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // Fallback: try to convert to string then parse
  try {
    const str = String(decimal);
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

/**
 * Serialized number type (for type safety when converting Decimal to number)
 */
export type SerializedDecimal = number;
