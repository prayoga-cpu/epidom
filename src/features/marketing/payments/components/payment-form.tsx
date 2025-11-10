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
 * 4. After payment, redirect back to /billing?success=true
 *
 * @component
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/lang/i18n-provider";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CreditCard, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Props for PaymentForm component
 */
interface PaymentFormProps {
  /** Plan type: starter or pro */
  plan: "starter" | "pro";
}

export function PaymentForm({ plan }: PaymentFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user is logged in
      if (status !== "authenticated" || !session) {
        // Redirect to login with return URL
        router.push(`/login?callbackUrl=/pricing?plan=${plan}`);
        return;
      }

      // Create checkout session
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: plan.toUpperCase(), // Convert to STARTER or PRO
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      logger.error("Checkout error:", err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full space-y-4">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Authentication Status */}
      {status === "unauthenticated" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to <span className="font-semibold">sign up or log in</span> before subscribing
            to a plan. Click the button below to continue.
          </AlertDescription>
        </Alert>
      )}

      {/* Secure Checkout Info */}
      <Card className="rounded-xl border-2 sm:rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
            Secure Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            You'll be redirected to Stripe's secure checkout page where you can safely enter your
            payment information. Stripe is a PCI-compliant payment processor trusted by millions of
            businesses worldwide.
          </p>
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Your payment is 100% secure</p>
              <p className="mt-1 text-blue-700">
                We never store your credit card information. All payment data is handled by Stripe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <Card className="rounded-xl border-2 bg-gray-50 sm:rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
            {t("payments.terms.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 text-xs leading-relaxed text-gray-600 sm:space-y-4 sm:text-sm">
            <p>
              By clicking "Proceed to Checkout", you agree to our{" "}
              <a
                href="/terms"
                target="_blank"
                className="text-primary font-medium break-words hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/refund-policy"
                target="_blank"
                className="text-primary font-medium break-words hover:underline"
              >
                Refund Policy
              </a>
              .
            </p>
            <p>{t("payments.terms.billing")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Button */}
      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        className="mb-6 h-11 w-full rounded-lg text-base font-semibold transition-colors duration-200 hover:bg-gray-700 sm:mb-8 sm:h-12 sm:text-lg"
        style={{ backgroundColor: "var(--color-brand-primary)", color: "var(--color-brand-white)" }}
      >
        {isLoading
          ? "Redirecting to checkout..."
          : status === "unauthenticated"
            ? "Sign Up / Log In to Continue"
            : "Proceed to Secure Checkout"}
      </Button>
    </div>
  );
}
