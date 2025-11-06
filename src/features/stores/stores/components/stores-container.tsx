"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { StoreCard } from "./store-card";
import { CreateStoreDialog } from "./create-store-dialog";
import { useStores } from "../hooks/use-stores";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoresContainer() {
  const { t } = useI18n();
  const { data: stores, isLoading, error, refetch } = useStores();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header Section - Fixed height */}
      <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-[var(--color-brand-primary)] sm:text-3xl md:text-4xl">
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

          {/* Empty State */}
          {!isLoading && !error && stores?.length === 0 && (
            <div className="flex min-h-[calc(100vh-200px)] items-center justify-center py-12 text-center sm:py-16">
              <div>
                <p className="mb-2 text-base text-neutral-600 sm:text-lg md:text-xl">
                  {t("stores.noStores")}
                </p>
                <p className="text-sm text-neutral-500 sm:text-base md:text-lg">
                  {t("stores.createFirst")}
                </p>
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
