"use client";

/**
 * Payment Summary Component
 *
 * Order summary sidebar showing plan details and pricing.
 * Displays features and billing period for selected plan.
 * Sticky positioning on desktop.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

/**
 * Props for PaymentSummary component
 */
interface PaymentSummaryProps {
  /** Selected plan type */
  plan?: "starter" | "pro" | "enterprise";
}

export function PaymentSummary({ plan = "starter" }: PaymentSummaryProps) {
  const { t } = useI18n();

  const planDetails = {
    starter: {
      title: t("pricing.plans.starter.title"),
      price: "€29",
      period: t("pricing.plans.starter.billing"),
      features: [
        t("pricing.plans.starter.f1"),
        t("pricing.plans.starter.f2"),
        t("pricing.plans.starter.f3"),
      ],
    },
    pro: {
      title: t("pricing.plans.pro.title"),
      price: "€79",
      period: t("pricing.plans.pro.billing"),
      features: [
        t("pricing.plans.pro.f1"),
        t("pricing.plans.pro.f2"),
        t("pricing.plans.pro.f3"),
        t("pricing.plans.pro.f4"),
      ],
    },
    enterprise: {
      title: t("pricing.plans.enterprise.title"),
      price: t("pricing.plans.enterprise.price"),
      period: t("pricing.plans.enterprise.billing"),
      features: [
        t("pricing.plans.enterprise.f1"),
        t("pricing.plans.enterprise.f2"),
        t("pricing.plans.enterprise.f3"),
      ],
    },
  };

  const selectedPlan = planDetails[plan];

  return (
    <Card className="rounded-xl border-2 sm:rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">{t("payments.summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Selection */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold sm:text-lg">{selectedPlan.title}</h3>
            <p className="text-xs text-gray-600 sm:text-sm">{selectedPlan.period}</p>
          </div>
          <Badge variant="secondary" className="w-fit bg-gray-100 text-gray-700">
            {t("payments.summary.selected")}
          </Badge>
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 sm:text-sm">
              {t("payments.summary.subtotal")}
            </span>
            <span className="text-sm font-semibold sm:text-base">{selectedPlan.price}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 sm:text-sm">{t("payments.summary.tax")}</span>
            <span className="text-sm font-semibold sm:text-base">€0.00</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base font-bold sm:text-lg">
            <span>{t("payments.summary.total")}</span>
            <span>{selectedPlan.price}</span>
          </div>
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold sm:text-sm">{t("payments.summary.included")}</h4>
          <ul className="space-y-2">
            {selectedPlan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600 sm:h-4 sm:w-4" />
                <span className="text-xs text-gray-600 sm:text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Billing Info */}
        <div className="space-y-1 text-xs text-gray-500">
          <p className="text-xs">{t("payments.summary.billingInfo1")}</p>
          <p className="text-xs">{t("payments.summary.billingInfo2")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
