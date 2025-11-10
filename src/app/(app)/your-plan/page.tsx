"use client";

import { useSession } from "next-auth/react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";
import { useState } from "react";
import { toast } from "sonner";

export default function YourPlanPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { data: profileData } = useProfile();
  const [isLoading, setIsLoading] = useState<"STARTER" | "PRO" | null>(null);

  const currentPlan = profileData?.subscription?.plan;
  const isActive = profileData?.subscription?.status === "ACTIVE";

  const handleSelectPlan = async (plan: "STARTER" | "PRO") => {
    if (!session?.user?.id) {
      router.push("/login");
      return;
    }

    // Prevent buying the same plan
    if (currentPlan === plan && isActive) {
      toast.error(`You already have the ${plan} plan`);
      return;
    }

    setIsLoading(plan);

    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          successUrl: "/checkout/success",
          cancelUrl: "/checkout/failed",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create checkout session");
        setIsLoading(null);
        return;
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred. Please try again.");
      setIsLoading(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please log in to view pricing plans</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main
      className="min-h-screen bg-white py-12 md:py-24"
      style={{ color: "var(--color-brand-primary)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-16 space-y-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">{t("pricing.heroTitle")}</h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-600">{t("pricing.heroDescription")}</p>

          {/* Current Plan Badge */}
          {currentPlan && isActive && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-6 py-3">
              <div className="h-3 w-3 rounded-full bg-blue-600"></div>
              <p className="text-sm font-semibold text-blue-900">
                {t("profile.subscription.currentPlan")}:{" "}
                <span className="capitalize">{currentPlan}</span>
              </p>
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto mb-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {/* Starter Plan */}
          <div className="animate-slide-up">
            <Card
              className={`relative flex h-full flex-col transition-all ${
                currentPlan === "STARTER" && isActive
                  ? "shadow-lg ring-2 ring-green-500"
                  : "hover:shadow-lg"
              }`}
            >
              {currentPlan === "STARTER" && isActive && (
                <div className="absolute -top-3 right-6 rounded-full bg-green-500 px-4 py-1 text-xs font-bold text-white">
                  Current Plan
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  {t("pricing.plans.starter.title")}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("pricing.plans.starter.description")}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-grow flex-col">
                {/* Pricing */}
                <div className="mb-6 border-b pb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {t("pricing.plans.starter.price")}
                    </span>
                    <span className="text-gray-600">{t("pricing.plans.starter.billing")}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-grow space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.starter.f1")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.starter.f2")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.starter.f3")}</span>
                  </li>
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan("STARTER")}
                  disabled={isLoading !== null}
                  variant={currentPlan === "STARTER" && isActive ? "outline" : "default"}
                  className={`h-11 w-full font-semibold ${
                    currentPlan !== "STARTER" || !isActive ? "bg-gray-900 hover:bg-gray-800" : ""
                  }`}
                >
                  {isLoading === "STARTER" ? (
                    <span>{t("common.loading")}</span>
                  ) : currentPlan === "STARTER" && isActive ? (
                    <span>{t("profile.subscription.currentPlan")}</span>
                  ) : (
                    <span>{t("pricing.plans.starter.select")}</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Pro Plan */}
          <div className="animate-slide-up-delayed">
            <Card
              className={`relative flex h-full flex-col border-2 transition-all ${
                currentPlan === "PRO" && isActive
                  ? "border-blue-600 shadow-lg ring-2 ring-blue-500"
                  : "border-gray-200 hover:shadow-lg"
              }`}
            >
              {/* Recommended Badge */}
              {(currentPlan !== "PRO" || !isActive) && (
                <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white">
                  <Zap className="h-3 w-3" />
                  {t("pricing.plans.pro.recommended")}
                </div>
              )}

              {currentPlan === "PRO" && isActive && (
                <div className="absolute -top-3 right-6 rounded-full bg-green-500 px-4 py-1 text-xs font-bold text-white">
                  Current Plan
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl font-bold">{t("pricing.plans.pro.title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("pricing.plans.pro.description")}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-grow flex-col">
                {/* Pricing */}
                <div className="-mx-6 mb-6 border-b bg-blue-50 px-6 py-6 pb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {t("pricing.plans.pro.price")}
                    </span>
                    <span className="text-gray-600">{t("pricing.plans.pro.billing")}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-grow space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.pro.f1")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.pro.f2")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.pro.f3")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700">{t("pricing.plans.pro.f4")}</span>
                  </li>
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan("PRO")}
                  disabled={isLoading !== null}
                  className={`h-11 w-full font-semibold ${
                    currentPlan === "PRO" && isActive
                      ? "bg-gray-500"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isLoading === "PRO" ? (
                    <span>{t("common.loading")}</span>
                  ) : currentPlan === "PRO" && isActive ? (
                    <span>{t("profile.subscription.currentPlan")}</span>
                  ) : (
                    <span>{t("pricing.plans.pro.select")}</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Box */}
        <div className="animate-slide-up-delayed-2 mx-auto max-w-3xl rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
          <div className="flex items-start justify-center gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-gray-700">Secure payment with Stripe</p>
              <p className="mt-1 text-sm text-gray-600">
                You can change or cancel your plan anytime from your account settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
