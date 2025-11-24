/**
 * Utility functions for building and parsing filter query parameters for backend API calls
 */

import { PaginationParams } from "@/types/entities";
import { isDate } from "@/lib/utils/types";

// ============================================================================
// FILTER BUILDING
// ============================================================================

/**
 * Build URL query parameters from filter object
 */
export function buildQueryParams(filters: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return; // Skip empty values
    }

    if (Array.isArray(value)) {
      // Handle array values (e.g., multiple statuses, categories)
      value.forEach((v) => params.append(key, String(v)));
    } else if (value instanceof Date) {
      // Handle date values
      params.append(key, value.toISOString());
    } else if (typeof value === "object") {
      // Handle object values (e.g., date ranges)
      params.append(key, JSON.stringify(value));
    } else {
      params.append(key, String(value));
    }
  });

  return params;
}

/**
 * Build query string from filter object
 */
export function buildQueryString(filters: Record<string, any>): string {
  const params = buildQueryParams(filters);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Parse URL query parameters to filter object
 */
export function parseQueryParams(searchParams: URLSearchParams): Record<string, any> {
  const filters: Record<string, any> = {};

  searchParams.forEach((value, key) => {
    if (filters[key]) {
      // If key already exists, convert to array
      if (Array.isArray(filters[key])) {
        filters[key].push(value);
      } else {
        filters[key] = [filters[key], value];
      }
    } else {
      // Try to parse as JSON first
      try {
        filters[key] = JSON.parse(value);
      } catch {
        // If not JSON, use as string
        filters[key] = value;
      }
    }
  });

  return filters;
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Build pagination parameters
 */
export function buildPaginationParams(
  page: number = 1,
  limit: number = 10,
  sortBy?: string,
  sortOrder: "asc" | "desc" = "asc"
): PaginationParams {
  return {
    page,
    limit,
    sortBy,
    sortOrder,
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

// ============================================================================
// FILTER PRESET HELPERS
// ============================================================================

/**
 * Common filter presets
 */
export const FILTER_PRESETS = {
  stock: {
    all: {},
    lowStock: { stockStatus: "low" },
    criticalStock: { stockStatus: "critical" },
    overstock: { stockStatus: "excess" },
  },
  orders: {
    all: {},
    pending: { status: "pending" },
    processing: { status: "processing" },
    delivered: { status: "delivered" },
    unpaid: { paymentStatus: "pending" },
  },
  alerts: {
    all: {},
    active: { status: "active" },
    critical: { priority: "critical" },
    high: { priority: "high" },
    lowStock: { type: "low_stock" },
  },
  production: {
    all: {},
    inProgress: { status: "in_progress" },
    completed: { status: "completed" },
    failed: { status: "failed" },
  },
};

/**
 * Apply filter preset
 */
export function applyFilterPreset(
  presetCategory: keyof typeof FILTER_PRESETS,
  presetName: string,
  additionalFilters?: Record<string, any>
): Record<string, any> {
  const preset = FILTER_PRESETS[presetCategory];
  const presetFilters = preset[presetName as keyof typeof preset] || {};

  return {
    ...presetFilters,
    ...additionalFilters,
  };
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Get date range for common presets
 */
export function getDateRange(preset: "today" | "week" | "month" | "quarter" | "year"): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        from: today,
        to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case "week":
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return {
        from: weekStart,
        to: now,
      };

    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
      };

    case "quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      return {
        from: new Date(now.getFullYear(), quarter * 3, 1),
        to: now,
      };

    case "year":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: now,
      };

    default:
      return { from: today, to: now };
  }
}

/**
 * Get last N days date range
 */
export function getLastNDays(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);

  return { from, to };
}

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/**
 * Build search filter for multiple fields
 */
export function buildSearchFilter(searchTerm: string, fields: string[]): Record<string, any> {
  if (!searchTerm || searchTerm.trim() === "") {
    return {};
  }

  return {
    search: searchTerm,
    searchFields: fields,
  };
}

// ============================================================================
// SORTING HELPERS
// ============================================================================

/**
 * Toggle sort order
 */
export function toggleSortOrder(currentOrder: "asc" | "desc"): "asc" | "desc" {
  return currentOrder === "asc" ? "desc" : "asc";
}

/**
 * Build sort parameter
 */
export function buildSortParam(
  field: string,
  order: "asc" | "desc" = "asc"
): { sortBy: string; sortOrder: "asc" | "desc" } {
  return {
    sortBy: field,
    sortOrder: order,
  };
}

// ============================================================================
// CLIENT-SIDE FILTERING (for mock data)
// ============================================================================

/**
 * Filter array by search term across multiple fields
 */
export function filterBySearch<T extends Record<string, any>>(
  data: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] {
  if (!searchTerm || searchTerm.trim() === "") {
    return data;
  }

  const term = searchTerm.toLowerCase();

  return data.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(term);
    })
  );
}

/**
 * Filter array by field value(s)
 */
export function filterByField<T extends Record<string, any>>(
  data: T[],
  field: keyof T,
  value: any | any[]
): T[] {
  if (value === null || value === undefined || value === "") {
    return data;
  }

  if (Array.isArray(value)) {
    return data.filter((item) => value.includes(item[field]));
  }

  return data.filter((item) => item[field] === value);
}

/**
 * Sort array by field
 */
export function sortByField<T extends Record<string, any>>(
  data: T[],
  field: keyof T,
  order: "asc" | "desc" = "asc"
): T[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    // Use type guard for Date comparison
    if (isDate(aVal) && isDate(bVal)) {
      return order === "asc" ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
    }

    return order === "asc" ? (aVal < bVal ? -1 : 1) : aVal > bVal ? -1 : 1;
  });

  return sorted;
}

/**
 * Paginate array
 */
export function paginateArray<T>(
  data: T[],
  page: number = 1,
  limit: number = 10
): { data: T[]; meta: ReturnType<typeof calculatePaginationMeta> } {
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedData = data.slice(start, end);
  const meta = calculatePaginationMeta(data.length, page, limit);

  return {
    data: paginatedData,
    meta,
  };
}

/**
 * Apply all filters to an array (for client-side mock data)
 */
export function applyFilters<T extends Record<string, any>>(
  data: T[],
  filters: {
    search?: string;
    searchFields?: (keyof T)[];
    filterFields?: Record<keyof T, any>;
    sortBy?: keyof T;
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
  }
): { data: T[]; meta: ReturnType<typeof calculatePaginationMeta> } {
  let filtered = [...data];

  // Apply search filter
  if (filters.search && filters.searchFields) {
    filtered = filterBySearch(filtered, filters.search, filters.searchFields);
  }

  // Apply field filters
  if (filters.filterFields) {
    Object.entries(filters.filterFields).forEach(([field, value]) => {
      filtered = filterByField(filtered, field as keyof T, value);
    });
  }

  // Apply sorting
  if (filters.sortBy) {
    filtered = sortByField(filtered, filters.sortBy, filters.sortOrder || "asc");
  }

  // Apply pagination
  const page = filters.page || 1;
  const limit = filters.limit || 10;

  return paginateArray(filtered, page, limit);
}
