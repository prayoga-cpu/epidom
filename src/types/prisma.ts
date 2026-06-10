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

/**
 * Deeply transforms a type, replacing all instances of Prisma.Decimal with number.
 * This is used for safe serialization of server data to client components.
 */
export type SerializeDecimal<T> = T extends Prisma.Decimal
  ? number
  : T extends { s: number; e: number; d: number[] }
  ? number
  : T extends Date
  ? T // Preserve Date objects as they are serialized by Next.js automatically
  : T extends Array<infer U>
  ? Array<SerializeDecimal<U>>
  : T extends object
  ? { [K in keyof T]: SerializeDecimal<T[K]> }
  : T;

export function deepSerializeDecimal<T>(obj: T): SerializeDecimal<T> {
  if (obj === null || obj === undefined) return obj as any;
  
  if (isPrismaDecimal(obj)) {
    return decimalToNumber(obj) as any;
  }
  
  // Duck typing for Decimal.js internally
  if (typeof obj === 'object' && obj !== null && 'd' in obj && 'e' in obj && 's' in obj && Array.isArray((obj as any).d)) {
    return decimalToNumber(obj as any) as any;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerializeDecimal) as any;
  }

  if (typeof obj === 'object') {
    const serialized = {} as any;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerializeDecimal((obj as any)[key]);
      }
    }
    return serialized;
  }

  return obj as any;
}
