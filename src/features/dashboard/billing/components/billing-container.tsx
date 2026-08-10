"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  XCircle,
  ExternalLink,
  Calendar,
  Store,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/components/providers/currency-provider";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { getStatusColor, getStatusLabel } from "@/lib/utils/subscription-helpers";
import { isLifetimePeriod } from "@/lib/utils/formatting";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { useConfirm } from "@/components/ui/use-confirm";
import { BetaPlanSwitcher } from "./beta-plan-switcher";

// Epidom's SaaS subscription is billed in IDR. Kept in sync with the public
// /pricing page's monthly rate (redesign.pricingPage.t2price_mo/t3price_mo —
// Rp 229k / Rp 459k, i.e. $14.99 / $29.99 at the charm-priced USD rate).
// docs/BILLING.md's Rp 99k/249k table predates a since-applied price raise
// and is stale; the live /pricing copy is the source of truth. Every display
// currency is derived from this IDR base via useCurrency(), the same
// IDR->userCurrency conversion the rest of the dashboard already relies on.
const PLAN_PRICE_IDR: Record<string, number> = {
  POS: 229000,
  OPERATIONS: 459000,
};

export function BillingContainer() {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const { data, isLoading: loading, error: subscriptionError } = useSubscriptionStatus();
  const { confirm, confirmDialog } = useConfirm();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success");
  const plan = searchParams.get("plan");

  const handleManagePayment = async () => {
    try {
      setActionLoading(true);
      const response = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(result, "Failed to open customer portal"));
      }

      // Redirect to Stripe Customer Portal
      window.location.href = result.data.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const ok = await confirm({
      title: t("billing.cancelSubscription"),
      description: t("billing.confirmCancel"),
      variant: "destructive",
      confirmText: t("billing.cancelSubscription"),
      cancelText: t("actions.cancel"),
    });
    if (!ok) return;

    try {
      setActionLoading(true);
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(result, "Failed to cancel subscription"));
      }

      // Refresh page to update subscription status
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push("/pricing#plans");
  };

  if (loading) {
    return <BillingLoadingSkeleton />;
  }

  if (error || subscriptionError) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || subscriptionError?.message || "Failed to load subscription data"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data?.hasSubscription) {
    return <NoSubscriptionState />;
  }

  const { subscription, storeUsage } = data;

  // Only show Stripe billing actions when they can actually succeed.
  const canManage = !!subscription?.canManagePayment;
  const canCancel = !!subscription?.canCancel && !subscription?.cancelAtPeriodEnd;
  // Admin-granted (BETA) accounts switch plans freestyle, with no Stripe billing.
  const isBeta = !!subscription?.isBeta;

  const planName =
    subscription?.plan === "FREE"
      ? "Free"
      : subscription?.plan === "POS"
        ? t("profile.subscription.plans.starter")
        : subscription?.plan === "OPERATIONS"
          ? t("profile.subscription.plans.pro")
          : t("profile.subscription.plans.enterprise");

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {t("billing.subscriptionActivated")?.replace(
              "{plan}",
              plan === "POS"
                ? t("profile.subscription.plans.starter")
                : t("profile.subscription.plans.pro")
            ) ||
              `Subscription activated successfully! Welcome to ${plan === "POS" ? "Starter" : "Pro"} plan.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation Notice */}
      {subscription?.cancelAtPeriodEnd && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {t("billing.subscriptionWillCancel")?.replace(
              "{date}",
              subscription.currentPeriodEnd
                ? formatDate(subscription.currentPeriodEnd)
                : t("billing.nextBilling") || "the end of the billing period"
            ) ||
              `Your subscription will be canceled on ${subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "the end of the billing period"}. You'll retain access until then.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("billing.currentPlan")}
          </CardTitle>
          <CardDescription>{t("billing.title")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Info */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{planName}</h3>
                <Badge className={getStatusColor(subscription?.status)}>
                  {getStatusLabel(subscription?.status, t)}
                </Badge>
                {isBeta && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  >
                    BETA
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {subscription?.plan === "FREE"
                  ? "Free forever"
                  : subscription?.plan && PLAN_PRICE_IDR[subscription.plan]
                    ? `${formatPrice(PLAN_PRICE_IDR[subscription.plan])}${t("billing.perMonth")}`
                    : t("profile.subscription.pricing.enterprise")}
              </p>
            </div>
            {subscription?.plan === "POS" && (
              <Button
                onClick={handleUpgrade}
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
              >
                {t("billing.upgradeToPro")}
              </Button>
            )}
          </div>

          {/* Billing Period */}
          {subscription?.currentPeriodEnd && (
            <div className="flex items-center gap-2 rounded-lg border p-4">
              <Calendar className="text-muted-foreground h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {isLifetimePeriod(subscription.currentPeriodEnd)
                    ? t("billing.lifetime")
                    : t("billing.nextBilling")}
                </p>
                {!isLifetimePeriod(subscription.currentPeriodEnd) && (
                  <p className="text-muted-foreground text-sm">
                    {formatDate(subscription.currentPeriodEnd, "PPP")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Store Usage */}
          {storeUsage && (
            <div className="flex items-center gap-2 rounded-lg border p-4">
              <Store className="text-muted-foreground h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("billing.storeUsage")}</p>
                <p className="text-muted-foreground text-sm">
                  {storeUsage.current} /{" "}
                  {storeUsage.limit === Infinity ? t("billing.unlimited") : storeUsage.limit}{" "}
                  {t("billing.stores")}
                </p>
              </div>
              {!storeUsage.canCreateMore && subscription?.plan === "POS" && (
                <Badge variant="secondary">{t("billing.limitReached")}</Badge>
              )}
            </div>
          )}

          {/* Actions */}
          {isBeta ? (
            <div className="space-y-2 border-t pt-6">
              <p className="text-muted-foreground text-sm">{t("billing.betaAccount")}</p>
              <BetaPlanSwitcher currentPlan={subscription?.plan ?? "FREE"} />
            </div>
          ) : canManage || canCancel ? (
            <div className="flex flex-wrap gap-3 border-t pt-6">
              {canManage && (
                <Button
                  onClick={handleManagePayment}
                  disabled={actionLoading}
                  variant="outline"
                  className="gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {t("billing.managePayment")}
                </Button>
              )}

              {canCancel && (
                <Button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  variant="destructive"
                  className="gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t("billing.cancelSubscription")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-t pt-6">
              <p className="text-muted-foreground text-sm">
                {t("billing.notStripeManaged")?.replace("{plan}", planName) ||
                  `You're on the ${planName} plan — there's no payment method or subscription to manage. Upgrade to unlock paid features.`}
              </p>
              {(subscription?.plan === "FREE" || subscription?.plan === "POS") && (
                <Button onClick={handleUpgrade} className="gap-2">
                  <ArrowUpCircle className="h-4 w-4" />
                  {t("billing.viewPlans")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      {subscription?.plan === "POS" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.availablePlans")}</CardTitle>
            <CardDescription>{t("billing.comparePlans")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleUpgrade} className="w-full">
              {t("billing.viewPlans")}
            </Button>
          </CardContent>
        </Card>
      )}
      {confirmDialog}
    </div>
  );
}

function BillingLoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

function NoSubscriptionState() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="container mx-auto max-w-4xl py-16">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="text-muted-foreground mb-4 h-16 w-16" />
          <h2 className="mb-2 text-2xl font-bold">{t("billing.noSubscription")}</h2>
          <p className="text-muted-foreground mb-6">{t("billing.noSubscriptionDesc")}</p>
          <Button onClick={() => router.push("/pricing#plans")} size="lg" className="gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            {t("billing.viewPlans")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
