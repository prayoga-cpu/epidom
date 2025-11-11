/**
 * Stripe Configuration
 *
 * IMPORTANT: After creating products and prices in Stripe Dashboard,
 * update the STRIPE_PRICE_IDS below with your actual price IDs.
 *
 * To create products and prices:
 * 1. Go to https://dashboard.stripe.com/test/products
 * 2. Click "Add product"
 * 3. Create products for Starter and Pro plans
 * 4. Copy the price IDs and paste them below
 */

export const STRIPE_CONFIG = {
  /**
   * Platform revenue split
   * - Developer (platform owner) receives 20%
   * - Epidom owner receives 80% (via Stripe Transfer)
   */
  PLATFORM_FEE_PERCENT: 20,
  EPIDOM_OWNER_PERCENT: 80,

  /**
   * Store limits per plan
   */
  PLAN_LIMITS: {
    STARTER: {
      maxStores: 1,
      maxProducts: 500,
      name: "Starter",
      price: 29, // EUR
    },
    PRO: {
      maxStores: Infinity, // Unlimited
      maxProducts: Infinity, // Unlimited
      name: "Pro",
      price: 79, // EUR
    },
    ENTERPRISE: {
      maxStores: Infinity, // Unlimited
      maxProducts: Infinity, // Unlimited
      name: "Enterprise",
      price: null, // Custom pricing
    },
  },

  /**
   * Stripe Price IDs
   * TODO: Replace these with actual price IDs from your Stripe Dashboard
   *
   * Test mode price IDs start with 'price_test_'
   * Production price IDs start with 'price_'
   */
  PRICE_IDS: {
    STARTER: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER || "price_test_starter_placeholder",
    PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || "price_test_pro_placeholder",
    // Enterprise is handled via sales contact, not Stripe Checkout
  },

  /**
   * Success and cancel URLs for Stripe Checkout
   */
  URLS: {
    SUCCESS: "/profile?success=true",
    CANCEL: "/pricing?canceled=true",
    RETURN: "/profile", // For Stripe Customer Portal
  },

  /**
   * Stripe Connect configuration for Epidom owner
   */
  CONNECT: {
    ACCOUNT_TYPE: "express" as const, // EU-compliant, Stripe-hosted onboarding
    COUNTRY: "FR", // France
    REFRESH_URL: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/profile?connect=refresh`,
    RETURN_URL: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/profile?connect=success`,
  },
} as const;

/**
 * Helper to get price ID by plan name
 */
export function getPriceId(plan: "STARTER" | "PRO"): string {
  return STRIPE_CONFIG.PRICE_IDS[plan];
}

/**
 * Helper to get store limit by plan name
 */
export function getStoreLimit(plan: "STARTER" | "PRO" | "ENTERPRISE"): number {
  return STRIPE_CONFIG.PLAN_LIMITS[plan].maxStores;
}

/**
 * Helper to check if a plan allows more stores
 */
export function canCreateStore(
  plan: "STARTER" | "PRO" | "ENTERPRISE",
  currentStoreCount: number
): boolean {
  const limit = getStoreLimit(plan);
  return currentStoreCount < limit;
}

/**
 * Helper to get product limit by plan name
 */
export function getProductLimit(plan: "STARTER" | "PRO" | "ENTERPRISE"): number {
  return STRIPE_CONFIG.PLAN_LIMITS[plan].maxProducts;
}

/**
 * Helper to check if a plan allows more products
 */
export function canCreateProduct(
  plan: "STARTER" | "PRO" | "ENTERPRISE",
  currentProductCount: number
): boolean {
  const limit = getProductLimit(plan);
  return currentProductCount < limit;
}
