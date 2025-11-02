"use client";

/**
 * Payment Security Component
 *
 * Security badges and trust signals for payment pages.
 * Displays SSL, PCI compliance, and encryption features.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, CreditCard, CheckCircle } from "lucide-react";

export function PaymentSecurity() {
  const { t } = useI18n();

  const securityFeatures = [
    {
      icon: Shield,
      title: t("payments.security.feature1.title"),
      description: t("payments.security.feature1.description"),
    },
    {
      icon: CreditCard,
      title: t("payments.security.feature2.title"),
      description: t("payments.security.feature2.description"),
    },
    {
      icon: Lock,
      title: t("payments.security.feature3.title"),
      description: t("payments.security.feature3.description"),
    },
  ];

  return (
    <Card className="rounded-xl border-2 bg-gray-50 sm:rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Shield className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
          {t("payments.security.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {securityFeatures.map((feature, index) => (
          <div key={index} className="flex items-start gap-2 sm:gap-3">
            <feature.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 sm:h-5 sm:w-5" />
            <div>
              <h4 className="text-xs font-semibold sm:text-sm">{feature.title}</h4>
              <p className="text-xs leading-relaxed text-gray-600">{feature.description}</p>
            </div>
          </div>
        ))}

        <div className="border-t border-gray-200 pt-2">
          <p className="text-center text-xs leading-relaxed text-gray-500">
            {t("payments.security.footer")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
