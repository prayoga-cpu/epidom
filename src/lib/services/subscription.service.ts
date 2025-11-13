import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import {
  subscriptionRepository,
  SubscriptionRepository,
} from "@/lib/repositories/subscription.repository";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { storeRepository, StoreRepository } from "@/lib/repositories/store.repository";
import {
  productRepository,
  ProductRepository,
} from "@/lib/repositories/product.repository";
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
   * Create Stripe Checkout Session
   *
   * @param userId - User ID creating the subscription
   * @param plan - Subscription plan (STARTER or PRO)
   * @param successUrl - URL to redirect on successful payment
   * @param cancelUrl - URL to redirect if user cancels
   * @returns Stripe Checkout Session
   */
  async createCheckoutSession(
    userId: string,
    plan: "STARTER" | "PRO",
    successUrl: string,
    cancelUrl: string
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

    // Get Epidom owner's Stripe Connect account (for receiving 80%)
    // NOTE: For MVP, this should be a configuration.
    // You'll need to set up the Epidom owner's Connect account first
    const epidomOwner = await this.getEpidomOwner();
    if (!epidomOwner || !epidomOwner.stripeConnectAccountId) {
      throw new Error(
        "Payment system not configured. Epidom owner must complete Stripe Connect onboarding first."
      );
    }

    let stripeCustomerId: string;

    if (subscription) {
      // Use existing Stripe customer ID
      stripeCustomerId = subscription.stripeCustomerId;

      // IMPORTANT: DO NOT cancel existing subscriptions here!
      // Canceling before payment confirmation means user loses their current plan if they click "back"
      //
      // The correct flow:
      // 1. User has Starter plan (ACTIVE)
      // 2. User clicks upgrade to Pro → creates checkout session
      // 3. User pays successfully → webhook confirms → THEN cancel old subscription
      // 4. If user cancels checkout → old subscription stays ACTIVE ✅
      //
      // Duplicate subscriptions will be handled by:
      // - Webhook handler: Cancel old subscription when new one is confirmed
      // - Audit function: Clean up any duplicates as safety measure
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Get price ID for plan
    const priceId = STRIPE_CONFIG.PRICE_IDS[plan];

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
      payment_intent_data: {
        application_fee_amount: undefined, // Set on subscription, not here
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: plan,
        },
        // Application fee: 20% goes to platform (you), 80% to connected account
        application_fee_percent: STRIPE_CONFIG.PLATFORM_FEE_PERCENT,
        // Transfer 80% to Epidom owner
        transfer_data: {
          destination: epidomOwner.stripeConnectAccountId,
        },
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
      isActive: true,
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
      isActive: true,
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
      isActive: true,
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
      }
    }

    return {
      duplicatesFound: activeSubscriptions.length - 1,
      canceledSubscriptionIds: canceledIds,
    };
  }

  /**
   * Get Epidom owner user
   * IMPORTANT: This is a placeholder. You need to implement a way to identify
   * the Epidom owner (e.g., via environment variable, database flag, etc.)
   *
   * For now, you could:
   * 1. Set an environment variable with the owner's email
   * 2. Add an `isEpidomOwner` flag to the User model
   * 3. Create a separate configuration table
   */
  private async getEpidomOwner() {
    // TODO: Implement proper Epidom owner identification
    // For now, return the first user with a Stripe Connect account
    // This is a temporary solution - you should have a proper way to identify the owner

    // Option 1: Use environment variable
    const ownerEmail = process.env.EPIDOM_OWNER_EMAIL;
    if (ownerEmail) {
      return await this.userRepo.findByEmail(ownerEmail);
    }

    // Option 2: Find first user with completed onboarding (temporary)
    // This is NOT production-ready, just for initial setup
    throw new Error(
      "EPIDOM_OWNER_EMAIL environment variable not set. " +
        "Please set this to the email of the Epidom business owner."
    );
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
