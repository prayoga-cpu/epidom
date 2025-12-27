/**
 * Database Configuration Constants
 *
 * Centralized configuration for database operations, especially
 * transaction timeouts optimized for Neon serverless PostgreSQL.
 *
 * Why these values?
 * - Neon can have cold start latency (500ms-2s)
 * - Connection pooling has limits
 * - Long-running transactions should be avoided in serverless
 */

/**
 * Transaction timeout configuration type
 */
interface TransactionConfig {
  /** Max time to wait for transaction to start (ms) */
  maxWait: number;
  /** Max time for transaction to complete (ms) */
  timeout: number;
}

/**
 * Transaction timeout configurations
 *
 * Use appropriate config based on operation complexity:
 * - SHORT: Simple CRUD operations (create, update, delete)
 * - MEDIUM: Multi-table operations (production batch start/complete)
 * - LONG: Complex operations with many queries (bulk operations, reports)
 */
export const TRANSACTION_CONFIG: Record<"SHORT" | "MEDIUM" | "LONG", TransactionConfig> = {
  /**
   * Short transactions (5s wait, 10s execute)
   * Use for: Single entity CRUD, simple updates
   */
  SHORT: {
    maxWait: 5000,
    timeout: 10000,
  },

  /**
   * Medium transactions (10s wait, 20s execute)
   * Use for: Multi-entity operations, production batch workflows
   */
  MEDIUM: {
    maxWait: 10000,
    timeout: 20000,
  },

  /**
   * Long transactions (15s wait, 30s execute)
   * Use for: Bulk operations, data migrations, reports
   */
  LONG: {
    maxWait: 15000,
    timeout: 30000,
  },
};

/**
 * Default pagination limits
 */
export const PAGINATION = {
  /** Default items per page */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum allowed items per page */
  MAX_PAGE_SIZE: 100,
  /** Default page number */
  DEFAULT_PAGE: 1,
} as const;

/**
 * Query caching configuration (for React Query)
 */
export const CACHE_CONFIG = {
  /** Master data (materials, products, recipes) - can be stale for 5 min */
  MASTER_DATA: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  },
  /** Transactional data (orders, batches) - should be fresh */
  TRANSACTIONAL: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  /** Real-time data (stock levels, alerts) - always fresh */
  REALTIME: {
    staleTime: 0, // Always considered stale
    gcTime: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Retry configuration for different operation types
 */
export const RETRY_CONFIG = {
  /** Standard operations */
  STANDARD: {
    retries: 3,
    delay: 1000,
    maxDelay: 10000,
  },
  /** Critical operations that must succeed */
  CRITICAL: {
    retries: 5,
    delay: 2000,
    maxDelay: 30000,
  },
  /** Fast operations that should fail quickly */
  FAST: {
    retries: 2,
    delay: 500,
    maxDelay: 2000,
  },
} as const;
