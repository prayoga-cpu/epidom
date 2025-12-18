"use client";

/**
 * Onboarding Success Page
 *
 * Shown after successful card validation.
 * User now has PRO access until Dec 31, 2025.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { CheckCircle, ArrowRight, Sparkles, Calendar, Star } from "lucide-react";

export default function OnboardingSuccessPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const sessionId = searchParams.get("session_id");

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleGoDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        {/* Success Icon */}
        <div className="mb-6 inline-flex items-center justify-center rounded-full bg-green-100 p-4">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        {/* Headline */}
        <h1 className="text-brand-primary mb-3 text-3xl font-bold sm:text-4xl">
          🎉 Welcome to PRO!
        </h1>
        <p className="text-brand-primary/60 mb-8 text-lg">
          Your card has been validated. Enjoy full PRO access!
        </p>

        {/* Plan Info Card */}
        <div className="mb-8 rounded-2xl border-2 border-green-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Star className="text-brand-primary h-5 w-5" />
            <span className="text-brand-primary text-lg font-bold">PRO Plan Active</span>
          </div>

          <div className="text-brand-primary/70 flex items-center justify-center gap-3">
            <Calendar className="h-5 w-5" />
            <span>
              Valid until <strong>December 31, 2025</strong>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["Unlimited Products", "Advanced Analytics", "Priority Support"].map((feature) => (
              <span
                key={feature}
                className="bg-brand-primary/5 text-brand-primary inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              >
                <Sparkles className="h-3 w-3" />
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleGoDashboard}
          size="lg"
          className="group bg-brand-primary hover:bg-brand-primary/90 w-full max-w-xs rounded-xl py-6 text-base font-semibold text-white"
        >
          Go to Dashboard
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>

        {/* Auto-redirect notice */}
        <p className="text-brand-primary/40 mt-4 text-sm">
          Redirecting to dashboard in {countdown} seconds...
        </p>
      </div>
    </div>
  );
}
