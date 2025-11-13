/**
 * Query Parameters Utilities
 *
 * Centralized utilities for building URLSearchParams from filter objects.
 * Following DRY principle to avoid code duplication across hooks.
 */

/**
 * Build URLSearchParams from a filter object
 * Filters out undefined, null, and empty string values
 *
 * @param filters - Filter object with key-value pairs
 * @returns URLSearchParams instance
 *
 * @example
 * const params = buildQueryParams({ search: "test", sortBy: "name", category: undefined });
 * // Returns URLSearchParams with search=test&sortBy=name
 */
export function buildQueryParams(filters: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    // Skip undefined, null, and empty string values
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });

  return params;
}

/**
 * Build query string from filters
 * Convenience function that returns the string representation
 *
 * @param filters - Filter object with key-value pairs
 * @returns Query string (without leading ?)
 *
 * @example
 * const queryString = buildQueryString({ search: "test", sortBy: "name" });
 * // Returns "search=test&sortBy=name"
 */
export function buildQueryString(filters: Record<string, unknown>): string {
  const params = buildQueryParams(filters);
  return params.toString();
}

