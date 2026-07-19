import { apiClient } from "./client";
import { RegisterInput, LoginInput } from "@/lib/validation/auth.schemas";
import { UserDto } from "@/types/dto";

/**
 * Authentication API Client
 *
 * Type-safe methods for authentication operations
 */
export class AuthApi {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{
    user: UserDto;
    business?: { id: string; name: string };
  }> {
    return apiClient.post("/auth/signup", input);
  }

  /**
   * Login (handled by NextAuth on the client side)
   * This is just for reference - use signIn() from next-auth/react
   */
  // Not needed - NextAuth handles this

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiClient.post("/auth/password-reset/request", { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient.post("/auth/password-reset/confirm", {
      token,
      password,
    });
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    return apiClient.post("/auth/verify-email", { token });
  }
}

// Export singleton instance
export const authApi = new AuthApi();
