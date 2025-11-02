/**
 * Payments Page
 *
 * Payment checkout page with dynamic plan selection via query params.
 * Enterprise plan shows contact sales form, others show payment form.
 * Responsive layout: form 2/3 width (left), summary 1/3 (right).
 *
 * @page
 */

import { PaymentHero } from "@/features/marketing/payments/components/payment-hero";
import { PaymentForm } from "@/features/marketing/payments/components/payment-form";
import { PaymentSummary } from "@/features/marketing/payments/components/payment-summary";
import { PaymentSecurity } from "@/features/marketing/payments/components/payment-security";
import { ContactSalesForm } from "@/features/marketing/payments/components/contact-sales-form";

/**
 * Props for PaymentsPage component
 */
interface PaymentsPageProps {
  searchParams: Promise<{
    plan?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const resolvedSearchParams = await searchParams;
  const plan = resolvedSearchParams.plan as "starter" | "pro" | "enterprise" | undefined;
  const isValidPlan = plan && ["starter", "pro", "enterprise"].includes(plan);

  // If no valid plan is selected, default to starter
  const selectedPlan = isValidPlan ? plan : "starter";

  return (
    <main
      className="min-h-screen bg-white pt-24 md:pt-32"
      style={{ color: "var(--color-brand-primary)" }}
    >
      <div className="animate-slide-up">
        <PaymentHero plan={selectedPlan} />
      </div>
      <div className="animate-slide-up-delayed">
        <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
          {selectedPlan === "enterprise" ? (
            // Enterprise plan - show contact sales form
            <div className="mx-auto max-w-4xl">
              <ContactSalesForm />
            </div>
          ) : (
            // Starter and Pro plans - show payment form
            <div
              className="grid grid-cols-1 gap-6 md:gap-12 lg:grid-cols-3 lg:grid-rows-1 lg:gap-8"
              style={{ gridTemplateRows: "1fr" }}
            >
              <div className="order-2 lg:order-1 lg:col-span-2">
                <PaymentForm plan={selectedPlan} />
              </div>
              <div className="order-1 lg:order-2 lg:col-span-1">
                <div className="h-full space-y-4 lg:sticky lg:top-8 lg:space-y-6">
                  <PaymentSummary plan={selectedPlan} />
                  <PaymentSecurity />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
