import bcrypt from "bcryptjs";
import { User } from "@prisma/client";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { businessRepository, BusinessRepository } from "@/lib/repositories/business.repository";
import { RegisterInput, LoginInput } from "@/lib/validation/auth.schemas";
import { prisma as db } from "@/lib/prisma";

/**
 * Authentication Service
 *
 * Handles authentication business logic.
 * Note: With better-auth, most authentication is handled by the auth library.
 * This service provides helper functions for business logic that needs auth context.
 *
 * Implements Single Responsibility Principle (only auth logic)
 * and Dependency Inversion (depends on repository abstractions)
 */
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly businessRepo: BusinessRepository = businessRepository
  ) {}

  /**
   * Register a new user with business
   * Note: With better-auth, user creation is handled by the auth flow.
   * This method is for creating business after user signup.
   */
  async createBusinessForUser(
    userId: string,
    businessName: string
  ): Promise<{ id: string; name: string }> {
    const business = await this.businessRepo.create({
      userId,
      name: businessName,
    });

    return { id: business.id, name: business.name };
  }

  /**
   * Get user's credential account password hash
   * Used for password verification
   */
  private async getPasswordHash(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
      where: {
        userId,
        providerId: "credential",
      },
      select: {
        password: true,
      },
    });
    return account?.password ?? null;
  }

  /**
   * Change user password
   *
   * @throws Error if current password is incorrect
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get password hash from account
    const passwordHash = await this.getPasswordHash(userId);
    if (!passwordHash) {
      throw new Error("No password set for this account");
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in account table
    await this.userRepo.updatePassword(userId, hashedPassword);
  }

  /**
   * Request password reset
   * Note: With better-auth, this is handled by authClient.requestPasswordReset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return;
    }
    // Password reset is handled by better-auth
  }

  /**
   * Reset password with token
   * Note: With better-auth, this is handled by authClient.resetPassword
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Password reset is handled by better-auth
    throw new Error("Use better-auth client for password reset");
  }

  /**
   * Verify email with token
   * Note: With better-auth, this is handled by the auth flow
   */
  async verifyEmail(token: string): Promise<void> {
    // Email verification is handled by better-auth
    throw new Error("Use better-auth for email verification");
  }
}

// Export singleton instance
export const authService = new AuthService();
