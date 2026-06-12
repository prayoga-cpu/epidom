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
    window.location.href = "mailto:support@epidom.fr";
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-destructive/10 blur-xl"></div>
              <AlertCircle className="relative h-20 w-20 text-destructive animate-pulse" strokeWidth={1.5} />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{t("checkout.failed.title")}</h1>
            <p className="text-muted-foreground text-base">{t("checkout.failed.subtitle")}</p>
          </div>

          {/* Error Details */}
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-left shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-destructive uppercase tracking-wider">
                {t("checkout.failed.reason")}
              </p>
              <p className="mt-1 text-base font-medium text-foreground">{getErrorMessage()}</p>
            </div>
            {sessionId && (
              <div className="border-t border-destructive/10 pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  ID Sesi
                </p>
                <p className="font-mono text-sm text-muted-foreground select-all break-all">{sessionId}</p>
              </div>
            )}
          </div>

          {/* Help Message */}
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-left">
            <p className="text-sm leading-relaxed text-yellow-600 dark:text-yellow-400/90 font-medium">
              {t("checkout.failed.helpMessage")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-base font-semibold btn-smooth"
              size="lg"
            >
              {isLoading ? t("common.loading") : t("checkout.failed.tryAgainButton")}
            </Button>
            <Button
              onClick={handleGoHome}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 rounded-xl text-base font-semibold btn-smooth"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              {isLoading ? t("common.loading") : t("common.goHome")}
            </Button>
          </div>

          {/* Support Link */}
          <div className="pt-2 text-center">
            <p className="text-sm text-muted-foreground">
              {t("common.needHelp")}{" "}
              <button
                onClick={handleContact}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                {t("common.contactSupport")}
              </button>
            </p>
          </div>

          {/* Footer Note */}
          <p className="pt-2 text-xs text-muted-foreground">{t("checkout.failed.chargeNotApplied")}</p>
        </div>
      </div>
    </div>
  );
}
