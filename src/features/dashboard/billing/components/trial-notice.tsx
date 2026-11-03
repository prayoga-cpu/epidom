"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CreditCard, Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/utils/api-error";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The POS trial on Billing: days left and, while no card is saved, the way to
 * keep POS after it. The trial starts without a card (startPosTrial); Stripe
 * ends it on the last day unless one was added here, and the account goes
 * back to Free with its data kept.
 */
export function TrialNotice({
  trialEndsAt,
  returnPath,
}: {
  trialEndsAt: string;
  returnPath: string;
}) {
  const { t, formatDate } = useI18n();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asked only while a trial runs, so the status route never waits on Stripe.
  const {
    data: hasPaymentMethod,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["subscription-payment-method"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/payment-method");
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(body, "payment-method"));
      return !!body?.data?.hasPaymentMethod;
    },
    staleTime: 60_000,
  });

  const endsAt = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_MS));
  const title =
    daysLeft > 1
      ? t("billing.trial.title").replace("{days}", String(daysLeft))
      : daysLeft === 1
        ? t("billing.trial.titleOneDay")
        : t("billing.trial.titleLastDay");
  const date = formatDate(trialEndsAt, "PPP");

  const addCard = async () => {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.data?.url !== "string") throw new Error("portal");
      window.location.href = body.data.url;
    } catch {
      setError(t("billing.trial.error"));
      setOpening(false);
    }
  };

  // Until Stripe answers, say nothing about the card rather than guess.
  const body =
    isLoading || hasPaymentMethod === undefined
      ? null
      : t(hasPaymentMethod ? "billing.trial.cardBody" : "billing.trial.noCardBody")
          .split("{date}")
          .join(date);

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="line-clamp-none">{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        {body && <p>{body}</p>}
        {/* If Stripe couldn't be asked, still offer the card form. */}
        {(hasPaymentMethod === false || isError) && (
          <Button onClick={addCard} disabled={opening} className="h-10 w-full gap-2 sm:w-auto">
            {opening ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {t("billing.trial.addCard")}
          </Button>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </AlertDescription>
    </Alert>
  );
}
