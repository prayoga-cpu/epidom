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
import { type PlanType, getValidPlan } from "../utils/plan-validation";

/**
 * Props for PaymentSummary component
 */
interface PaymentSummaryProps {
  /** Selected plan type */
  plan?: PlanType;
}

export function PaymentSummary({ plan }: PaymentSummaryProps) {
  const { t } = useI18n();
  const selectedPlan = getValidPlan(plan);

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

  const planDetail = planDetails[selectedPlan];

  return (
    <Card className="h-full rounded-xl border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-brand-primary">
          {t("payments.summary.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Selection */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold sm:text-lg text-brand-primary">
              {planDetail.title}
            </h3>
            <p className="text-sm text-gray-600">{planDetail.period}</p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit border bg-brand-primary text-white border-brand-primary"
          >
            {t("payments.summary.selected")}
          </Badge>
        </div>

        <Separator className="bg-gray-200" />

        {/* Pricing */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t("payments.summary.subtotal")}</span>
            <span className="text-base font-semibold text-brand-primary">{planDetail.price}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t("payments.summary.tax")}</span>
            <span className="text-base font-semibold text-brand-primary">{t("payments.form.taxAmount")}</span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between text-lg font-bold text-brand-primary">
            <span>{t("payments.summary.total")}</span>
            <span>{planDetail.price}</span>
          </div>
        </div>

        <Separator className="bg-gray-200" />

        {/* Features */}
        <div className="space-y-2.5">
          <h4 className="text-sm font-semibold text-brand-primary">
            {t("payments.summary.included")}
          </h4>
          <ul className="space-y-2">
            {planDetail.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" />
                <span className="text-sm text-gray-600 leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="bg-gray-200" />

        {/* Billing Info */}
        <div className="rounded-lg bg-gray-50 p-3 space-y-1">
          <p className="text-xs text-gray-600 font-medium">{t("payments.summary.billingInfo1")}</p>
          <p className="text-xs text-gray-600">{t("payments.summary.billingInfo2")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
