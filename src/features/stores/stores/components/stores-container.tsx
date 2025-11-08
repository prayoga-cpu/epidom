"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { StoreCard } from "./store-card";
import { CreateStoreDialog } from "./create-store-dialog";
import { useStores } from "../hooks/use-stores";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoresContainer() {
  const { t } = useI18n();
  const { data: stores, isLoading, error, refetch } = useStores();

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
              <CreateStoreDialog />
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
                <CreateStoreDialog />
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
