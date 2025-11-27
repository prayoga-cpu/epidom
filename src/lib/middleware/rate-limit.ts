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

  async limit(identifier: string, limit: number, window: number): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    const now = Date.now();
    const windowMs = window * 1000;
    const key = identifier;

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
  // Get identifier (user ID from session or IP address)
  const identifier = request.headers.get("x-user-id") ||
                     request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     "anonymous";

  const result = await checkRateLimit(identifier, path);

  if (!result.success) {
    return result;
  }

  return null;
}

