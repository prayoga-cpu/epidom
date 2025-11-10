"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const planName = searchParams.get("plan");
  const sessionId = searchParams.get("session_id");

  const handleContinue = () => {
    setIsLoading(true);
    router.push("/profile");
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-100 opacity-75 blur"></div>
            <CheckCircle className="relative h-20 w-20 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t("checkout.success.title")}</h1>
          <p className="text-gray-600">{t("checkout.success.subtitle")}</p>
        </div>

        {/* Details */}
        <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-left">
          {planName && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t("checkout.success.plan")}:</span>
              <span className="font-semibold text-gray-900">{planName}</span>
            </div>
          )}
          {sessionId && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t("checkout.success.orderId")}:</span>
              <span className="font-mono text-sm text-gray-600">
                {sessionId.substring(0, 12)}...
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">{t("checkout.success.status")}:</span>
            <span className="font-semibold text-green-600">{t("checkout.success.active")}</span>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">{t("checkout.success.message")}</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button onClick={handleContinue} disabled={isLoading} className="w-full" size="lg">
            {isLoading ? t("common.loading") : t("checkout.success.continueToProfile")}
          </Button>
        </div>

        {/* Footer Note */}
        <p className="pt-4 text-xs text-gray-500">{t("checkout.success.confirmationEmail")}</p>
      </div>
    </div>
  );
}
