/**
 * Date formatting utilities
 *
 * Use these functions to format dates consistently across the app
 * to avoid hydration mismatches between server and client.
 *
 * IMPORTANT: Always use explicit locale to ensure consistent output
 * between server (Node.js) and client (browser).
 */

// Default locale for consistent formatting across server and client
const DEFAULT_LOCALE = "en-GB";

/**
 * Format a date to a localized date string
 * Uses "en-GB" locale for consistent DD/MM/YYYY format
 *
 * @param date - Date to format (Date object, ISO string, or null/undefined)
 * @returns Formatted date string or "-" for null/undefined
 *
 * @example
 * formatDate(new Date()) // "20/12/2024"
 * formatDate("2024-12-20T00:00:00Z") // "20/12/2024"
 * formatDate(null) // "-"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    return dateObj.toLocaleDateString(DEFAULT_LOCALE);
  } catch {
    return "-";
  }
}

/**
 * Format a date to a localized date and time string
 * Uses "en-GB" locale for consistent format
 *
 * @param date - Date to format
 * @returns Formatted date-time string or "-" for null/undefined
 *
 * @example
 * formatDateTime(new Date()) // "20/12/2024, 14:30:00"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    return dateObj.toLocaleString(DEFAULT_LOCALE);
  } catch {
    return "-";
  }
}

/**
 * Format a date with custom options
 *
 * @param date - The date to format
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string or "-" for null/undefined
 *
 * @example
 * formatDateCustom(new Date(), { month: "long", year: "numeric" }) // "December 2024"
 */
export function formatDateCustom(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  if (!date) return "-";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    return dateObj.toLocaleDateString(DEFAULT_LOCALE, options);
  } catch {
    return "-";
  }
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 * Useful for activity feeds and timestamps
 *
 * @param date - Date to format
 * @returns Relative time string or "-" for null/undefined
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "-";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return formatDate(dateObj);
    }
  } catch {
    return "-";
  }
}

/**
 * Format a date as ISO string (for API/data purposes)
 *
 * @param date - Date to format
 * @returns ISO date string or empty string for null/undefined
 */
export function formatISODate(date: Date | string | null | undefined): string {
  if (!date) return "";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    return dateObj.toISOString();
  } catch {
    return "";
  }
}
