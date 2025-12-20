import { User, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";
import { UserDto, UserProfileDto } from "@/types/dto";

/**
 * User Repository
 *
 * Handles all database operations related to users.
 * Implements Single Responsibility Principle (only data access).
 */
export class UserRepository extends BaseRepository {
  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Get user profile with business and subscription
   */
  async getProfile(userId: string): Promise<UserProfileDto | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        business: {
          include: {
            stores: true,
          },
        },
        subscription: true,
      },
    });

    if (!user) return null;

    // User data is already safe (no password field in better-auth User model)
    return user as unknown as UserProfileDto;
  }

  /**
   * Create a new user
   * Note: For better-auth, users are created through the auth flow.
   * This method is kept for compatibility but password should be handled by better-auth.
   */
  async create(data: { email: string; name?: string }): Promise<User> {
    return this.db.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name || "",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update user profile
   */
  async update(
    userId: string,
    data: Partial<Omit<User, "id" | "email" | "createdAt">>
  ): Promise<User> {
    // Process data: convert empty strings to null for nullable fields (like image)
    // and filter out undefined values
    const processedData = Object.entries(data).reduce(
      (acc, [key, value]) => {
        // Skip undefined values
        if (value === undefined) {
          return acc;
        }

        // For image field, empty string means remove (set to null)
        if (key === "image" && value === "") {
          acc[key] = null;
          return acc;
        }

        // For other fields, skip null and empty strings (preserve existing values)
        if (value !== null && value !== "") {
          acc[key] = value;
        }

        return acc;
      },
      {} as Record<string, any>
    );
    return this.db.user.update({
      where: { id: userId },
      data: processedData,
    });
  }

  /**
   * Update user password
   * Note: With better-auth, passwords are stored in the Account table.
   * This method updates the password in the credential account.
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db.account.updateMany({
      where: {
        userId: userId,
        providerId: "credential",
      },
      data: { password: hashedPassword },
    });
  }

  /**
   * Delete user (cascade deletes business, alerts, etc.)
   */
  async delete(userId: string): Promise<User> {
    return this.db.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.db.user.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<User> {
    return this.db.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  /**
   * Get users by IDs (batch)
   */
  async findByIds(userIds: string[]): Promise<User[]> {
    return this.db.user.findMany({
      where: { id: { in: userIds } },
    });
  }

  /**
   * Count total users (for admin purposes)
   */
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.db.user.count({ where });
  }

  /**
   * List users with pagination
   */
  async list(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    return this.db.user.findMany(params);
  }

  /**
   * Update Stripe Connect account ID
   */
  async updateStripeConnectAccount(
    userId: string,
    stripeConnectAccountId: string,
    onboarded: boolean = false
  ): Promise<User> {
    return this.db.user.update({
      where: { id: userId },
      data: {
        stripeConnectAccountId,
        stripeConnectOnboarded: onboarded,
      },
    });
  }

  /**
   * Mark Stripe Connect onboarding as complete
   */
  async completeStripeConnectOnboarding(userId: string): Promise<User> {
    return this.db.user.update({
      where: { id: userId },
      data: { stripeConnectOnboarded: true },
    });
  }

  /**
   * Find user by Stripe Connect account ID
   */
  async findByStripeConnectAccountId(accountId: string): Promise<User | null> {
    return this.db.user.findFirst({
      where: { stripeConnectAccountId: accountId },
    });
  }

  /**
   * Check if user has completed Stripe Connect onboarding
   */
  async isStripeConnectOnboarded(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.stripeConnectOnboarded ?? false;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
