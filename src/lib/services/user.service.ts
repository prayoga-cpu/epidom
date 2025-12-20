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
