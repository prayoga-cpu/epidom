import { getRateLimitConfig } from "@/config/rate-limit.config";

/**
 * Rate Limiter Utility
 *
 * Provides rate limiting functionality using in-memory storage.
 * Suitable for single-server deployments.
 */

/**
 * In-memory rate limiter for development (fallback)
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private lastSweep = Date.now();
  private static readonly SWEEP_INTERVAL_MS = 5 * 60 * 1000;

  // Drop keys whose timestamps have all expired so unauthenticated traffic
  // with high-cardinality identifiers cannot grow the map unbounded
  private sweep(now: number, windowMs: number): void {
    if (now - this.lastSweep < InMemoryRateLimiter.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, timestamps] of this.requests) {
      if (!timestamps.some((ts) => now - ts < windowMs)) {
        this.requests.delete(key);
      }
    }
  }

  async limit(
    identifier: string,
    limit: number,
    window: number
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    const now = Date.now();
    const windowMs = window * 1000;
    const key = identifier;

    this.sweep(now, windowMs);

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= limit) {
      const oldestTimestamp = validTimestamps[0];
      const reset = oldestTimestamp + windowMs;
      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.ceil((reset - now) / 1000),
      };
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return {
      success: true,
      limit,
      remaining: limit - validTimestamps.length,
      reset: window,
    };
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

/**
 * Check rate limit for a given identifier and path
 *
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param path - API path to get rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  path: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const config = getRateLimitConfig(path);

  // Use in-memory rate limiter
  return inMemoryLimiter.limit(identifier, config.limit, config.window);
}

/**
 * Check rate limit for a specific user
 * Returns null if limit is OK, otherwise returns the limit result for error response
 *
 * @param userId - User ID from session
 * @param path - API path to get rate limit configuration
 * @returns Rate limit result if exceeded, null if OK
 */
export async function checkRateLimitByUser(
  userId: string,
  path: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} | null> {
  const result = await checkRateLimit(`user:${userId}`, path);

  if (!result.success) {
    return result;
  }

  return null;
}

/**
 * Rate limit middleware for API routes
 *
 * @param request - Next.js request object
 * @param path - API path
 * @returns Rate limit result or null if check passes
 */
export async function rateLimitMiddleware(
  request: Request,
  path: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} | null> {
  // Key strictly on the connection IP from platform-set headers.
  // Never trust client-suppliable identifiers (e.g. x-user-id) here —
  // this middleware guards unauthenticated public routes.
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";
  const identifier = `ip:${ip}`;

  const result = await checkRateLimit(identifier, path);

  if (!result.success) {
    return result;
  }

  return null;
}
