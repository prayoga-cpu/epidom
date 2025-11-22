/**
 * Rate Limiting Configuration
 *
 * Defines rate limits for different API endpoints and operations.
 * Limits are per-user and per-endpoint.
 */

export interface RateLimitConfig {
  limit: number; // Maximum number of requests
  window: number; // Time window in seconds
}

export const rateLimitConfig: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict limits
  "/api/auth/signup": {
    limit: 5,
    window: 60, // 5 requests per minute
  },
  "/api/auth/[...nextauth]": {
    limit: 10,
    window: 60, // 10 requests per minute
  },

  // General API endpoints - moderate limits
  default: {
    limit: 100,
    window: 60, // 100 requests per minute
  },

  // Heavy operations - strict limits
  "/api/stores/[id]/materials/export": {
    limit: 10,
    window: 60, // 10 exports per minute
  },
  "/api/stores/[id]/products/export": {
    limit: 10,
    window: 60,
  },
  "/api/stores/[id]/recipes/export": {
    limit: 10,
    window: 60,
  },
  "/api/stores/[id]/suppliers/export": {
    limit: 10,
    window: 60,
  },
  "/api/stores/[id]/materials/bulk": {
    limit: 10,
    window: 60, // 10 bulk operations per minute
  },
  "/api/stores/[id]/products/bulk": {
    limit: 10,
    window: 60,
  },
};

/**
 * Get rate limit configuration for a given path
 */
export function getRateLimitConfig(path: string): RateLimitConfig {
  // Check for exact match first
  if (rateLimitConfig[path]) {
    return rateLimitConfig[path];
  }

  // Check for pattern matches (e.g., /api/stores/[id]/materials/export)
  for (const [pattern, config] of Object.entries(rateLimitConfig)) {
    if (pattern.includes("[id]")) {
      const regex = new RegExp(pattern.replace(/\[id\]/g, "[^/]+"));
      if (regex.test(path)) {
        return config;
      }
    }
  }

  // Return default
  return rateLimitConfig.default;
}

