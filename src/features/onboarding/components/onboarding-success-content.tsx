"use client";

/**
 * Onboarding Success Content
 *
 * Shown after successful card validation.
 * User now has PRO access until Dec 31, 2025.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Sparkles, Calendar, Star } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

export function OnboardingSuccessContent() {
  const { t } = useI18n();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Separate effect for redirect when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      router.push("/profile");
    }
  }, [countdown, router]);

  const handleGoProfile = () => {
    router.push("/profile");
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
          🎉 {t("onboarding.success.title")}
        </h1>
        <p className="text-brand-primary/60 mb-8 text-lg">
          {t("onboarding.success.subtitle")}
        </p>

        {/* Plan Info Card */}
        <div className="mb-8 rounded-2xl border-2 border-green-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Star className="text-brand-primary h-5 w-5" />
            <span className="text-brand-primary text-lg font-bold">{t("onboarding.success.planActive")}</span>
          </div>

          <div className="text-brand-primary/70 flex items-center justify-center gap-3">
            <Calendar className="h-5 w-5" />
            <span>{t("onboarding.success.validUntil")}</span>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              t("onboarding.features.unlimited"),
              t("onboarding.features.analytics"),
              t("onboarding.features.emailSupport"),
            ].map((feature) => (
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
          onClick={handleGoProfile}
          size="lg"
          className="group bg-brand-primary hover:bg-brand-primary/90 w-full max-w-xs rounded-xl py-6 text-base font-semibold text-white"
        >
          {t("onboarding.success.goToDashboard")}
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>

        {/* Auto-redirect notice */}
        <p className="text-brand-primary/40 mt-4 text-sm">
          {t("onboarding.success.redirecting").replace("{seconds}", countdown.toString())}
        </p>
      </div>
    </div>
  );
}

