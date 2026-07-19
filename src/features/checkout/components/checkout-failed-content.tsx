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
    window.location.href = "mailto:cro@prionation.io,ceo@prionation.io,consult@prionation.io";
  };

  return (
    <div className="bg-background min-h-[100dvh]">
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="bg-destructive/10 absolute inset-0 rounded-full blur-xl"></div>
              <AlertCircle
                className="text-destructive relative h-20 w-20 animate-pulse"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-foreground text-4xl font-bold tracking-tight">
              {t("checkout.failed.title")}
            </h1>
            <p className="text-muted-foreground text-base">{t("checkout.failed.subtitle")}</p>
          </div>

          {/* Error Details */}
          <div className="border-destructive/20 bg-destructive/5 space-y-4 rounded-2xl border p-6 text-left shadow-sm">
            <div>
              <p className="text-destructive text-sm font-semibold tracking-wider uppercase">
                {t("checkout.failed.reason")}
              </p>
              <p className="text-foreground mt-1 text-base font-medium">{getErrorMessage()}</p>
            </div>
            {sessionId && (
              <div className="border-destructive/10 border-t pt-4">
                <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                  ID Sesi
                </p>
                <p className="text-muted-foreground font-mono text-sm break-all select-all">
                  {sessionId}
                </p>
              </div>
            )}
          </div>

          {/* Help Message */}
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-left">
            <p className="text-sm leading-relaxed font-medium text-yellow-600 dark:text-yellow-400/90">
              {t("checkout.failed.helpMessage")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isLoading}
              className="btn-smooth h-12 w-full rounded-xl text-base font-semibold"
              size="lg"
            >
              {isLoading ? t("common.loading") : t("checkout.failed.tryAgainButton")}
            </Button>
            <Button
              onClick={handleGoHome}
              disabled={isLoading}
              variant="outline"
              className="btn-smooth h-12 w-full rounded-xl text-base font-semibold"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              {isLoading ? t("common.loading") : t("common.goHome")}
            </Button>
          </div>

          {/* Support Link */}
          <div className="pt-2 text-center">
            <p className="text-muted-foreground text-sm">
              {t("common.needHelp")}{" "}
              <button
                onClick={handleContact}
                className="text-primary cursor-pointer font-semibold hover:underline"
              >
                {t("common.contactSupport")}
              </button>
            </p>
          </div>

          {/* Footer Note */}
          <p className="text-muted-foreground pt-2 text-xs">
            {t("checkout.failed.chargeNotApplied")}
          </p>
        </div>
      </div>
    </div>
  );
}
