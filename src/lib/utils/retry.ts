/**
 * Retry Utility for Transient Errors
 *
 * Implements exponential backoff retry logic for database operations
 * that may fail due to transient issues (connection timeouts, pool exhaustion, etc.)
 *
 * Especially important for Neon serverless database which can have:
 * - Cold start latency
 * - Connection pool limitations
 * - Occasional statement timeouts
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  delay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: Error) => boolean;
  /** Optional callback for logging retry attempts */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default function to identify retryable errors
 *
 * These are typically transient errors that may succeed on retry:
 * - Connection errors (network issues, cold starts)
 * - Timeout errors (resource contention)
 * - Pool exhaustion (temporary overload)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Connection-related errors
  if (message.includes("connection")) return true;
  if (message.includes("econnrefused")) return true;
  if (message.includes("econnreset")) return true;
  if (message.includes("etimedout")) return true;
  if (message.includes("enotfound")) return true;

  // Timeout errors
  if (message.includes("timeout")) return true;
  if (message.includes("timed out")) return true;

  // Pool exhaustion
  if (message.includes("pool")) return true;
  if (message.includes("connection limit")) return true;

  // Prisma-specific transient errors
  if (message.includes("transaction not found")) return true;
  if (message.includes("unable to start a transaction")) return true;

  // Database temporary issues
  if (message.includes("temporarily unavailable")) return true;
  if (message.includes("too many connections")) return true;

  return false;
}

/**
 * Sleep utility for delay between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 *
 * Uses exponential backoff: delay doubles on each retry up to maxDelay
 *
 * @example
 * // Simple usage
 * const result = await withRetry(() => prisma.user.findMany());
 *
 * @example
 * // With custom options
 * const result = await withRetry(
 *   () => productionBatchService.startProduction(data),
 *   {
 *     retries: 5,
 *     delay: 500,
 *     onRetry: (err, attempt) => logger.warn(`Retry ${attempt}:`, err.message),
 *   }
 * );
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const canRetry = attempt < retries && shouldRetry(lastError);

      if (!canRetry) {
        throw lastError;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      // Wait before next attempt
      await sleep(currentDelay);

      // Increase delay with exponential backoff
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Wrap a service method to automatically retry on transient errors
 *
 * Useful for wrapping entire service methods without modifying them.
 *
 * @example
 * const safeStartProduction = withRetryWrapper(
 *   productionBatchService.startProduction.bind(productionBatchService)
 * );
 *
 * const result = await safeStartProduction(data);
 */
export function withRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Pre-configured retry for database operations
 *
 * Uses settings optimized for Neon serverless database:
 * - 3 retries with exponential backoff
 * - Starts at 1s, max 10s delay
 *
 * @example
 * const users = await dbRetry(() => prisma.user.findMany());
 */
export function dbRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    delay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  });
}

/**
 * Pre-configured retry for critical operations
 *
 * Uses more aggressive retry settings for operations that must succeed:
 * - 5 retries with longer delays
 * - Starts at 2s, max 30s delay
 *
 * @example
 * const result = await criticalRetry(() =>
 *   productionBatchService.startProduction(data)
 * );
 */
export function criticalRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    retries: 5,
    delay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  });
}
