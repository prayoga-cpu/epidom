"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchMaterials,
  prefetchProducts,
  prefetchRecipes,
  prefetchSuppliers,
} from "@/lib/utils/prefetch-helpers";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Product } from "@/features/dashboard/data/products/hooks/use-products";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";

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
const MaterialsSection = dynamic(
  () =>
    import("@/features/dashboard/data/materials/components/materials-section").then((mod) => ({
      default: mod.MaterialsSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

const RecipesSection = dynamic(
  () =>
    import("../recipes/components/recipes-section").then((mod) => ({
      default: mod.RecipesSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

const ProductsSection = dynamic(
  () =>
    import("../products/components/products-section").then((mod) => ({
      default: mod.ProductsSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

const SuppliersSection = dynamic(
  () =>
    import("../suppliers/components/suppliers-section").then((mod) => ({
      default: mod.SuppliersSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
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

interface DataViewClientProps {
  initialMaterials?: MaterialWithSuppliers[];
  initialRecipes?: RecipeWithIngredients[];
  initialProducts?: Product[];
  initialSuppliers?: SupplierWithRelations[];
  storeId: string;
}

export function DataViewClient({
  initialMaterials,
  initialRecipes,
  initialProducts,
  initialSuppliers,
  storeId,
}: DataViewClientProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("materials");

  // Prefetch handlers for tab hover
  const handleTabHover = async (tabName: string) => {
    // Only prefetch if tab is not already active (avoid unnecessary prefetch)
    if (tabName === activeTab) return;

    try {
      switch (tabName) {
        case "materials":
          await prefetchMaterials(queryClient, storeId);
          break;
        case "products":
          await prefetchProducts(queryClient, storeId);
          break;
        case "recipes":
          await prefetchRecipes(queryClient, storeId);
          break;
        case "suppliers":
          await prefetchSuppliers(queryClient, storeId);
          break;
      }
    } catch (error) {
      // Silently handle prefetch errors (non-critical)
      // Prefetch failures are non-critical and don't need logging
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="grid min-h-[calc(100vh-150px)] w-full gap-6"
    >
      <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="materials"
          onMouseEnter={() => handleTabHover("materials")}
        >
          {t("pages.materialsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="recipes"
          onMouseEnter={() => handleTabHover("recipes")}
        >
          {t("pages.recipesList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="products"
          onMouseEnter={() => handleTabHover("products")}
        >
          {t("pages.productsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="suppliers"
          onMouseEnter={() => handleTabHover("suppliers")}
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
          <MaterialsSection initialMaterials={initialMaterials} />
        </TabsContent>
      )}

      {activeTab === "recipes" && (
        <TabsContent value="recipes" className="mt-0">
          <RecipesSection initialRecipes={initialRecipes} />
        </TabsContent>
      )}

      {activeTab === "products" && (
        <TabsContent value="products" className="mt-0">
          <ProductsSection initialProducts={initialProducts} />
        </TabsContent>
      )}

      {activeTab === "suppliers" && (
        <TabsContent value="suppliers" className="mt-0">
          <SuppliersSection initialSuppliers={initialSuppliers} />
        </TabsContent>
      )}
    </Tabs>
  );
}
