import bcrypt from "bcryptjs";
import { User } from "@prisma/client";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { businessRepository, BusinessRepository } from "@/lib/repositories/business.repository";
import { RegisterInput, LoginInput } from "@/lib/validation/auth.schemas";

/**
 * Authentication Service
 *
 * Handles authentication business logic:
 * - User registration with password hashing
 * - Login credential verification
 * - Password management
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
   * Register a new user
   *
   * @throws Error if email already exists
   */
  async register(input: RegisterInput): Promise<{
    user: Omit<User, "password">;
    business?: { id: string; name: string };
  }> {
    // Check if email already exists
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Use transaction to create user and optional business atomically
    return this.userRepo.transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          password: hashedPassword,
          name: input.name,
        },
      });

      // Create business if provided
      let business;
      if (input.businessName) {
        business = await tx.business.create({
          data: {
            userId: user.id,
            name: input.businessName,
          },
        });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        business: business ? { id: business.id, name: business.name } : undefined,
      };
    });
  }

  /**
   * Verify login credentials
   *
   * @throws Error if credentials are invalid
   */
  async verifyCredentials(input: LoginInput): Promise<User> {
    // Find user
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    return user;
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
    // Get user
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.userRepo.updatePassword(userId, hashedPassword);
  }

  /**
   * Request password reset (TODO: implement email sending)
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return;
    }

    // TODO: Generate reset token and send email
    // For now, just a placeholder
  }

  /**
   * Reset password with token (TODO: implement token verification)
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // TODO: Verify token and get user ID
    // For now, just a placeholder
    throw new Error("Password reset not implemented yet");
  }

  /**
   * Verify email with token (TODO: implement)
   */
  async verifyEmail(token: string): Promise<void> {
    // TODO: Verify token and mark email as verified
    throw new Error("Email verification not implemented yet");
  }
}

// Export singleton instance
export const authService = new AuthService();
