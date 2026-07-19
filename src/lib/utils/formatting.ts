/**
 * Utility functions for formatting dates, numbers, currency, and units
 */

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { enUS, fr, id } from "date-fns/locale";

// ============================================================================
// DATE FORMATTING
// ============================================================================

const locales = { en: enUS, fr: fr, id: id };

/**
 * Format a date to a readable string
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = "PP",
  locale: "en" | "fr" | "id" = "en"
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  try {
    return format(dateObj, formatStr, { locale: locales[locale] });
  } catch (error) {
    return "";
  }
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  locale: "en" | "fr" | "id" = "en"
): string {
  return formatDate(date, "PPp", locale);
}

/**
 * Format date only (no time)
 */
export function formatDateOnly(
  date: Date | string | null | undefined,
  locale: "en" | "fr" | "id" = "en"
): string {
  return formatDate(date, "PP", locale);
}

/**
 * Format time only (no date)
 */
export function formatTimeOnly(
  date: Date | string | null | undefined,
  locale: "en" | "fr" | "id" = "en"
): string {
  return formatDate(date, "p", locale);
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
  locale: "en" | "fr" | "id" = "en"
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  try {
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: locales[locale],
    });
  } catch (error) {
    return "";
  }
}

/**
 * Format duration given in minutes to "Xh Ym" format
 */
export const formatDuration = (minutes: number | undefined) => {
  if (minutes === undefined || minutes === null) return "—";
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0) {
    return `${h}h${rem > 0 ? ` ${rem}m` : ""}`;
  }
  return `${rem}m`;
};

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  try {
    return format(dateObj, "yyyy-MM-dd");
  } catch (error) {
    return "";
  }
}

/**
 * Format datetime for input fields (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeForInput(date: Date | string | null | undefined): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  try {
    return format(dateObj, "yyyy-MM-dd'T'HH:mm");
  } catch (error) {
    return "";
  }
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format a number with specified decimal places
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  locale: string = "en-US"
): string {
  if (value === null || value === undefined) return "";

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return "";

  return `${formatNumber(value, decimals)}%`;
}

/**
 * Format a large number with abbreviations (K, M, B)
 */
export function formatCompactNumber(
  value: number | null | undefined,
  locale: string = "en-US"
): string {
  if (value === null || value === undefined) return "";

  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

export type Currency = string;

/**
 * Regional display conventions that deliberately diverge from the ISO 4217
 * minor-unit default (e.g. Indonesian retail drops Rupiah's 2 decimal
 * places). Any currency not listed here uses Intl's own default.
 */
const FRACTION_DIGITS_OVERRIDE: Partial<Record<string, number>> = {
  IDR: 0,
};

/**
 * Under the "en-US" locale, Intl correctly falls back to the bare ISO code
 * for currencies with no widely-recognized English symbol (e.g. IDR renders
 * as "IDR", not "Rp" — "Rp" is specifically an id-ID locale convention).
 * Override just the ones this app displays constantly.
 */
const SYMBOL_OVERRIDE: Partial<Record<string, string>> = {
  IDR: "Rp",
};

/**
 * Get currency symbol for display in labels and inputs. Works for any valid
 * ISO 4217 code via Intl — no hardcoded per-currency map to maintain.
 */
export function getCurrencySymbol(currency: Currency): string {
  if (SYMBOL_OVERRIDE[currency]) return SYMBOL_OVERRIDE[currency];
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Format a number as currency (legacy function - kept for backward compatibility)
 * For new components, prefer using useCurrency().formatPrice() from CurrencyProvider
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = "IDR",
  locale: string = "id-ID"
): string {
  if (value === null || value === undefined) return "";
  const fractionDigits = FRACTION_DIGITS_OVERRIDE[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(fractionDigits !== undefined
      ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }
      : {}),
  }).format(value);
}

/**
 * Format currency without symbol (just formatted number)
 */
export function formatCurrencyValue(
  value: number | null | undefined,
  decimals: number = 2,
  locale: string = "fr-FR"
): string {
  if (value === null || value === undefined) return "";

  return formatNumber(value, decimals, locale);
}

// ============================================================================
// UNIT FORMATTING
// ============================================================================

/**
 * Format a value with its unit
 */
export function formatWithUnit(
  value: number | null | undefined,
  unit: string,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return "";

  return `${formatNumber(value, decimals)} ${unit}`;
}

/**
 * Convert grams to kilograms if appropriate
 */
export function formatWeight(value: number, unit: "g" | "kg"): string {
  if (unit === "g" && value >= 1000) {
    return formatWithUnit(value / 1000, "kg");
  }
  if (unit === "kg" && value < 1) {
    return formatWithUnit(value * 1000, "g", 0);
  }
  return formatWithUnit(value, unit);
}

/**
 * Convert milliliters to liters if appropriate
 */
export function formatVolume(value: number, unit: "ml" | "l"): string {
  if (unit === "ml" && value >= 1000) {
    return formatWithUnit(value / 1000, "L");
  }
  if (unit === "l" && value < 1) {
    return formatWithUnit(value * 1000, "mL", 0);
  }
  return formatWithUnit(value, unit);
}

// ============================================================================
// FILE SIZE FORMATTING
// ============================================================================

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${formatNumber(bytes / Math.pow(k, i), 2)} ${units[i]}`;
}

// ============================================================================
// TEXT FORMATTING
// ============================================================================

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string | null | undefined, length: number = 50): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // Format based on length
  if (cleaned.length === 10) {
    // Format as: (XXX) XXX-XXXX
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }

  // Return original if not standard format
  return phone;
}

// ============================================================================
// STATUS FORMATTING
// ============================================================================

/**
 * Format status string for display
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return "";
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get color class for status badges
 */
export function getStatusColor(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const statusLower = status.toLowerCase();

  if (
    statusLower.includes("completed") ||
    statusLower.includes("delivered") ||
    statusLower.includes("paid")
  ) {
    return "default";
  }
  if (
    statusLower.includes("pending") ||
    statusLower.includes("in_progress") ||
    statusLower.includes("processing")
  ) {
    return "secondary";
  }
  if (
    statusLower.includes("failed") ||
    statusLower.includes("cancelled") ||
    statusLower.includes("critical")
  ) {
    return "destructive";
  }
  return "outline";
}

// ============================================================================
// STOCK STATUS HELPERS
// ============================================================================

/**
 * Get stock status based on current, min, and max values
 */
export function getStockStatus(
  current: number,
  min: number,
  max: number
): "critical" | "low" | "ok" | "excess" {
  if (current === 0) return "critical";
  if (current < min) return "critical";
  if (current < min * 1.5) return "low";
  if (current > max) return "excess";
  return "ok";
}

/**
 * Get stock status color
 */
export function getStockStatusColor(status: "critical" | "low" | "ok" | "excess"): string {
  switch (status) {
    case "critical":
      return "text-destructive";
    case "low":
      return "text-orange-500";
    case "ok":
      return "text-green-500";
    case "excess":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Calculate stock percentage
 */
export function calculateStockPercentage(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.min((current / max) * 100, 100);
}
