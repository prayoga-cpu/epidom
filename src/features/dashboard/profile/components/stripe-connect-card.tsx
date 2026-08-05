"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

interface ConnectStatus {
  onboardingComplete: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

/**
 * Stripe Connect Card Component
 *
 * For Epidom business owner to:
 * - Complete Stripe Connect onboarding
 * - View onboarding status
 * - Access Stripe Dashboard to view earnings
 *
 * The owner receives 80% of all subscription revenue via Stripe Connect.
 */
export function StripeConnectCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/connect/status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || data.error || t("pages.stripeConnectFetchStatusFailed")
        );
      }

      setStatus(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const response = await fetch("/api/connect/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || data.error || t("pages.stripeConnectCreateOnboardingFailed")
        );
      }

      // Redirect to Stripe-hosted onboarding
      window.location.href = data.data.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const response = await fetch("/api/connect/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || data.error || t("pages.stripeConnectCreateDashboardFailed")
        );
      }

      // Open Stripe Dashboard in new tab
      window.open(data.data.url, "_blank");
      setActionLoading(false);
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t("pages.stripeConnectTitle")}
          </CardTitle>
          <CardDescription>{t("pages.stripeConnectLoadingStatus")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOnboarded = status?.onboardingComplete;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t("pages.stripeConnectTitle")}
            </CardTitle>
            <CardDescription>{t("pages.stripeConnectDesc")}</CardDescription>
          </div>
          {isOnboarded && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("pages.stripeConnectConnected")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Status Information */}
        {isOnboarded ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">
                    {t("pages.stripeConnectCompleteTitle")}
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    {t("pages.stripeConnectCompleteDesc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-2 rounded-lg border p-4">
              <h4 className="text-sm font-medium">{t("pages.stripeConnectAccountStatus")}</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("pages.stripeConnectCharges")}</span>
                  <Badge variant={status?.chargesEnabled ? "default" : "secondary"}>
                    {status?.chargesEnabled
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.disabled")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("pages.stripeConnectPayouts")}</span>
                  <Badge variant={status?.payoutsEnabled ? "default" : "secondary"}>
                    {status?.payoutsEnabled
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.disabled")}
                  </Badge>
                </div>
                {status?.accountId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("pages.stripeConnectAccountId")}
                    </span>
                    <code className="text-xs">{status.accountId}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <Button
              onClick={handleOpenDashboard}
              disabled={actionLoading}
              className="w-full gap-2"
              variant="outline"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {t("pages.stripeConnectViewEarnings")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("pages.stripeConnectOnboardingAlert")}</AlertDescription>
            </Alert>

            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-medium">{t("pages.stripeConnectWhatYoullNeed")}</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>• {t("pages.stripeConnectNeedBusinessInfo")}</li>
                <li>• {t("pages.stripeConnectNeedBankDetails")}</li>
                <li>• {t("pages.stripeConnectNeedIdentity")}</li>
              </ul>
              <p className="text-muted-foreground mt-3 text-xs">
                {t("pages.stripeConnectSecureNote")}
              </p>
            </div>

            <Button
              onClick={handleStartOnboarding}
              disabled={actionLoading}
              className="w-full gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages.stripeConnectRedirecting")}
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  {t("pages.stripeConnectCompleteSetup")}
                </>
              )}
            </Button>

            <p className="text-muted-foreground text-center text-xs">
              {t("pages.stripeConnectRedirectNote")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
