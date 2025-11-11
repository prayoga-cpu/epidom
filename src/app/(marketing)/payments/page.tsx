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
import { ContactSalesForm } from "@/features/marketing/payments/components/contact-sales-form";
import { PaymentFooter } from "@/features/marketing/payments/components/payment-footer";
import { getValidPlan, type PlanType, isStripePlan } from "@/features/marketing/payments/utils/plan-validation";

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
  const selectedPlan: PlanType = getValidPlan(resolvedSearchParams.plan);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <main className="min-h-screen pt-20 md:pt-24">
        <div className="animate-slide-up">
          <PaymentHero plan={selectedPlan} />
        </div>
        <div className="py-8 md:py-12">
          <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
            {selectedPlan === "enterprise" ? (
              // Enterprise plan - show contact sales form
              <div className="mx-auto max-w-4xl pb-12 md:pb-16 lg:pb-20">
                <div className="animate-slide-up-delayed">
                  <ContactSalesForm />
                </div>
              </div>
            ) : (
              // Starter and Pro plans - show payment form
              // TypeScript: After checking for "enterprise", selectedPlan is narrowed to "starter" | "pro"
              <div className="pb-12 md:pb-16">
                {/* Main Grid: Terms & Summary */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-stretch lg:gap-10">
                  {/* Left Column - Payment Form */}
                  <div className="order-2 lg:order-1 flex flex-col animate-slide-up-delayed">
                    <PaymentForm plan={selectedPlan as "starter" | "pro"} />
                  </div>
                  {/* Right Column - Summary */}
                  <div className="order-1 lg:order-2 flex flex-col animate-slide-up-delayed">
                    <div className="lg:sticky lg:top-24 flex h-full flex-col">
                      <PaymentSummary plan={selectedPlan} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <PaymentFooter />
    </div>
  );
}
