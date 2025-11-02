"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";

interface SubscriptionInfoCardProps {
  subscription?: {
    plan: string;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export function SubscriptionInfoCard({ subscription }: SubscriptionInfoCardProps) {
  const { t } = useI18n();

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "CANCELED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "PAST_DUE":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return t("profile.subscription.status.active") || status;
      case "CANCELED":
        return t("profile.subscription.status.canceled") || status;
      case "PAST_DUE":
        return t("profile.subscription.status.pastDue") || status;
      default:
        return status || "";
    }
  };

  const getPlanDetails = (plan?: string) => {
    switch (plan) {
      case "PRO":
        return {
          name: t("profile.subscription.plans.pro") || "Pro",
          price: t("profile.subscription.pricing.pro") || "€79/month",
          color: "text-purple-600"
        };
      case "ENTERPRISE":
        return {
          name: t("profile.subscription.plans.enterprise") || "Enterprise",
          price: t("profile.subscription.pricing.enterprise") || "Custom",
          color: "text-blue-600"
        };
      default:
        return {
          name: t("profile.subscription.plans.starter") || "Starter",
          price: t("profile.subscription.pricing.starter") || "€29/month",
          color: "text-gray-600"
        };
    }
  };

  if (!subscription) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl font-bold">{t("profile.subscription.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="text-muted-foreground mb-4 h-12 w-12" />
            <p className="text-muted-foreground mb-4">{t("profile.subscription.noActiveSubscription")}</p>
            <Button asChild>
              <Link href="/pricing">{t("profile.subscription.viewPlans")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const planDetails = getPlanDetails(subscription.plan);
  const isActive = subscription.status === "ACTIVE";
  const isPastDue = subscription.status === "PAST_DUE";

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">{t("profile.subscription.title")}</CardTitle>
        <Badge className={getStatusColor(subscription.status)}>{getStatusLabel(subscription.status)}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{t("profile.subscription.currentPlan")}</p>
              <p className={`text-2xl font-bold ${planDetails.color}`}>{planDetails.name}</p>
            </div>
            <p className="text-xl font-semibold">{planDetails.price}</p>
          </div>
        </div>

        {/* Billing Period */}
        {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">{t("profile.subscription.billingPeriod")}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">{t("profile.subscription.periodStart")}</p>
                <p className="font-semibold">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("profile.subscription.periodEnd")}</p>
                <p className="font-semibold">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
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
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{t("profile.subscription.warnings.pastDue.title")}</p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                {t("profile.subscription.warnings.pastDue.description")}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" asChild className="flex-1">
            <Link href="/pricing">{t("profile.subscription.changePlan")}</Link>
          </Button>
          {isActive && !subscription.cancelAtPeriodEnd && (
            <Button variant="outline" className="flex-1">
              {t("profile.subscription.manageBilling")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
