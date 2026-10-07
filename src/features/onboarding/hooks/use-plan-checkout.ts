"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { PriceCurrency } from "@/lib/constants/plan-pricing";
import { trackConversion, trackMetaPixelEvent } from "@/lib/analytics";
import type { PlanCheckout } from "../lib/plan-intent";

export type PlanCheckoutStatus = "idle" | "redirecting" | "failed";

export interface UsePlanCheckoutOptions {
  checkout: PlanCheckout | null;
  /** The currency to charge in: the one Billing quotes for this store. */
  currency: PriceCurrency;
  /** Where Stripe's success and cancel pages lead on to (the new store's dashboard). */
  next: string;
}

/**
 * Opens Stripe Checkout for the plan the owner picked during setup. A POS
 * trial collects a card and charges nothing for 14 days (the server decides
 * the trial, see posTrialApplies). `start` leaves the page on success; on a
 * failure the status goes to "failed" and a toast says so, so the launch
 * screen can offer the button again.
 */
export function usePlanCheckout({ checkout, currency, next }: UsePlanCheckoutOptions) {
  const { t } = useI18n();
  const [status, setStatus] = useState<PlanCheckoutStatus>("idle");

  // Back from Stripe can restore this page from the browser's cache exactly as
  // it was left, mid-redirect. Offer the button again instead of a spinner
  // that never ends.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setStatus("idle");
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const start = useCallback(async () => {
    if (!checkout) return;
    setStatus("redirecting");
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: checkout.plan,
          yearly: checkout.yearly,
          currency,
          next,
        }),
      });
      const data = await res.json().catch(() => null);
      const url: unknown = data?.data?.url;
      if (!res.ok || typeof url !== "string") throw new Error("checkout");

      trackConversion("begin_checkout", {
        event_label: checkout.plan,
        plan: checkout.plan,
        trial: checkout.trial,
        billing_interval: checkout.yearly ? "yearly" : "monthly",
        source: "onboarding",
      });
      trackMetaPixelEvent("InitiateCheckout", {
        content_name: checkout.plan,
        content_category: checkout.trial ? "trial" : "paid",
      });
      window.location.assign(url);
    } catch {
      setStatus("failed");
      toast.error(t("onboarding.launch.plan.failed"));
    }
  }, [checkout, currency, next, t]);

  return { status, start };
}
