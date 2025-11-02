"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { StoreCard } from "./store-card";
import { CreateStoreButton } from "./create-store-button";
import { MOCK_STORES } from "@/mocks";

export function StoresContainer() {
  const { t } = useI18n();

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
              <CreateStoreButton />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {/* Stores Grid */}
          {MOCK_STORES.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 md:gap-6 lg:gap-8">
              {MOCK_STORES.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
