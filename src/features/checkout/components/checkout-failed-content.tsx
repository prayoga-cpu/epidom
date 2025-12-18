"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export function CheckoutFailedContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const reason = searchParams.get("reason");
  const sessionId = searchParams.get("session_id");

  const getErrorMessage = () => {
    switch (reason) {
      case "payment_failed":
        return t("checkout.failed.paymentFailed");
      case "canceled":
        return t("checkout.failed.canceled");
      case "expired":
        return t("checkout.failed.sessionExpired");
      default:
        return t("checkout.failed.unknownError");
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    router.push("/pricing");
  };

  const handleGoHome = () => {
    setIsLoading(true);
    router.push("/");
  };

  const handleContact = () => {
    window.location.href = "mailto:support@epidom.com";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-100 opacity-75 blur"></div>
              <AlertCircle className="relative h-20 w-20 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">{t("checkout.failed.title")}</h1>
            <p className="text-gray-600">{t("checkout.failed.subtitle")}</p>
          </div>

          {/* Error Details */}
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-left">
              <p className="mb-1 text-sm font-semibold text-red-800">
                {t("checkout.failed.reason")}:
              </p>
              <p className="text-sm text-red-700">{getErrorMessage()}</p>
            </div>
            {sessionId && (
              <div className="border-t border-red-200 pt-2 text-left">
                <p className="font-mono text-xs text-red-600">{sessionId}</p>
              </div>
            )}
          </div>

          {/* Help Message */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm leading-relaxed text-yellow-800">
              {t("checkout.failed.helpMessage")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button onClick={handleRetry} disabled={isLoading} className="w-full" size="lg">
              {isLoading ? t("common.loading") : t("checkout.failed.tryAgainButton")}
            </Button>
            <Button
              onClick={handleGoHome}
              disabled={isLoading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              {isLoading ? t("common.loading") : t("common.goHome")}
            </Button>
          </div>

          {/* Support Link */}
          <div className="pt-4 text-center">
            <p className="text-sm text-gray-600">
              {t("common.needHelp")}{" "}
              <button
                onClick={handleContact}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                {t("common.contactSupport")}
              </button>
            </p>
          </div>

          {/* Footer Note */}
          <p className="pt-4 text-xs text-gray-500">{t("checkout.failed.chargeNotApplied")}</p>
        </div>
      </div>
    </div>
  );
}
