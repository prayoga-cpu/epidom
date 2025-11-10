import { Subscription, SubscriptionPlan, SubscriptionStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Subscription Repository
 *
 * Handles all database operations related to subscriptions.
 * Implements Single Responsibility Principle (only data access).
 */
export class SubscriptionRepository extends BaseRepository {
  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string): Promise<Subscription | null> {
    return this.db.subscription.findUnique({
      where: { userId },
    });
  }

  /**
   * Find subscription by Stripe customer ID
   */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    return this.db.subscription.findUnique({
      where: { stripeCustomerId },
    });
  }

  /**
   * Find subscription by Stripe subscription ID
   */
  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.db.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  }

  /**
   * Create a new subscription
   */
  async create(data: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<Subscription> {
    return this.db.subscription.create({
      data,
    });
  }

  /**
   * Update subscription
   */
  async update(
    userId: string,
    data: Partial<Omit<Subscription, "id" | "userId" | "createdAt">>
  ): Promise<Subscription> {
    return this.db.subscription.update({
      where: { userId },
      data,
    });
  }

  /**
   * Update subscription by Stripe subscription ID
   */
  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    data: Partial<Omit<Subscription, "id" | "createdAt">>
  ): Promise<Subscription> {
    return this.db.subscription.update({
      where: { stripeSubscriptionId },
      data,
    });
  }

  /**
   * Update subscription status
   */
  async updateStatus(userId: string, status: SubscriptionStatus): Promise<Subscription> {
    return this.db.subscription.update({
      where: { userId },
      data: { status },
    });
  }

  /**
   * Update subscription plan
   */
  async updatePlan(userId: string, plan: SubscriptionPlan): Promise<Subscription> {
    return this.db.subscription.update({
      where: { userId },
      data: { plan },
    });
  }

  /**
   * Mark subscription for cancellation at period end
   */
  async cancelAtPeriodEnd(userId: string): Promise<Subscription> {
    return this.db.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  /**
   * Delete subscription
   */
  async delete(userId: string): Promise<Subscription> {
    return this.db.subscription.delete({
      where: { userId },
    });
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const count = await this.db.subscription.count({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    return count > 0;
  }

  /**
   * Get all active subscriptions (for admin purposes)
   */
  async listActive(params?: {
    skip?: number;
    take?: number;
    orderBy?: Prisma.SubscriptionOrderByWithRelationInput;
  }): Promise<Subscription[]> {
    return this.db.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      ...params,
    });
  }

  /**
   * Count subscriptions by status
   */
  async countByStatus(status: SubscriptionStatus): Promise<number> {
    return this.db.subscription.count({
      where: { status },
    });
  }

  /**
   * Get subscriptions expiring soon (within days)
   */
  async findExpiringSoon(days: number): Promise<Subscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          lte: futureDate,
          gte: new Date(),
        },
      },
    });
  }
}

// Export singleton instance
export const subscriptionRepository = new SubscriptionRepository();
