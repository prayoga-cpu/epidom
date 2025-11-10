"use client";

import { useEffect, useState } from "react";
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
import { SubscriptionStatus } from "@prisma/client";

interface SubscriptionData {
  hasSubscription: boolean;
  subscription: {
    id: string;
    plan: string;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  storeUsage: {
    current: number;
    limit: number;
    canCreateMore: boolean;
  } | null;
}

export function BillingContainer() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success");
  const plan = searchParams.get("plan");

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/subscriptions/status");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch subscription data");
      }

      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManagePayment = async () => {
    try {
      setActionLoading(true);
      const response = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to open customer portal");
      }

      // Redirect to Stripe Customer Portal
      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.")) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to cancel subscription");
      }

      // Refresh data
      await fetchSubscriptionData();
      setActionLoading(false);
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  if (loading) {
    return <BillingLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data?.hasSubscription) {
    return <NoSubscriptionState />;
  }

  const { subscription, storeUsage } = data;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Subscription activated successfully! Welcome to {plan === "STARTER" ? "Starter" : "Pro"} plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation Notice */}
      {subscription?.cancelAtPeriodEnd && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription will be canceled on{" "}
            {subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : "the end of the billing period"}
            . You'll retain access until then.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{subscription?.plan} Plan</h3>
                <StatusBadge status={subscription?.status || "INCOMPLETE"} />
              </div>
              <p className="text-sm text-muted-foreground">
                {subscription?.plan === "STARTER"
                  ? "€29/month - Perfect for single location"
                  : "€79/month - For growing businesses"}
              </p>
            </div>
            {subscription?.plan === "STARTER" && (
              <Button onClick={handleUpgrade} variant="outline" className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Upgrade to Pro
              </Button>
            )}
          </div>

          {/* Billing Period */}
          {subscription?.currentPeriodEnd && (
            <div className="flex items-center gap-2 rounded-lg border p-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Next billing date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Store Usage */}
          {storeUsage && (
            <div className="flex items-center gap-2 rounded-lg border p-4">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Store usage</p>
                <p className="text-sm text-muted-foreground">
                  {storeUsage.current} / {storeUsage.limit === Infinity ? "Unlimited" : storeUsage.limit} stores used
                </p>
              </div>
              {!storeUsage.canCreateMore && subscription?.plan === "STARTER" && (
                <Badge variant="secondary">Limit reached</Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 border-t pt-6">
            <Button onClick={handleManagePayment} disabled={actionLoading} variant="outline" className="gap-2">
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Payment Methods
            </Button>

            {!subscription?.cancelAtPeriodEnd && (
              <Button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                variant="destructive"
                className="gap-2"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Compare features and upgrade anytime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Starter Plan */}
            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <h4 className="text-lg font-semibold">Starter</h4>
                <p className="text-2xl font-bold">€29/mo</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>1 store location</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Basic inventory tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Up to 500 products</span>
                </li>
              </ul>
              {subscription?.plan === "STARTER" && (
                <Badge className="mt-4 w-full justify-center">Current Plan</Badge>
              )}
            </div>

            {/* Pro Plan */}
            <div className="rounded-lg border-2 border-primary p-4">
              <div className="mb-4">
                <h4 className="text-lg font-semibold">Pro</h4>
                <p className="text-2xl font-bold">€79/mo</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Unlimited stores</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Advanced reports & analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Supplier management</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Priority support</span>
                </li>
              </ul>
              {subscription?.plan === "PRO" ? (
                <Badge className="mt-4 w-full justify-center">Current Plan</Badge>
              ) : (
                <Button onClick={handleUpgrade} className="mt-4 w-full">
                  Upgrade Now
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const variants: Record<SubscriptionStatus, { color: string; label: string }> = {
    ACTIVE: { color: "bg-green-100 text-green-800 border-green-200", label: "Active" },
    CANCELED: { color: "bg-red-100 text-red-800 border-red-200", label: "Canceled" },
    PAST_DUE: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Past Due" },
    INCOMPLETE: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Incomplete" },
  };

  const variant = variants[status] || variants.INCOMPLETE;

  return <Badge className={`${variant.color} border`}>{variant.label}</Badge>;
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

  return (
    <div className="container mx-auto max-w-4xl py-16">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-2xl font-bold">No Active Subscription</h2>
          <p className="mb-6 text-muted-foreground">
            Subscribe to a plan to start managing your business with Epidom.
          </p>
          <Button onClick={() => router.push("/pricing")} size="lg" className="gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            View Plans & Pricing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
