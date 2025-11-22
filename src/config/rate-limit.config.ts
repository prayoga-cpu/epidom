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

  // Subscription endpoints - strict limits (payment sensitive)
  "/api/subscriptions/checkout": {
    limit: 5,
    window: 60, // 5 checkout attempts per minute
  },
  "/api/subscriptions/cancel": {
    limit: 5,
    window: 60, // 5 cancellation attempts per minute
  },
  "/api/subscriptions/portal": {
    limit: 10,
    window: 60, // 10 portal sessions per minute
  },
  "/api/subscriptions/sync": {
    limit: 5,
    window: 60, // 5 sync operations per minute
  },
  "/api/subscriptions/cleanup": {
    limit: 2,
    window: 60, // 2 cleanup operations per minute
  },
  "/api/subscriptions/debug": {
    limit: 10,
    window: 60, // 10 debug requests per minute
  },
  "/api/subscriptions/audit": {
    limit: 5,
    window: 60, // 5 audit operations per minute
  },
  "/api/subscriptions/status": {
    limit: 30,
    window: 60, // 30 status checks per minute
  },

  // Billing endpoints
  "/api/billing/portal": {
    limit: 10,
    window: 60, // 10 portal sessions per minute
  },

  // Connect endpoints
  "/api/connect/onboarding": {
    limit: 5,
    window: 60, // 5 onboarding attempts per minute
  },
  "/api/connect/dashboard": {
    limit: 10,
    window: 60, // 10 dashboard links per minute
  },
  "/api/connect/status": {
    limit: 30,
    window: 60, // 30 status checks per minute
  },

  // Store CRUD operations - moderate limits
  "/api/stores/[id]/materials": {
    limit: 100,
    window: 60, // 100 requests per minute
  },
  "/api/stores/[id]/products": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/recipes": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/suppliers": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/supplier-orders": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/production-batches": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/stock-movements": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/alerts": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/product-usage": {
    limit: 100,
    window: 60,
  },

  // Stock operations
  "/api/stores/[id]/stock/adjust": {
    limit: 50,
    window: 60, // 50 stock adjustments per minute
  },
  "/api/stores/[id]/stock/import": {
    limit: 10,
    window: 60, // 10 imports per minute
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
  "/api/stores/[id]/recipes/bulk": {
    limit: 10,
    window: 60,
  },
  "/api/stores/[id]/suppliers/bulk": {
    limit: 10,
    window: 60,
  },

  // Exchange rates
  "/api/exchange-rates": {
    limit: 30,
    window: 60, // 30 requests per minute
  },

  // Webhooks (no rate limit - handled by Stripe)
  "/api/webhooks/stripe": {
    limit: 1000,
    window: 60, // Very high limit for webhooks
  },

  // General API endpoints - moderate limits
  default: {
    limit: 100,
    window: 60, // 100 requests per minute
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

