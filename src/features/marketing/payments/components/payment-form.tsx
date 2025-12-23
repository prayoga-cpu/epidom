"use client";

/**
 * Payment Form Component
 *
 * Redirects to Stripe Checkout for secure payment processing.
 * Uses Stripe Checkout (PCI-compliant, hosted by Stripe).
 *
 * Flow:
 * 1. User must be logged in
 * 2. Click "Subscribe" button
 * 3. Redirect to Stripe Checkout (hosted)
 * 4. After payment, redirect back to /profile?success=true
 *
 * @component
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useI18n } from "@/components/lang/i18n-provider";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { PAYMENT_SECURITY_FEATURES } from "../constants/security-features";
import { toStripePlan, isStripePlan } from "../utils/plan-validation";

/**
 * Props for PaymentForm component
 */
interface PaymentFormProps {
  /** Plan type: starter or pro only (enterprise handled separately) */
  plan: "starter" | "pro";
}

export function PaymentForm({ plan }: PaymentFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !isPending && !!session?.user;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user agreed to terms
      if (!agreedToTerms) {
        setError(t("payments.form.agreeToTermsError"));
        setIsLoading(false);
        return;
      }

      // Check if user is logged in
      if (!isAuthenticated || !session) {
        // Redirect to login with return URL
        router.push(`/login?callbackUrl=${encodeURIComponent(`/payments?plan=${plan}`)}`);
        return;
      }

      // Validate plan is Stripe-supported (should not happen due to page validation, but safety check)
      if (!isStripePlan(plan)) {
        setError(t("payments.form.checkoutError"));
        setIsLoading(false);
        return;
      }

      // Convert to Stripe format
      const stripePlan = toStripePlan(plan);
      if (!stripePlan) {
        setError(t("payments.form.checkoutError"));
        setIsLoading(false);
        return;
      }

      // Create checkout session
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: stripePlan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data.error?.message ||
          data.message ||
          data.error ||
          t("payments.form.checkoutSessionError");
        throw new Error(errorMessage);
      }

      // Redirect to Stripe Checkout
      // Security: Validate URL is from Stripe (server-side validated, but double-check client-side)
      if (data.data && data.data.url && typeof data.data.url === "string") {
        // Stripe checkout URLs should start with https://checkout.stripe.com or https://checkout.stripe.com/c/pay/
        const isValidStripeUrl = data.data.url.startsWith("https://checkout.stripe.com/");
        if (isValidStripeUrl) {
          window.location.href = data.data.url;
        } else {
          throw new Error(t("payments.form.checkoutUrlError"));
        }
      } else {
        throw new Error(t("payments.form.checkoutUrlError"));
      }
    } catch (err: unknown) {
      logger.error("Checkout error:", err);
      // Security: Don't expose internal error details to user
      const errorMessage = err instanceof Error ? err.message : t("payments.form.checkoutError");
      // Only show safe error messages (avoid exposing system details)
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Invalid plan")) {
        setError(errorMessage);
      } else {
        setError(t("payments.form.checkoutError"));
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Error Alert */}
      {error && (
        <Alert
          variant="destructive"
          className="mb-6 rounded-xl border-red-200 bg-red-50 text-red-800"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Authentication Status */}
      {!isAuthenticated && !isPending && (
        <Alert className="mb-6 rounded-xl border-blue-200 bg-blue-50 text-blue-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("payments.form.authRequiredPrefix")}{" "}
            <span className="font-semibold">{t("payments.form.authRequiredBold")}</span>{" "}
            {t("payments.form.authRequiredSuffix")}
          </AlertDescription>
        </Alert>
      )}

      {/* Cards Container - akan match height dengan summary card di kanan */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_1fr] gap-5">
        {/* Secure Payment Info */}
        <Card className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-brand-primary text-lg font-semibold">
              {t("payments.security.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div className="space-y-2.5">
              {PAYMENT_SECURITY_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-start gap-2.5">
                    <Icon className="text-brand-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-brand-primary text-sm font-medium">
                        {t(`${feature.translationKey}.title`)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-600">
                        {t(`${feature.translationKey}.description`)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Terms and Conditions */}
        <Card className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-brand-primary text-lg font-semibold">
              {t("payments.terms.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {/* Checkbox and Agreement Text */}
            <label htmlFor="terms-agreement" className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                id="terms-agreement"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5 shrink-0 data-[state=checked]:border-[var(--color-brand-primary)] data-[state=checked]:bg-[var(--color-brand-primary)]"
              />
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-gray-600">
                {t("payments.form.termsAgreement")}{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline decoration-1 transition-colors hover:decoration-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("payments.form.termsOfService")}
                </a>{" "}
                {t("payments.form.and")}{" "}
                <a
                  href="/refund-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline decoration-1 transition-colors hover:decoration-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("payments.form.refundPolicy")}
                </a>
                .
              </span>
            </label>

            {/* Billing Information */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm leading-relaxed text-gray-700">{t("payments.terms.billing")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Button - di luar cards container, tidak dihitung dalam height balance */}
      <Button
        onClick={handleCheckout}
        disabled={isLoading || !agreedToTerms}
        className="bg-brand-primary mt-5 h-12 w-full flex-shrink-0 rounded-lg text-base font-semibold text-white transition-all duration-200 hover:bg-gray-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            {t("payments.form.redirecting")}
            <ArrowRight className="h-4 w-4" />
          </span>
        ) : !isAuthenticated ? (
          t("payments.form.signUpLogin")
        ) : (
          <span className="flex items-center justify-center gap-2">
            {t("payments.form.proceedToCheckout")}
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
