import { Prisma, SubscriptionPlan, SubscriptionStatus, type Subscription } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import {
  subscriptionRepository,
  SubscriptionRepository,
} from "@/lib/repositories/subscription.repository";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { storeRepository, StoreRepository } from "@/lib/repositories/store.repository";
import { productRepository, ProductRepository } from "@/lib/repositories/product.repository";
import {
  STRIPE_CONFIG,
  canCreateStore,
  getStoreLimit,
  canCreateProduct as canCreateProductHelper,
  getProductLimit,
  hasSupplierManagementAccess,
  hasAdvancedReportsAccess,
} from "@/config/stripe.config";
import Stripe from "stripe";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ApiErrorCode } from "@/types/api/responses";
import { planHasFeature, PLAN_LABELS, type PlanTier } from "@/lib/plans/entitlements";

/**
 * Subscription Service
 *
 * Handles subscription business logic:
 * - Creating Stripe checkout sessions
 * - Managing subscriptions (upgrade, downgrade, cancel)
 * - Enforcing plan limits
 * - Customer portal sessions
 *
 * Implements Single Responsibility Principle (only subscription logic)
 */
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository = subscriptionRepository,
    private readonly userRepo: UserRepository = userRepository,
    private readonly storeRepo: StoreRepository = storeRepository,
    private readonly productRepo: ProductRepository = productRepository
  ) {}

  /**
   * Invalidate user cache (placeholder for future caching implementation)
   * Currently does nothing but kept for API compatibility
   */
  invalidateUserCache(userId: string): void {
    // Placeholder for future caching implementation
    // This method is called from webhook handlers to maintain API compatibility
  }

  /**
   * The real Stripe customer id to bill this user on, creating one when needed.
   *
   * `admin_`/`free_`-prefixed ids are local stubs, not Stripe customers, so
   * they never survive a checkout — the first paid session promotes the row to
   * a real customer id. A stored id that Stripe no longer knows (deleted in the
   * dashboard, or from another Stripe account) is replaced the same way.
   */
  private async resolveStripeCustomerId(
    user: { id: string; email: string; name?: string | null },
    subscription: Subscription | null
  ): Promise<string> {
    const stored = subscription?.stripeCustomerId;
    if (stored && !stored.startsWith("free_") && !stored.startsWith("admin_")) {
      try {
        const customer = await stripe.customers.retrieve(stored);
        if (!customer.deleted) return stored;
      } catch {
        // Unknown to Stripe — fall through and create a fresh customer.
      }
    }

    const created = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId: user.id },
    });

    if (subscription) {
      await this.subscriptionRepo.update(user.id, { stripeCustomerId: created.id });
    }

    return created.id;
  }

  /**
   * Create Stripe Checkout Session
   *
   * @param userId - User ID creating the subscription
   * @param plan - Subscription plan (POS or OPERATIONS)
   * @param successUrl - URL to redirect on successful payment
   * @param cancelUrl - URL to redirect if user cancels
   * @returns Stripe Checkout Session
   */
  async createCheckoutSession(
    userId: string,
    plan: "FREE" | "FREE" | "POS" | "OPERATIONS",
    successUrl: string,
    cancelUrl: string,
    trial?: boolean,
    yearly: boolean = false
  ): Promise<Stripe.Checkout.Session> {
    // Get user
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a subscription
    let subscription = await this.subscriptionRepo.findByUserId(userId);

    // Prevent buying the same active plan (commented out - we allow re-subscribing)
    // This is now handled by canceling all active subscriptions before creating new one
    /* if (
      subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.plan === plan
    ) {
      throw new Error(`You already have an active ${plan} plan`);
    } */

    const stripeCustomerId = await this.resolveStripeCustomerId(user, subscription);

    // Get price ID for plan
    const priceId = STRIPE_CONFIG.PRICE_IDS[plan][yearly ? "YEARLY" : "MONTHLY"];

    // Calculate application fee (20% to platform)
    // Stripe will automatically transfer remaining 80% to connected account
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Important: This is how we implement the 80/20 split
      // The payment goes to your (developer) account
      // 80% will be transferred to the Epidom owner's connected account
      // Note: Application fee is set on the subscription, not here.
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: plan,
        },
        ...(trial ? { trial_period_days: 14 } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        plan: plan,
      },
    });

    // DO NOT update subscription status yet - wait for webhook confirmation
    // Only create subscription record if it doesn't exist
    if (!subscription) {
      await this.subscriptionRepo.create({
        userId,
        stripeCustomerId,
        plan: plan as SubscriptionPlan,
        status: SubscriptionStatus.INCOMPLETE,
        stripePriceId: priceId,
      });
    }
    // If subscription exists, keep current status until webhook confirms payment
    // This prevents changing ACTIVE status to INCOMPLETE on cancel

    return session;
  }

  /**
   * Create Stripe Customer Portal Session
   * Allows users to manage their subscription, payment methods, and invoices
   */
  async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      throw new Error("No subscription found for user");
    }
    if (subscription.stripeCustomerId.startsWith("free_")) {
      throw new Error("Cannot manage billing portal for free or non-Stripe subscriptions");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Check if user can create another store based on their plan
   */
  async canCreateStore(
    userId: string
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    // If no subscription, no stores allowed
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return { allowed: false, limit: 0, current: 0 };
    }

    // Get user with business relation
    const userProfile = await this.userRepo.getProfile(userId);
    if (!userProfile?.business?.id) {
      return { allowed: false, limit: 0, current: 0 };
    }

    const currentStoreCount = await this.storeRepo.count({
      businessId: userProfile.business.id,
    });

    const limit = getStoreLimit(subscription.plan);
    const allowed = canCreateStore(subscription.plan, currentStoreCount);

    return {
      allowed,
      limit,
      current: currentStoreCount,
    };
  }

  /**
   * Check if user can create another product in a store based on their plan
   */
  async canCreateProduct(
    userId: string,
    storeId: string
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    // If no subscription, no products allowed
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return { allowed: false, limit: 0, current: 0 };
    }

    // Count products in the store
    const currentProductCount = await this.productRepo.count({
      storeId,
    });

    const limit = getProductLimit(subscription.plan);
    const allowed = canCreateProductHelper(subscription.plan, currentProductCount);

    return {
      allowed,
      limit,
      current: currentProductCount,
    };
  }

  /**
   * The user's effective plan tier — their subscription's plan while ACTIVE,
   * otherwise FREE. For callers that need to evaluate several entitlements at
   * once (e.g. the dashboard deciding which cards to render) and would
   * otherwise issue one query per `has*Access` call. Pair with
   * `planHasFeature` from `@/lib/plans/entitlements`.
   */
  async getActivePlan(userId: string): Promise<PlanTier> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return "FREE";
    }

    return subscription.plan;
  }

  /**
   * Check if user has access to supplier management feature
   */
  async hasSupplierManagementAccess(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    return hasSupplierManagementAccess(subscription.plan);
  }

  /**
   * Check if user has access to advanced reports feature
   */
  async hasAdvancedReportsAccess(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    return hasAdvancedReportsAccess(subscription.plan);
  }

  /**
   * Check if user has access to POS features (POS plan or higher).
   */
  async hasPosAccess(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    return planHasFeature(subscription.plan, "posAccess");
  }

  /**
   * Check if user has access to OPERATIONS features (materials, recipes,
   * suppliers, multi-store — OPERATIONS plan or higher).
   */
  async hasOperationsAccess(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    return planHasFeature(subscription.plan, "supplierManagement");
  }

  /**
   * Provision a free subscription for a user, bypassing Stripe.
   * Used for default plan on registration and offline/free tiers.
   * Uses "free_<userId>" as a placeholder stripeCustomerId (guaranteed unique).
   */
  async activateFree(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.FREE
  ): Promise<void> {
    // Self-service free provisioning must not undo an admin-quoted suspension —
    // that would flip the account back to ACTIVE without the price being paid.
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (existing?.customPricePendingAt) {
      throw new AppError(
        "A custom price is awaiting payment on this account. Complete that checkout from your Billing page.",
        ApiErrorCode.CONFLICT,
        409
      );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
    // Atomic upsert — safe against concurrent calls (status check + onboarding PATCH firing simultaneously)
    await (this.subscriptionRepo as any).db.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
      },
      create: {
        userId,
        stripeCustomerId: `free_${userId}`,
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  /**
   * Validate if user can downgrade to a plan
   * Returns false if user has more stores than the target plan allows
   */
  async canDowngradeToPlan(userId: string, targetPlan: SubscriptionPlan): Promise<boolean> {
    // Get user with business relation
    const userProfile = await this.userRepo.getProfile(userId);
    if (!userProfile?.business?.id) {
      return false;
    }

    const currentStoreCount = await this.storeRepo.count({
      businessId: userProfile.business.id,
    });

    const targetPlanLimit = getStoreLimit(targetPlan);

    return currentStoreCount <= targetPlanLimit;
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record
    await this.subscriptionRepo.cancelAtPeriodEnd(userId);

    // Invalidate cache
    this.invalidateUserCache(userId);
  }

  /**
   * Freestyle plan switch for admin-granted (BETA) accounts. These have no Stripe
   * payment method (stripeCustomerId starts with "admin_"), so they may move to any
   * plan instantly without checkout. Rejects real Stripe-billed subscriptions.
   */
  async setPrivilegePlan(userId: string, plan: SubscriptionPlan): Promise<void> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      throw new Error("No subscription found");
    }
    if (!subscription.stripeCustomerId.startsWith("admin_")) {
      throw new Error(
        "Freestyle plan switching is only available for admin-granted (BETA) accounts."
      );
    }
    await this.subscriptionRepo.update(userId, {
      plan,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
    });
    this.invalidateUserCache(userId);
  }

  /**
   * Admin-set custom price. Behavior splits on how the account is actually
   * billed:
   *  - Real Stripe account (stripeCustomerId doesn't start with "admin_" or
   *    "free_"): a quoted *offer* for `input.plan`. Their running subscription
   *    is canceled in Stripe immediately — they must not keep paying the old
   *    price for access they no longer have — access is suspended (status
   *    INCOMPLETE, every plan gate reads FREE) and their Billing page offers a
   *    Checkout Session at the quoted price. See
   *    `createCustomPriceCheckoutSession`.
   *  - admin_/free_ accounts: reference-only — stored and displayed for the
   *    operator's own invoicing, no Stripe call, access untouched. There is no
   *    real billing to supersede, and suspending a BETA account the operator
   *    granted by hand would just lock them out with no way to pay.
   */
  async setCustomPrice(
    userId: string,
    input: {
      amount: number;
      currency: string;
      interval: "MONTHLY" | "YEARLY";
      plan: Exclude<SubscriptionPlan, "FREE">;
    }
  ): Promise<Subscription> {
    let subscription = await this.subscriptionRepo.findByUserId(userId);
    // A user who's never had a subscription row yet is treated the same way
    // admin/users route's "set-plan" upsert treats them: admin-granted.
    if (!subscription) {
      const now = new Date();
      subscription = await (this.subscriptionRepo as any).db.subscription.create({
        data: {
          userId,
          stripeCustomerId: `admin_${userId}`,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const isRealStripe =
      !subscription!.stripeCustomerId.startsWith("admin_") &&
      !subscription!.stripeCustomerId.startsWith("free_");

    const priceFields = {
      customPriceAmount: new Prisma.Decimal(input.amount),
      customPriceCurrency: input.currency,
      customPriceInterval: input.interval,
      customPricePlan: input.plan,
    };

    if (!isRealStripe) {
      const updated = await this.subscriptionRepo.update(userId, priceFields);
      this.invalidateUserCache(userId);
      return updated;
    }

    // Cancel the running subscription rather than repricing its item: the user
    // is being re-quoted, so they pay the new price through a fresh Checkout
    // Session. `prorate: false` — no refund for unused time, matching how
    // duplicate subscriptions are cleaned up elsewhere.
    if (subscription!.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription!.stripeSubscriptionId, { prorate: false });
      } catch (error) {
        // Already gone in Stripe (canceled by hand, expired) — the local row is
        // what matters from here on.
        logger.warn("Failed to cancel Stripe subscription for custom price offer", {
          userId,
          stripeSubscriptionId: subscription!.stripeSubscriptionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const updated = await this.subscriptionRepo.update(userId, {
      ...priceFields,
      customPricePendingAt: new Date(),
      // Re-quoting an offer that's already pending must not record INCOMPLETE
      // as the status to restore — keep the one from before the first offer.
      customPricePrevStatus:
        subscription!.customPricePendingAt != null
          ? subscription!.customPricePrevStatus
          : subscription!.status,
      status: SubscriptionStatus.INCOMPLETE,
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
    });
    this.invalidateUserCache(userId);
    return updated;
  }

  /**
   * Reverts to standard catalog pricing. A still-pending offer is withdrawn —
   * access comes back at whatever status the account had before it (their old
   * Stripe subscription is already canceled, so this leaves them on their plan
   * unbilled until the operator re-quotes or they subscribe again). For an
   * account already paying a custom price, the subscription item is moved back
   * to the catalog price (always the monthly one — the original billing
   * interval isn't separately tracked once overridden, an accepted
   * simplification).
   */
  async clearCustomPrice(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      throw new Error("No subscription found");
    }

    const isRealStripe =
      !subscription.stripeCustomerId.startsWith("admin_") &&
      !subscription.stripeCustomerId.startsWith("free_");

    if (isRealStripe && subscription.stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const item = stripeSub.items.data[0];
      const catalogPriceId =
        subscription.plan === "POS" || subscription.plan === "OPERATIONS"
          ? STRIPE_CONFIG.PRICE_IDS[subscription.plan].MONTHLY
          : null;
      if (item && catalogPriceId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [{ id: item.id, price: catalogPriceId }],
          proration_behavior: "none",
        });
      }
    }

    const updated = await this.subscriptionRepo.update(userId, {
      customPriceAmount: null,
      customPriceCurrency: null,
      customPriceInterval: null,
      customPricePlan: null,
      customPricePendingAt: null,
      customPricePrevStatus: null,
      ...(subscription.customPricePendingAt != null
        ? { status: subscription.customPricePrevStatus ?? SubscriptionStatus.ACTIVE }
        : {}),
    });
    this.invalidateUserCache(userId);
    return updated;
  }

  /**
   * Checkout Session for a pending custom-price offer — the user paying the
   * price an admin quoted them. Bills an ad-hoc Stripe price built from the
   * stored amount/currency/interval instead of a catalog price id, and tags
   * the session `customPrice: "true"` so the webhook knows to lift the
   * suspension (see api/webhooks/stripe: customPricePendingAt).
   */
  async createCustomPriceCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError("User not found", ApiErrorCode.NOT_FOUND, 404);
    }

    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (
      !subscription ||
      subscription.customPricePendingAt == null ||
      subscription.customPriceAmount == null ||
      !subscription.customPricePlan
    ) {
      throw new AppError(
        "No custom price is awaiting payment on this account.",
        ApiErrorCode.VALIDATION_ERROR,
        422
      );
    }

    const plan = subscription.customPricePlan;
    const stripeCustomerId = await this.resolveStripeCustomerId(user, subscription);

    return stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (subscription.customPriceCurrency ?? "EUR").toLowerCase(),
            unit_amount: Math.round(Number(subscription.customPriceAmount) * 100),
            recurring: {
              interval: subscription.customPriceInterval === "YEARLY" ? "year" : "month",
            },
            product_data: { name: `Epidom ${PLAN_LABELS[plan]} — custom price` },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { userId: user.id, plan, customPrice: "true" },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, plan, customPrice: "true" },
    });
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No subscription found");
    }

    // Reactivate in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local record
    await this.subscriptionRepo.update(userId, {
      cancelAtPeriodEnd: false,
    });

    // Invalidate cache
    this.invalidateUserCache(userId);
  }

  /**
   * Audit and fix duplicate active subscriptions for a user
   * This is a safety function to ensure users only have one active Stripe subscription
   *
   * @param userId - User ID to audit
   * @returns Array of canceled subscription IDs
   */
  async auditAndFixDuplicateSubscriptions(userId: string): Promise<{
    duplicatesFound: number;
    canceledSubscriptionIds: string[];
  }> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription) {
      return { duplicatesFound: 0, canceledSubscriptionIds: [] };
    }

    // Get all active subscriptions for this customer from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: subscription.stripeCustomerId,
      status: "active",
      limit: 100,
    });

    const activeSubscriptions = subscriptions.data;
    const canceledIds: string[] = [];

    // If we have more than one active subscription, cancel the old ones
    if (activeSubscriptions.length > 1) {
      // Keep the newest subscription (highest created timestamp)
      const sortedByDate = activeSubscriptions.sort((a, b) => b.created - a.created);
      const keepSubscription = sortedByDate[0];
      const toCancel = sortedByDate.slice(1);

      // Cancel old subscriptions IMMEDIATELY
      for (const sub of toCancel) {
        await stripe.subscriptions.cancel(sub.id, {
          prorate: false, // No refund for unused time
        });
        canceledIds.push(sub.id);
      }

      // Ensure database reflects the kept subscription
      if (subscription.stripeSubscriptionId !== keepSubscription.id) {
        await this.subscriptionRepo.update(userId, {
          stripeSubscriptionId: keepSubscription.id,
        });
        this.invalidateUserCache(userId);
      }
    }

    return {
      duplicatesFound: activeSubscriptions.length - 1,
      canceledSubscriptionIds: canceledIds,
    };
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
