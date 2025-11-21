/**
 * Query Key Helpers
 *
 * Utilities untuk normalize query keys dan prevent cache fragmentation.
 * Best practice: Normalize filter objects sebelum digunakan di queryKey.
 */

/**
 * Normalize filter object untuk consistent query keys
 * Removes undefined/null values dan sorts keys untuk consistent serialization
 *
 * Prevents cache fragmentation dari filter object reference changes.
 * Example: { search: "test", sortBy: "name" } dan { sortBy: "name", search: "test" }
 * akan menghasilkan query key yang sama.
 */
export function normalizeFilters<T extends Record<string, any>>(
  filters?: T
): T | undefined {
  if (!filters) return undefined;

  const normalized: Record<string, unknown> = {};

  // Sort keys untuk consistent order
  const sortedKeys = Object.keys(filters).sort();

  for (const key of sortedKeys) {
    const value = filters[key];
    // Only include defined values
    if (value !== undefined && value !== null && value !== "") {
      normalized[key] = value;
    }
  }

  // Return undefined if empty (for cleaner query keys)
  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized as T;
}

