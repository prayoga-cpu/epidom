/**
 * Type-safe Request Context
 *
 * Provides type-safe handling of request-scoped data (e.g., request IDs)
 * using Node.js global context. This replaces unsafe `(global as any)` patterns.
 *
 * Note: In Edge Runtime (middleware), `global` is not available.
 * This module safely handles both Node.js and Edge Runtime environments.
 */

/**
 * Extend Node.js global namespace with our custom properties
 */
declare global {
  var requestId: string | undefined;
}

/**
 * Check if global object is available (Node.js runtime)
 */
function isGlobalAvailable(): boolean {
  return typeof global !== "undefined";
}

/**
 * Set the current request ID in global context
 * Called by middleware to track requests across the application
 *
 * Note: In Edge Runtime, this is a no-op. Use headers-based approach instead.
 *
 * @param id - Unique request identifier
 */
export function setRequestId(id: string): void {
  if (isGlobalAvailable()) {
    global.requestId = id;
  }
  // In Edge Runtime, global is not available - use headers instead
}

/**
 * Get the current request ID from global context
 * Returns undefined if no request ID is set or if running in Edge Runtime
 *
 * @returns Current request ID or undefined
 */
export function getRequestId(): string | undefined {
  if (isGlobalAvailable()) {
    return global.requestId;
  }
  // In Edge Runtime, global is not available
  return undefined;
}

/**
 * Clear the request ID from global context
 * Useful for cleanup in test environments
 */
export function clearRequestId(): void {
  if (isGlobalAvailable()) {
    global.requestId = undefined;
  }
}
