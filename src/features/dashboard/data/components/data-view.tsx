"use client";

import { useState, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lazy load components untuk mengurangi initial bundle size dan mencegah mounting semua komponen sekaligus
 *
 * OPTIMASI PERFORMANCE:
 * 1. Lazy loading: Komponen hanya di-load ketika tab pertama kali diaktifkan
 * 2. Conditional rendering: Hanya render TabsContent untuk tab yang aktif
 * 3. Code splitting: Setiap tab menjadi chunk terpisah, mengurangi initial bundle size
 * 4. Data fetching: Hanya terjadi untuk tab yang aktif, tidak semua tab sekaligus
 *
 * Hasil:
 * - Initial load: Hanya 1 komponen di-mount (tab aktif)
 * - Memory usage: ~75% reduction (dari 4 komponen menjadi 1)
 * - Network requests: Hanya 1 API call untuk tab aktif
 * - Tab switching: Instant untuk tab yang sudah pernah dibuka (cached)
 */
const MaterialsSection = lazy(() =>
  import("@/features/dashboard/data/materials/components/materials-section").then((mod) => ({
    default: mod.MaterialsSection,
  }))
);

const RecipesSection = lazy(() =>
  import("../recipes/components/recipes-section").then((mod) => ({
    default: mod.RecipesSection,
  }))
);

const ProductsSection = lazy(() =>
  import("../products/components/products-section").then((mod) => ({
    default: mod.ProductsSection,
  }))
);

const SuppliersSection = lazy(() =>
  import("../suppliers/components/suppliers-section").then((mod) => ({
    default: mod.SuppliersSection,
  }))
);

// Loading skeleton untuk tab content
function TabContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

export function DataView() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("materials");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="grid min-h-[calc(100vh-150px)] w-full gap-6">
      <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="materials"
        >
          {t("pages.materialsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="recipes"
        >
          {t("pages.recipesList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="products"
        >
          {t("pages.productsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="suppliers"
        >
          {t("pages.suppliersList")}
        </TabsTrigger>
      </TabsList>

      {/*
        Conditional rendering: Hanya render TabsContent untuk tab yang aktif
        Ini mencegah semua komponen di-mount sekaligus, yang menyebabkan:
        - Semua data fetching terjadi bersamaan
        - Memory usage tinggi
        - Initial load time yang lama
      */}
      {activeTab === "materials" && (
        <TabsContent value="materials" className="mt-0">
          <Suspense fallback={<TabContentSkeleton />}>
            <MaterialsSection />
          </Suspense>
        </TabsContent>
      )}

      {activeTab === "recipes" && (
        <TabsContent value="recipes" className="mt-0">
          <Suspense fallback={<TabContentSkeleton />}>
            <RecipesSection />
          </Suspense>
        </TabsContent>
      )}

      {activeTab === "products" && (
        <TabsContent value="products" className="mt-0">
          <Suspense fallback={<TabContentSkeleton />}>
            <ProductsSection />
          </Suspense>
        </TabsContent>
      )}

      {activeTab === "suppliers" && (
        <TabsContent value="suppliers" className="mt-0">
          <Suspense fallback={<TabContentSkeleton />}>
            <SuppliersSection />
          </Suspense>
        </TabsContent>
      )}
    </Tabs>
  );
}
