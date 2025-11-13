import { stripe } from "@/lib/stripe";
import { userRepository, UserRepository } from "@/lib/repositories/user.repository";
import { STRIPE_CONFIG } from "@/config/stripe.config";
import Stripe from "stripe";

/**
 * Stripe Connect Service
 *
 * Handles Stripe Connect operations for the Epidom owner:
 * - Creating Express Connect accounts (EU-compliant)
 * - Generating onboarding links
 * - Checking onboarding status
 * - Managing connected accounts
 *
 * IMPORTANT: Due to French/EU regulations, we use Stripe-hosted onboarding
 * with Express accounts, not custom onboarding.
 */
export class StripeConnectService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  /**
   * Create a Stripe Connect Express account for the Epidom owner
   *
   * @param userId - User ID of the Epidom owner
   * @returns Stripe Account object
   */
  async createConnectAccount(userId: string): Promise<Stripe.Account> {
    // Check if user already has a Connect account
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.stripeConnectAccountId) {
      // Return existing account
      return await stripe.accounts.retrieve(user.stripeConnectAccountId);
    }

    // Create new Express account (EU-compliant, Stripe-hosted onboarding)
    // For France/EU, we use Express accounts with Stripe-hosted onboarding only
    // NOTE: Stripe requires a valid URL for business_profile.url (no localhost)
    // We'll use a placeholder production URL for now
    const businessUrl =
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_APP_URL || "https://epidom.app"
        : "https://epidom.app";

    const account = await stripe.accounts.create({
      type: STRIPE_CONFIG.CONNECT.ACCOUNT_TYPE,
      country: STRIPE_CONFIG.CONNECT.COUNTRY,
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual", // Use "individual" for simplicity in EU
      // EU-required fields for Express accounts
      business_profile: {
        url: businessUrl,
        mcc: "8911", // Software/SaaS
      },
      metadata: {
        userId: user.id,
        role: "epidom_owner",
      },
    });

    // Save account ID to user record
    await this.userRepo.updateStripeConnectAccount(userId, account.id, false);

    return account;
  }

  /**
   * Generate Stripe Connect onboarding link (Stripe-hosted)
   *
   * @param userId - User ID of the Epidom owner
   * @param refreshUrl - URL to redirect if onboarding needs refresh
   * @param returnUrl - URL to redirect after successful onboarding
   * @returns Account Link URL
   */
  async createAccountLink(
    userId: string,
    refreshUrl?: string,
    returnUrl?: string
  ): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get or create Connect account
    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.createConnectAccount(userId);
      accountId = account.id;
    }

    // Create account link for onboarding
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://epidom.app";
    const refreshUrl_final = refreshUrl || `${appUrl}/profile?connect=refresh`;
    const returnUrl_final = returnUrl || `${appUrl}/profile?connect=success`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl_final,
      return_url: returnUrl_final,
      type: "account_onboarding",
    });

    return accountLink.url;
  }

  /**
   * Check if Connect account onboarding is complete
   *
   * @param userId - User ID to check
   * @returns True if onboarding is complete and account can accept payments
   */
  async isOnboardingComplete(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user?.stripeConnectAccountId) {
      return false;
    }

    try {
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

      // Check if account can accept payments
      const isComplete =
        account.charges_enabled === true &&
        account.payouts_enabled === true &&
        account.details_submitted === true;

      // Update local record if status changed
      if (isComplete && !user.stripeConnectOnboarded) {
        await this.userRepo.completeStripeConnectOnboarding(userId);
      }

      return isComplete;
    } catch (error) {
      console.error("[StripeConnect] Error checking onboarding status:", error);
      return false;
    }
  }

  /**
   * Get Connect account details
   *
   * @param userId - User ID
   * @returns Stripe Account object or null
   */
  async getAccountDetails(userId: string): Promise<Stripe.Account | null> {
    const user = await this.userRepo.findById(userId);
    if (!user?.stripeConnectAccountId) {
      return null;
    }

    try {
      return await stripe.accounts.retrieve(user.stripeConnectAccountId);
    } catch (error) {
      console.error("[StripeConnect] Error retrieving account:", error);
      return null;
    }
  }

  /**
   * Create login link for Connect Dashboard
   * Allows Epidom owner to view their earnings, payouts, and account settings
   *
   * @param userId - User ID
   * @returns Login link URL
   */
  async createDashboardLoginLink(userId: string): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user?.stripeConnectAccountId) {
      throw new Error("No Stripe Connect account found");
    }

    const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
    return loginLink.url;
  }

  /**
   * Get account balance (for Epidom owner to see their earnings)
   *
   * @param userId - User ID
   * @returns Stripe Balance object
   */
  async getAccountBalance(userId: string): Promise<Stripe.Balance | null> {
    const user = await this.userRepo.findById(userId);
    if (!user?.stripeConnectAccountId) {
      return null;
    }

    try {
      return await stripe.balance.retrieve({
        stripeAccount: user.stripeConnectAccountId,
      });
    } catch (error) {
      console.error("[StripeConnect] Error retrieving balance:", error);
      return null;
    }
  }
}

// Export singleton instance
export const stripeConnectService = new StripeConnectService();
