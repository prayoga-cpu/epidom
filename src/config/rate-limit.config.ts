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
  "/api/subscriptions/custom-price/checkout": {
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
  "/api/stores/[id]/orders": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/orders/analytics": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/customers/analytics": {
    limit: 100,
    window: 60,
  },
  // Cashier revamp (2.88.0). The list is the POS search-as-you-type box, so it
  // gets headroom over the usual 100 — one lookup is several debounced requests.
  "/api/stores/[id]/customers": {
    limit: 200,
    window: 60,
  },
  "/api/stores/[id]/customers/[customerId]": {
    limit: 100,
    window: 60,
  },
  // Money-adjacent (it edits a spendable balance) and only ever done by hand.
  "/api/stores/[id]/customers/[customerId]/points": {
    limit: 30,
    window: 60, // 30 manual adjustments per minute
  },
  "/api/stores/[id]/customers/export": {
    limit: 10,
    window: 60, // 10 exports per minute
  },
  "/api/stores/[id]/discount-presets": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/discount-presets/[presetId]": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/coupons": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/coupons/[couponId]": {
    limit: 100,
    window: 60,
  },
  // A code is guessable input, so this read is capped below the usual 100.
  "/api/stores/[id]/coupons/validate": {
    limit: 60,
    window: 60, // 60 checks per minute
  },
  "/api/stores/[id]/loyalty-settings": {
    limit: 100,
    window: 60,
  },
  // Till actions that were riding the default limit. Merge rewrites saved bills
  // and refund moves money; a receipt send costs a WhatsApp message or an email
  // (and now accepts a typed-in phone/e-mail), so none of them should be
  // hammerable.
  "/api/stores/[id]/pos/orders/merge": {
    limit: 30,
    window: 60, // 30 merges per minute
  },
  "/api/stores/[id]/pos/orders/[orderId]/refund": {
    limit: 30,
    window: 60, // 30 refunds per minute
  },
  "/api/stores/[id]/pos/orders/[orderId]/send-receipt": {
    limit: 30,
    window: 60, // 30 WhatsApp receipts per minute
  },
  "/api/stores/[id]/pos/orders/[orderId]/send-receipt-email": {
    limit: 30,
    window: 60, // 30 e-mail receipts per minute
  },
  "/api/stores/[id]/finance/settings": {
    limit: 100,
    window: 60,
  },
  // Cash movements are tapped in one at a time at the till, never in bulk.
  "/api/stores/[id]/cash-movements": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/cash-movements/[movementId]": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/by-category": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/by-department": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/by-shift": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/sales-patterns": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/adjustments": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/tax": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/labour": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/expenses": {
    limit: 100,
    window: 60,
  },
  "/api/stores/[id]/finance/expenses/[expenseId]": {
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
    limit: 30,
    window: 60, // 30 bulk operations per minute
  },
  "/api/stores/[id]/products/bulk": {
    limit: 30,
    window: 60,
  },
  "/api/stores/[id]/recipes/bulk": {
    limit: 30,
    window: 60,
  },
  "/api/stores/[id]/suppliers/bulk": {
    limit: 30,
    window: 60,
  },
  "/api/stores/[id]/materials/categories/[category]": {
    limit: 30,
    window: 60, // 30 category deletions per minute
  },
  "/api/stores/[id]/products/categories/[category]": {
    limit: 30,
    window: 60,
  },
  "/api/stores/[id]/recipes/categories/[category]": {
    limit: 30,
    window: 60,
  },

  // Exchange rates
  "/api/exchange-rates": {
    limit: 30,
    window: 60, // 30 requests per minute
  },

  // Onboarding profile analysis - gpt-4o vision call per request, keep tight
  "/api/onboarding/analyze-profile": {
    limit: 10,
    window: 60, // 10 analyses per minute
  },

  // Setup wizard (3.3.0). The state read runs on every wizard load and the
  // link check as the owner types (debounced); the step saves each write
  // several rows, and complete publishes.
  "/api/onboarding/state": {
    limit: 60,
    window: 60, // 60 reads per minute
  },
  "/api/onboarding/slug-check": {
    limit: 60,
    window: 60, // 60 link checks per minute
  },
  "/api/onboarding/store": {
    limit: 20,
    window: 60, // 20 step saves per minute
  },
  "/api/onboarding/storefront": {
    limit: 20,
    window: 60, // 20 step saves per minute
  },
  "/api/onboarding/complete": {
    limit: 10,
    window: 60, // 10 publish attempts per minute
  },

  // Feedback submission - generous limit, feedback is welcome; only blocks runaway bots
  "/api/feedback": {
    limit: 30,
    window: 60, // 30 submissions per minute
  },
  "/api/feedback/[id]": {
    limit: 60,
    window: 60, // 60 edit/delete operations per minute
  },

  // Public storefront order lookup (unauthenticated, IP-based)
  "/api/public/orders/lookup": {
    limit: 30,
    window: 60, // 30 lookups per minute
  },

  // Staff PIN check — a 4-digit PIN has only 10,000 possibilities and there is
  // no per-staffer lockout, so this is the only brute-force brake. Well above
  // any real shift-change rhythm on a shared tablet, well below "try them all".
  "/api/stores/[id]/staff/verify-pin": {
    limit: 30,
    window: 60, // 30 PIN attempts per minute
  },

  // Owner PIN check ("switch back to Owner" on a shared device). Same 10,000
  // possibilities as a staff PIN, but it guards the whole owner UI (billing,
  // staff, finance) and the person guessing is typically a staff persona on
  // the owner's own session, so it is much tighter. An owner who mistypes a few
  // times waits a minute at most. The window stays 60s on purpose: the
  // in-memory limiter's sweep uses the window of whichever call triggers it, so
  // a longer window would not be kept reliably.
  "/api/user/verify-owner-pin": {
    limit: 5,
    window: 60, // 5 PIN attempts per minute
  },

  // Forgotten owner PIN: reset checks a 6-digit emailed code, and request-otp
  // sends that email. On the default 100/min the code could be guessed online
  // and the inbox flooded, so both get the same tight 60s window as above.
  "/api/user/owner-pin/reset": {
    limit: 5,
    window: 60, // 5 code attempts per minute
  },
  "/api/user/owner-pin/request-otp": {
    limit: 3,
    window: 60, // 3 code emails per minute
  },

  // Staff account invites — each one sends an email carrying a sign-in link,
  // so keep an owner from turning this into a mail cannon.
  "/api/stores/[id]/staff/[staffId]/invite": {
    limit: 10,
    window: 60, // 10 invite emails per minute
  },

  // Staff invite claim page (unauthenticated, IP-based). The token itself is
  // 256 bits; this caps guessing attempts and the account-creation path.
  "/api/staff-invite/lookup": {
    limit: 30,
    window: 60, // 30 lookups per minute
  },
  "/api/staff-invite/complete": {
    limit: 10,
    window: 60, // 10 claim attempts per minute
  },

  // In-app guide (3.3.0). Guide state is read once per session and written on
  // a tap (dismiss a card, finish the tour); the checklist refetches on window
  // focus. Both well under the default, which only a runaway loop would reach.
  "/api/user/guide-state": {
    limit: 60,
    window: 60, // 60 reads/changes per minute
  },
  "/api/stores/[id]/setup-progress": {
    limit: 60,
    window: 60, // 60 checklist reads per minute
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
