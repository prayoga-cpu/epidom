"use client";

/**
 * Payment Hero Component
 *
 * Hero banner for payment checkout pages.
 * Shows dynamic title/subtitle based on selected plan.
 * Includes back button to pricing page.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { type PlanType } from "../utils/plan-validation";
import { Container } from "@/features/marketing/shared/components/container";

/**
 * Props for PaymentHero component
 */
interface PaymentHeroProps {
  /** Selected plan: starter, pro, or enterprise */
  plan: PlanType;
}

export function PaymentHero({ plan }: PaymentHeroProps) {
  const { t } = useI18n();

  const getHeroContent = () => {
    if (plan === "enterprise") {
      return {
        title: t("payments.enterprise.hero.title"),
        subtitle: t("payments.enterprise.hero.subtitle"),
      };
    }
    return {
      title: t("payments.hero.title"),
      subtitle: t("payments.hero.subtitle"),
    };
  };

  const { title, subtitle } = getHeroContent();

  // Step indicator only shown for starter and pro plans (not enterprise)
  const showSteps = plan !== "enterprise";

  const steps = [
    { id: 1, label: t("payments.steps.step1"), completed: true },
    { id: 2, label: t("payments.steps.step2"), completed: false, active: true },
    { id: 3, label: t("payments.steps.step3"), completed: false },
  ];

  return (
    <section className="py-8 md:py-12 lg:py-16">
      <Container maxWidth="7xl">
        <div className="text-center">
          <Button asChild variant="ghost" className="mb-6 text-gray-600 hover:opacity-80">
            <Link href="/pricing" className="flex items-center gap-2 text-brand-primary">
              <ArrowLeft className="h-4 w-4" />
              {t("payments.backToPricing")}
            </Link>
          </Button>

          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl text-brand-primary">
            {title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 md:text-xl mb-8">
            {subtitle}
          </p>

          {/* Step Indicator - Only for starter and pro plans */}
          {showSteps && (
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    {/* Step Circle */}
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <div
                        className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-colors ${
                          step.completed
                            ? "border-brand-primary bg-brand-primary text-white"
                            : step.active
                              ? "border-brand-primary bg-white text-brand-primary"
                              : "border-gray-300 bg-white text-gray-400"
                        }`}
                      >
                        {step.completed ? (
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : (
                          <span className="text-[10px] sm:text-xs font-semibold">{step.id}</span>
                        )}
                      </div>
                      <span
                        className={`mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium text-center ${
                          step.active
                            ? "text-brand-primary"
                            : step.completed
                              ? "text-gray-600"
                              : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>

                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div
                        className={`mx-1 sm:mx-2 h-0.5 w-8 sm:w-12 transition-colors ${
                          step.completed ? "bg-brand-primary" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("payments.steps.current")}
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
