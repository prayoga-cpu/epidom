import { User } from "@prisma/client";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { UpdateProfileInput } from "@/lib/validation/auth.schemas";
import { UserProfileDto, UserDto } from "@/types/dto";

/**
 * User Service
 *
 * Handles user-related business logic:
 * - Profile management
 * - User data retrieval
 * - User settings
 *
 * Separates business logic from data access (SRP)
 */
export class UserService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  /**
   * Get user profile with business and subscription
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.userRepo.getProfile(userId);
    if (!profile) {
      throw new Error("User not found");
    }
    return profile;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    // Validate user exists
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update user
    const updatedUser = await this.userRepo.update(userId, input);

    return updatedUser;
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    return !(await this.userRepo.emailExists(email));
  }

  /**
   * Delete user account
   * This will cascade delete business, stores, etc.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.userRepo.delete(userId);
  }

  /**
   * Deactivate an account (soft delete). Self-service reactivation is
   * available for 30 days; data is retained for 365 days total.
   */
  async deactivateAccount(userId: string): Promise<{ deactivatedAt: Date; purgeAt: Date }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const deactivatedAt = new Date();
    const purgeAt = new Date(deactivatedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
    await this.userRepo.update(userId, { deactivatedAt, purgeAt });

    return { deactivatedAt, purgeAt };
  }

  /**
   * Reactivate a deactivated account. By default only allowed within the
   * 30-day self-service grace period; pass `enforceGracePeriod: false` for
   * admin-initiated reactivation after a support-quoted recovery.
   */
  async reactivateAccount(
    userId: string,
    { enforceGracePeriod = true }: { enforceGracePeriod?: boolean } = {}
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user?.deactivatedAt) {
      throw new Error("Account is not deactivated");
    }

    if (enforceGracePeriod) {
      const deadline = new Date(user.deactivatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (new Date() > deadline) {
        throw new Error(
          "The 30-day self-service window has passed. Contact support to recover this account."
        );
      }
    }

    await this.userRepo.clearDeactivation(userId);
  }

  /**
   * Accounts whose 365-day retention window has passed — candidates for the
   * daily permanent-purge job.
   */
  async getAccountsPastRetention(): Promise<User[]> {
    return this.userRepo.list({ where: { purgeAt: { lte: new Date() } } });
  }

  /**
   * Get user statistics (for admin)
   */
  async getUserStats(userId: string): Promise<{
    hasBusiness: boolean;
    storeCount: number;
    accountAge: number; // in days
  }> {
    const profile = await this.userRepo.getProfile(userId);
    if (!profile) {
      throw new Error("User not found");
    }

    const accountAge = Math.floor(
      (Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      hasBusiness: !!profile.business,
      storeCount: profile.business?.stores?.length ?? 0,
      accountAge,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
