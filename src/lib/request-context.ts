/**
 * Type-safe Request Context
 *
 * Provides type-safe handling of request-scoped data (e.g., request IDs)
 * using Node.js global context. This replaces unsafe `(global as any)` patterns.
 */

/**
 * Extend Node.js global namespace with our custom properties
 */
declare global {
  var requestId: string | undefined;
}

/**
 * Set the current request ID in global context
 * Called by middleware to track requests across the application
 *
 * @param id - Unique request identifier
 */
export function setRequestId(id: string): void {
  global.requestId = id;
}

/**
 * Get the current request ID from global context
 * Returns undefined if no request ID is set
 *
 * @returns Current request ID or undefined
 */
export function getRequestId(): string | undefined {
  return global.requestId;
}

/**
 * Clear the request ID from global context
 * Useful for cleanup in test environments
 */
export function clearRequestId(): void {
  global.requestId = undefined;
}
