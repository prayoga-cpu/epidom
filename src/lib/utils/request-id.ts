/**
 * Request ID Utility
 *
 * Generates and manages request IDs for tracking requests across the application.
 * Request IDs are used for distributed tracing and log correlation.
 */

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get request ID from headers or generate a new one
 */
export function getRequestId(request: Request | Headers): string {
  if (request instanceof Request) {
    return request.headers.get("x-request-id") || generateRequestId();
  }
  return request.get("x-request-id") || generateRequestId();
}

/**
 * Set request ID in headers
 */
export function setRequestId(headers: Headers, requestId: string): void {
  headers.set("x-request-id", requestId);
}

