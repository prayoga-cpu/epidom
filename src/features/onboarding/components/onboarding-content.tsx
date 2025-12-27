"use client";

/**
 * Onboarding Content Component
 *
 * After user registers, they are redirected here to validate their card.
 * This is required to get the free PRO plan.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { CreditCard, Gift, Shield, ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";

export function OnboardingContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wasCanceled = searchParams.get("canceled") === "true";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/onboarding");
    }
  }, [status, router]);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/subscriptions/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to start card validation");
      }

      // Redirect to Stripe Checkout
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="text-brand-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bg-brand-primary/10 mb-4 inline-flex items-center justify-center rounded-full p-3">
            <Gift className="text-brand-primary h-8 w-8" />
          </div>
          <h1 className="text-brand-primary text-2xl font-bold sm:text-3xl">🎉 {t("onboarding.title")}</h1>
          <p className="text-brand-primary/60 mt-2">{t("onboarding.subtitle")}</p>
        </div>

        {/* Canceled Warning */}
        {wasCanceled && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">{t("onboarding.canceledTitle")}</p>
              <p className="text-sm text-yellow-700">
                {t("onboarding.canceledMessage")}
              </p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <Card className="border-brand-primary/10 border-2 shadow-xl">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-brand-primary text-xl">{t("onboarding.cardTitle")}</CardTitle>
            <CardDescription>{t("onboarding.cardDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* What you get */}
            <div className="space-y-3">
              <p className="text-brand-primary text-sm font-medium">{t("onboarding.whatYouGet")}</p>
              <div className="space-y-2">
                {[
                  t("onboarding.features.fullAccess"),
                  t("onboarding.features.unlimited"),
                  t("onboarding.features.analytics"),
                  t("onboarding.features.emailSupport"),
                  t("onboarding.features.whatsappSupport"),
                ].map((feature, i) => (
                  <div key={i} className="text-brand-primary/70 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Why card is needed */}
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <CreditCard className="text-brand-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-brand-primary font-medium">{t("onboarding.whyCard")}</p>
                  <p className="text-brand-primary/60 mt-1 text-sm">
                    {t("onboarding.whyCardExplanation")}
                  </p>
                </div>
              </div>
            </div>

            {/* Security badge */}
            <div className="text-brand-primary/50 flex items-center justify-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              {t("onboarding.securedBy")}
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <Button
              onClick={handleStartSetup}
              disabled={isLoading}
              className="group bg-brand-primary hover:bg-brand-primary/90 w-full rounded-xl py-6 text-base font-semibold text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("onboarding.pleaseWait")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  {t("onboarding.addCardButton")}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>

            {/* Skip option (leads to limited access) */}
            <div className="text-center">
              <button
                onClick={() => router.push("/profile")}
                className="text-brand-primary/40 hover:text-brand-primary/60 text-sm underline-offset-4 hover:underline"
              >
                {t("onboarding.skipButton")}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-brand-primary/40 mt-6 text-center text-xs">
          {t("onboarding.termsNote")}
        </p>
      </div>
    </div>
  );
}
