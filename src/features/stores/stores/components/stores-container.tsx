"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { StoreCard } from "./store-card";
import { CreateStoreDialog } from "./create-store-dialog";
import { useStores } from "../hooks/use-stores";
import { useSubscriptionStatus } from "../hooks/use-subscription-status";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function StoresContainer() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: stores, isLoading, error, refetch } = useStores();
  const { data: subscriptionStatus, isLoading: isLoadingSubscription } = useSubscriptionStatus();

  /**
   * Render create store button based on subscription status
   */
  const renderCreateStoreButton = () => {
    // Loading state - show skeleton button
    if (isLoadingSubscription) {
      return (
        <Skeleton className="h-10 w-full rounded-full sm:w-auto sm:px-8" />
      );
    }

    const hasSubscription = subscriptionStatus?.hasSubscription ?? false;
    const canCreateMore = subscriptionStatus?.storeUsage?.canCreateMore ?? false;
    const subscription = subscriptionStatus?.subscription;

    // No subscription - show "Subscribe to Create Store" button
    if (!hasSubscription || subscription?.status !== "ACTIVE") {
      return (
        <Button
          size="lg"
          onClick={() => router.push("/pricing")}
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {t("stores.subscribeToCreateStore")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      );
    }

    // Has subscription but limit reached - show "Upgrade Plan" button
    if (!canCreateMore) {
      return (
        <Button
          size="lg"
          onClick={() => router.push("/pricing")}
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {t("stores.upgradePlan")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      );
    }

    // Has subscription and can create more - show CreateStoreDialog
    return <CreateStoreDialog />;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Header Section - Enhanced with subtle gradient */}
      <div className="shrink-0 border-b border-neutral-200/60 bg-gradient-to-b from-white via-neutral-50/50 to-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          {/* Title and Create Button */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-brand-primary)] sm:text-4xl md:text-5xl">
              {t("stores.title")}
            </h1>
            <div className="shrink-0">
              {renderCreateStoreButton()}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 md:gap-6 lg:gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex min-h-[calc(100vh-200px)] items-center justify-center py-12 text-center sm:py-16">
              <div className="max-w-md">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <p className="mb-2 text-base font-semibold text-neutral-900 sm:text-lg">
                  {t("stores.errorLoading") || "Failed to load stores"}
                </p>
                <p className="mb-6 text-sm text-neutral-600 sm:text-base">
                  {error.message || "An unexpected error occurred"}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Empty State - Enhanced with visual and CTA */}
          {!isLoading && !error && stores?.length === 0 && (
            <div className="flex min-h-[calc(100vh-200px)] items-center justify-center py-12 text-center sm:py-16">
              <div className="mx-auto max-w-md px-4">
                {/* Visual Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 sm:h-24 sm:w-24">
                  <Store className="h-10 w-10 text-[var(--color-brand-primary)] sm:h-12 sm:w-12" />
                </div>

                {/* Text Content */}
                <h3 className="mb-3 text-xl font-semibold text-[var(--color-brand-primary)] sm:text-2xl">
                  {t("stores.noStores")}
                </h3>
                <p className="mb-6 text-base leading-relaxed text-neutral-600 sm:text-lg">
                  {t("stores.createFirst")}
                </p>

                {/* CTA Button */}
                {renderCreateStoreButton()}
              </div>
            </div>
          )}

          {/* Stores Grid */}
          {!isLoading && !error && stores && stores.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 md:gap-6 lg:gap-8">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
