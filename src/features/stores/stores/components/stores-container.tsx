"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { StoreCard } from "./store-card";
import { CreateStoreDialog } from "./create-store-dialog";
import { useStores } from "../hooks/use-stores";
import { useSubscriptionStatus } from "../hooks/use-subscription-status";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Store, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function StoresContainer() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: stores, isLoading, error, refetch } = useStores();
  const { data: subscriptionStatus, isLoading: isLoadingSubscription } = useSubscriptionStatus();
  const [isActivating, setIsActivating] = useState(false);

  async function handleActivateFree() {
    setIsActivating(true);
    try {
      const res = await fetch("/api/subscriptions/activate-free", { method: "POST" });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
        await queryClient.invalidateQueries({ queryKey: ["stores"] });
      }
    } finally {
      setIsActivating(false);
    }
  }
  /**
   * GATEKEEPER LOGIC:
   * Protects the /stores route from incomplete users.
   * If a user lands here without a complete business profile or active plan,
   * they correspond to a 'New User' flow and must be sent to onboarding.
   */
  useEffect(() => {
     // Run only when authentication/subscription is adequately loaded
    if (isLoadingSubscription) return;

    const checkCompliance = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const { data: profile } = await res.json();
          const business = profile.business;
          const subscription = profile.subscription;

          // Redirect to onboarding only if the user has no business set up at all
          // (subscription is always active now via free plan provisioning)
          const hasStore = business?.stores?.length > 0;
          if (!business || !hasStore) {
            router.replace("/onboarding");
          }
        }
      } catch (error) {
        console.error("Gatekeeper compliance check failed", error);
      }
    };

    checkCompliance();
  }, [isLoadingSubscription, router]);

  /**
   * Render create store button based on subscription status
   */
  const renderCreateStoreButton = () => {
    // Loading state - show skeleton button that matches actual button size
    // Width matches "Subscribe to Create Store" button:
    // - Mobile: w-full (matches button's w-full)
    // - Desktop: fixed width that approximates button's content-based width (w-auto)
    // Text "Subscribe to Create Store" + ArrowRight icon + padding ≈ 200px (sm) to 220px (md)
    if (isLoadingSubscription) {
      return (
        <Skeleton className="h-9 w-full rounded-full sm:h-10 sm:w-[200px] md:h-11 md:w-[220px]" />
      );
    }

    const hasSubscription = subscriptionStatus?.hasSubscription ?? false;
    const subscription = subscriptionStatus?.subscription;
    const storeUsage = subscriptionStatus?.storeUsage;

    // Calculate canCreateMore from both subscription status and current stores count
    // This provides real-time check even if subscription-status cache is stale
    const canCreateMoreFromSubscription = storeUsage?.canCreateMore ?? false;
    const storeLimit = storeUsage?.limit;
    const currentStoreCount = stores?.length ?? 0;

    // If we have store limit info, calculate directly from current stores
    // This ensures button updates immediately after creating a store
    // For OPERATIONS/ENTERPRISE (limit = Infinity), always allow creating
    const canCreateMore = storeLimit === Infinity || storeLimit === null
      ? true // OPERATIONS/ENTERPRISE: unlimited stores
      : storeLimit !== undefined
        ? currentStoreCount < storeLimit // Calculate from current count
        : canCreateMoreFromSubscription; // Fallback to subscription status

    // No subscription - activate free plan directly
    if (!hasSubscription || subscription?.status !== "ACTIVE") {
      return (
        <Button
          size="lg"
          onClick={handleActivateFree}
          disabled={isActivating}
          style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
          className="w-full rounded-full px-4 py-2.5 text-xs font-semibold shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {isActivating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t("stores.subscribeToCreateStore")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
            </>
          )}
        </Button>
      );
    }

    // Has subscription but limit reached - activate free upgrade directly
    if (!canCreateMore) {
      return (
        <Button
          size="lg"
          onClick={handleActivateFree}
          disabled={isActivating}
          style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
          className="w-full rounded-full px-4 py-2.5 text-xs font-semibold shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {isActivating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t("stores.upgradePlan")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
            </>
          )}
        </Button>
      );
    }

    // Has subscription and can create more - show CreateStoreDialog
    return <CreateStoreDialog />;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header Section - Enhanced with subtle gradient */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6">
          {/* Title and Create Button */}
          <div className="animate-slide-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
              {t("stores.title")}
            </h1>
            <div className="shrink-0 w-full sm:w-auto">
              {renderCreateStoreButton()}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 lg:py-8">
          {/* Loading State */}
          {isLoading && (
            <div className="animate-slide-up-delayed grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2 sm:space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-5 w-3/4 sm:h-6" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="animate-slide-up-delayed flex min-h-[calc(100vh-250px)] items-center justify-center px-4 py-8 text-center sm:min-h-[calc(100vh-300px)] sm:py-12 md:py-16">
              <div className="w-full max-w-md">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive sm:h-12 sm:w-12" />
                <p className="mb-2 text-base font-semibold text-foreground sm:text-lg">
                  {t("stores.errorLoading") || "Failed to load stores"}
                </p>
                <p className="mb-6 text-sm text-muted-foreground sm:text-base">
                  {error.message || "An unexpected error occurred"}
                </p>
                <Button onClick={() => refetch()} variant="outline" className="w-full sm:w-auto">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Empty State - Enhanced with visual and CTA */}
          {!isLoading && !error && stores?.length === 0 && (
            <div className="animate-slide-up-delayed flex min-h-[calc(100vh-250px)] items-center justify-center px-4 py-8 text-center sm:min-h-[calc(100vh-300px)] sm:py-12 md:py-16">
              <div className="mx-auto w-full max-w-md">
                {/* Visual Icon */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted sm:mb-6 sm:h-20 sm:w-20 md:h-24 md:w-24">
                  <Store className="h-8 w-8 text-muted-foreground sm:h-10 sm:w-10 md:h-12 md:w-12" />
                </div>

                {/* Text Content */}
                <h3 className="mb-2 text-lg font-semibold text-foreground sm:mb-3 sm:text-xl md:text-2xl">
                  {t("stores.noStores")}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:mb-6 sm:text-base md:text-lg">
                  {t("stores.createFirst")}
                </p>

                {/* CTA Button */}
                <div className="flex justify-center">
                  {renderCreateStoreButton()}
                </div>
              </div>
            </div>
          )}

          {/* Stores Grid */}
          {!isLoading && !error && stores && stores.length > 0 && (
            <div className="animate-slide-up-delayed grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-5 lg:gap-6 xl:gap-8">
              {/* Show loading skeleton for store cards while subscription status is loading */}
              {isLoadingSubscription ? (
                [...Array(stores.length)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="space-y-2 sm:space-y-3">
                    <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                    <Skeleton className="h-5 w-3/4 sm:h-6" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))
              ) : (
                stores.map((store) => {
                  // Only block stores if subscription status is loaded and not active
                  // Don't block during loading to prevent false "upgrade" messages
                  const hasActiveSubscription = subscriptionStatus?.hasSubscription &&
                    subscriptionStatus?.subscription?.status === "ACTIVE";
                  // Only set blocked if subscription status is loaded (not undefined)
                  // This prevents showing blocked state during loading
                  const isBlocked = subscriptionStatus !== undefined && !hasActiveSubscription;

                  return (
                    <StoreCard
                      key={store.id}
                      store={store}
                      isBlocked={isBlocked}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
