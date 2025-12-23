import { Suspense } from "react";
import { Metadata } from "next";
import { BillingContainer } from "@/features/dashboard/billing/components/billing-container";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Billing & Subscription | Epidom",
  description: "Manage your subscription, billing, and payment methods",
};

function BillingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

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
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContainer />
    </Suspense>
  );
}

