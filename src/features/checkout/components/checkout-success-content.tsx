"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { CheckCircle, PartyPopper } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supplierOrderKeys } from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useSession } from "@/lib/auth-client";
import { trackConversion, trackMetaPixelEvent } from "@/lib/analytics";
import { safeInternalPath } from "@/lib/safe-redirect";
import { planChargeAmount } from "@/lib/constants/plan-pricing";

/**
 * True the first time a Checkout session is seen in this tab, false after:
 * a reload of this page, or Back to it, must not count the conversion again.
 * Without a session id (an older link) there is nothing to remember it by.
 */
function firstVisitOf(sessionId: string | null): boolean {
  if (!sessionId) return true;
  const key = `epidom:checkout-tracked:${sessionId}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: count it, as before.
  }
  return true;
}

export function CheckoutSuccessContent() {
  const { t } = useI18n();
  const { refetch } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const planName = searchParams.get("plan");
  const sessionId = searchParams.get("session_id");
  const isTrial = searchParams.get("trial") === "true";
  // Set by /api/subscriptions/checkout: the conversion's value is the plan's
  // first charge in the currency the page quoted.
  const yearly = searchParams.get("billing") === "yearly";
  const currency = searchParams.get("currency");
  // Set by /api/subscriptions/checkout when the setup wizard opened Checkout:
  // the new store's dashboard, instead of the profile page.
  const next = safeInternalPath(searchParams.get("next"));
  const trackedRef = useRef(false);

  // Invalidate subscription-gated caches when subscription changes (after upgrade)
  useEffect(() => {
    // Guard against firing twice on remount/back-navigation to this page.
    if (!trackedRef.current && firstVisitOf(sessionId)) {
      trackedRef.current = true;
      const charge = planChargeAmount(planName, currency, yearly);
      // The Checkout session id, as Meta's eventID: one checkout, one event,
      // also if a server-side copy is ever sent.
      const metaOptions = sessionId ? { eventId: sessionId } : undefined;
      trackConversion("subscription_started", {
        event_label: planName ?? "unknown",
        plan: planName,
        // A trial's value rides on trial_started only, so GA doesn't count it twice.
        ...(isTrial ? {} : charge),
      });

      if (isTrial) {
        // A trial hasn't actually paid yet — track it as its own funnel
        // stage (GA4 trial_started, Meta's StartTrial) rather than folding
        // it into subscription_started/Subscribe, which represent real
        // payment.
        trackConversion("trial_started", {
          event_label: planName ?? "unknown",
          plan: planName,
          ...charge,
        });
        // value = what the first charge after the trial will be.
        trackMetaPixelEvent(
          "StartTrial",
          { content_name: planName ?? undefined, ...charge },
          metaOptions
        );
      } else {
        // Standard Meta event for a real (non-trial) paid subscription —
        // lets Meta optimize/retarget against actual subscribers.
        trackMetaPixelEvent(
          "Subscribe",
          { content_name: planName ?? undefined, ...charge },
          metaOptions
        );
      }
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
    router.push(next ?? "/profile");
  };

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] items-center justify-center px-4 py-12">
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
              {t(isTrial ? "checkout.success.trialTitle" : "checkout.success.title")}
            </h1>
            <p className="text-muted-foreground">
              {t(isTrial ? "checkout.success.trialSubtitle" : "checkout.success.subtitle")}
            </p>
          </div>

          {/* Congratulations: a trial chose Epidom too. */}
          <div className="border-epi-gold-500/40 bg-epi-gold-500/10 space-y-2 rounded-2xl border p-5">
            <PartyPopper
              className="text-epi-gold-600 dark:text-epi-gold-400 mx-auto size-8"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <h2 className="text-foreground text-lg font-semibold">
              {t("checkout.success.congratsTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("checkout.success.congratsBody")}</p>
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
                {t(isTrial ? "checkout.success.trialStatus" : "checkout.success.active")}
              </span>
            </div>
          </div>

          {/* Message */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {t(isTrial ? "checkout.success.trialMessage" : "checkout.success.message")}
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
              {isLoading
                ? t("common.loading")
                : next
                  ? t("checkout.success.continueToStore")
                  : t("checkout.success.continueToProfile")}
            </Button>
          </div>

          {/* Footer Note: a trial paid nothing, so there is no receipt to mention. */}
          {!isTrial && (
            <p className="text-muted-foreground pt-2 text-xs">
              {t("checkout.success.confirmationEmail")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
