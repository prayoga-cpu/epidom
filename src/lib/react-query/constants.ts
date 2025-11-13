/**
 * React Query Cache Constants
 *
 * Centralized cache time constants to ensure consistency across all hooks.
 * Following DRY principle to avoid magic numbers scattered throughout the codebase.
 *
 * Rationale:
 * - REAL_TIME: For data that changes frequently and needs to be up-to-date (alerts, notifications)
 * - STANDARD: For most inventory data (materials, products, recipes, suppliers) - 1 minute is good balance
 * - LONG_LIVED: For user profile data that rarely changes - 5 minutes is sufficient
 */

export const CACHE_TIMES = {
  /** 30 seconds - For real-time data that needs frequent updates (alerts, notifications) */
  REAL_TIME: 30 * 1000,
  /** 1 minute - Standard cache time for most inventory data (materials, products, recipes, suppliers) */
  STANDARD: 60 * 1000,
  /** 5 minutes - For data that rarely changes (user profile, business info) */
  LONG_LIVED: 5 * 60 * 1000,
} as const;

/**
 * Garbage Collection Time (gcTime) - How long unused data stays in cache
 * Standard: 5 minutes - Good balance between memory usage and cache hits
 */
export const GC_TIME = {
  /** 5 minutes - Standard garbage collection time */
  STANDARD: 5 * 60 * 1000,
  /** 10 minutes - For long-lived data that might be accessed again soon */
  LONG_LIVED: 10 * 60 * 1000,
} as const;

/**
 * Default React Query options for consistency
 */
export const DEFAULT_QUERY_OPTIONS = {
  /** Standard query options for inventory data */
  inventory: {
    staleTime: CACHE_TIMES.STANDARD,
    gcTime: GC_TIME.STANDARD,
    refetchOnWindowFocus: false, // Don't refetch on window focus for inventory data
    refetchOnMount: true, // Refetch on mount to ensure fresh data
  },
  /** Real-time query options for alerts and notifications */
  realTime: {
    staleTime: CACHE_TIMES.REAL_TIME,
    gcTime: GC_TIME.STANDARD,
    refetchOnWindowFocus: true, // Refetch on window focus for real-time data
    refetchOnMount: true,
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  },
  /** Long-lived query options for user profile */
  profile: {
    staleTime: CACHE_TIMES.LONG_LIVED,
    gcTime: GC_TIME.LONG_LIVED,
    refetchOnWindowFocus: false, // Don't refetch on window focus for profile
    refetchOnMount: false, // Don't refetch on mount if data exists
  },
} as const;

