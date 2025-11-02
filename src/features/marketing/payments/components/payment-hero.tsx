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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Props for PaymentHero component
 */
interface PaymentHeroProps {
  /** Selected plan: starter, pro, or enterprise */
  plan: "starter" | "pro" | "enterprise";
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

  return (
    <section className="py-8 md:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <div className="text-center">
          <Button asChild variant="ghost" className="mb-6 text-gray-600 hover:text-gray-900">
            <Link href="/pricing" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("payments.backToPricing")}
            </Link>
          </Button>

          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 md:text-xl">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
