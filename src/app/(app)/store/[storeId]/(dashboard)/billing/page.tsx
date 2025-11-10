import { Metadata } from "next";
import { BillingContainer } from "@/features/dashboard/billing/components/billing-container";

export const metadata: Metadata = {
  title: "Billing & Subscription | Epidom",
  description: "Manage your subscription, billing, and payment methods",
};

/**
 * Billing & Subscription Page
 *
 * Allows users to:
 * - View current subscription plan and status
 * - See store usage and limits
 * - Upgrade or downgrade plans
 * - Cancel subscription
 * - Manage payment methods via Stripe Customer Portal
 */
export default function BillingPage() {
  return <BillingContainer />;
}
