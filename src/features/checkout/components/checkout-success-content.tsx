"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supplierOrderKeys } from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import { useSession } from "@/lib/auth-client";
import { trackConversion } from "@/lib/analytics";

export function CheckoutSuccessContent() {
  const { t } = useI18n();
  const { refetch } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const planName = searchParams.get("plan");
  const sessionId = searchParams.get("session_id");
  const trackedRef = useRef(false);

  // Invalidate subscription-gated caches when subscription changes (after upgrade)
  useEffect(() => {
    // Guard against firing twice on remount/back-navigation to this page.
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackConversion("subscription_started", {
        event_label: planName ?? "unknown",
        plan: planName,
      });
    }

    // Invalidate subscription status first (to get new plan info)
    queryClient.invalidateQueries({
      queryKey: ["subscription-status"],
      exact: false,
    });

    // Invalidate all supplier orders queries to clear 403 cache
    queryClient.invalidateQueries({
      queryKey: supplierOrderKeys.all,
      exact: false,
    });

    // Invalidate all suppliers queries to clear 403 cache
    queryClient.invalidateQueries({
      queryKey: ["suppliers"],
      exact: false,
    });

    // Invalidate export-related caches
    queryClient.invalidateQueries({
      queryKey: ["materials"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["products"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["recipes"],
      exact: false,
    });

    // Force session refetch to refresh subscription status
    refetch?.();
  }, [queryClient, refetch]);

  const handleContinue = () => {
    setIsLoading(true);
    router.push("/profile");
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl"></div>
              <CheckCircle className="relative h-24 w-24 text-emerald-500" strokeWidth={1.5} />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-foreground text-4xl font-bold tracking-tight">
              {t("checkout.success.title")}
            </h1>
            <p className="text-muted-foreground">{t("checkout.success.subtitle")}</p>
          </div>

          {/* Details */}
          <div className="bg-card space-y-4 rounded-2xl border p-6 text-left shadow-sm">
            {planName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  {t("checkout.success.plan")}
                </span>
                <span className="text-foreground font-semibold">{planName}</span>
              </div>
            )}
            {sessionId && (
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-sm font-medium">
                  {t("checkout.success.orderId")}
                </span>
                <span className="text-muted-foreground font-mono text-sm">
                  {sessionId.substring(0, 14)}...
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground text-sm font-medium">
                {t("checkout.success.status")}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                {t("checkout.success.active")}
              </span>
            </div>
          </div>

          {/* Message */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {t("checkout.success.message")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleContinue}
              disabled={isLoading}
              className="h-12 w-full rounded-xl text-base"
              size="lg"
            >
              {isLoading ? t("common.loading") : t("checkout.success.continueToProfile")}
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-muted-foreground pt-2 text-xs">
            {t("checkout.success.confirmationEmail")}
          </p>
        </div>
      </div>
    </div>
  );
}
