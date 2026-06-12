"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { useState } from "react";
import { getStatusColor, getStatusLabel, getPlanDetails } from "@/lib/utils/subscription-helpers";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatDate } from "@/lib/utils/format-date";

interface SubscriptionInfoCardProps {
  subscription?: {
    plan: string;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export function SubscriptionInfoCard({ subscription: initialSubscription }: SubscriptionInfoCardProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    try {
      setIsLoadingPortal(true);
      setPortalError(null);

      const response = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        // Show specific error for portal not configured
        if (response.status === 503) {
          setPortalError(
            "Billing portal is not yet configured. Please contact support or visit the Stripe dashboard to set it up."
          );
        } else {
          throw new Error(data.error || "Failed to open billing portal");
        }
        return;
      }

      // Redirect to Stripe customer portal
      window.location.href = data.data.url;
    } catch (error: any) {
      setPortalError(error.message || "Failed to open billing portal");
      setIsLoadingPortal(false);
    }
  };

  // Treat missing subscription as an active FREE plan
  const subscription = initialSubscription || {
    plan: "FREE",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };

  const planDetails = getPlanDetails(subscription.plan, t, currency);
  const isActive = subscription.status === "ACTIVE";
  const isPastDue = subscription.status === "PAST_DUE";

  return (
    <Card className="h-full border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">{t("profile.subscription.title")}</CardTitle>
        <div className="flex gap-2">
          {subscription.cancelAtPeriodEnd && (
            <Badge
              variant="outline"
              className="border-yellow-500 text-yellow-700 dark:text-yellow-500"
            >
              {t("profile.subscription.status.canceling")}
            </Badge>
          )}
          <Badge className={getStatusColor(subscription.status)}>
            {getStatusLabel(subscription.status, t)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-6">
          {/* Plan Details */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  {t("profile.subscription.currentPlan")}
                </p>
                <p className={`text-2xl font-bold ${planDetails.color}`}>{planDetails.name}</p>
              </div>
              <p className="text-xl font-semibold">{planDetails.price}</p>
            </div>
          </div>

          {/* Billing Period */}
          {subscription.plan !== "FREE" && subscription.currentPeriodStart && subscription.currentPeriodEnd && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">
                  {t("profile.subscription.billingPeriod")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("profile.subscription.periodStart")}
                  </p>
                  <p className="font-semibold">{formatDate(subscription.currentPeriodStart)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("profile.subscription.periodEnd")}
                  </p>
                  <p className="font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {subscription.cancelAtPeriodEnd && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {t("profile.subscription.warnings.ending.title")}
                </p>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                  {t("profile.subscription.warnings.ending.description")}
                </p>
              </div>
            </div>
          )}

          {isPastDue && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {t("profile.subscription.warnings.pastDue.title")}
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {t("profile.subscription.warnings.pastDue.description")}
                </p>
              </div>
            </div>
          )}

          {portalError && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Portal Configuration
                </p>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{portalError}</p>
                <Link
                  href="https://dashboard.stripe.com/test/settings/billing/portal"
                  target="_blank"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-200"
                >
                  Go to Stripe Dashboard
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Actions - Always at bottom */}
        <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
          {subscription.plan === "FREE" ? (
            <Button
              variant="default"
              asChild
              className="w-full sm:flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <Link href="/pricing">Upgrade Plan</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="group w-full gap-2 sm:flex-1 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 active:scale-95"
              onClick={handleManageBilling}
              disabled={isLoadingPortal}
            >
              {isLoadingPortal ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Loading...</span>
                  <span className="sm:hidden">Loading</span>
                </>
              ) : (
                <>
                  {subscription.cancelAtPeriodEnd ? (
                    <>
                      <span className="hidden sm:inline">
                        {t("profile.subscription.renewSubscription")}
                      </span>
                      <span className="sm:hidden">{t("profile.subscription.renew")}</span>
                    </>
                  ) : (
                    <div className="relative flex w-full overflow-hidden">
                      <span className="w-full transition-transform duration-300 group-hover:-translate-y-[150%]">
                        Change Plan
                      </span>
                      <span className="absolute inset-0 w-full translate-y-[150%] font-medium text-emerald-600 transition-transform duration-300 group-hover:translate-y-0 dark:text-emerald-400">
                        or Manage your Billing
                      </span>
                    </div>
                  )}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
