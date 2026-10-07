/**
 * Data View Client Component
 *
 * Main component for displaying materials, recipes, products, suppliers and
 * promotions in tabs. Uses lazy loading and code splitting for optimal performance.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { ItemCardGrid } from "./base-item-card";
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
import { useCustomProductsSettings } from "../custom-products/hooks/use-custom-products-settings";
import { DataQuickStart } from "../import/components/data-quick-start";
import type { EntityType } from "@/lib/ai/import/types";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/features/guide/components/page-intro";
import { PosMenuNotice } from "@/features/pos/components/pos-menu-notice";
import { DataSetupChooser } from "../setup/components/data-setup-chooser";
import { DataSetupImport } from "../setup/components/data-setup-import";
import { DataSetupGuide, DataSetupMenuReady } from "../setup/components/data-setup-card";
import { useDataSetupCounts, useDataSetupState } from "../setup/hooks/use-data-setup";
import {
  isDataEmpty,
  resolveDataSetupCard,
  resolveDataSetupView,
  type DataSetupCounts,
  type DataSetupPath,
} from "../setup/lib/data-setup";

// ========================================
// Lazy-Loaded Section Components
// ========================================
// Components are lazy-loaded to reduce initial bundle size and prevent mounting
// all components simultaneously.
//
// Performance optimizations:
// - Lazy loading: Components only load when tab is first activated
// - Conditional rendering: Only render TabsContent for active tab
// - Code splitting: Each tab becomes a separate chunk, reducing initial bundle size
// - Data fetching: Only occurs for active tab, not all tabs at once
//
// Results:
// - Initial load: Only 1 component mounted (active tab)
// - Memory usage: ~75% reduction (from 4 components to 1)
// - Network requests: Only 1 API call for active tab
// - Tab switching: Instant for previously opened tabs (cached)
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

// Discount presets, coupons and loyalty points (OPERATIONS tier — the section
// shows the upgrade gate itself, so the tab is always visible).
const PromotionsSection = dynamic(
  () =>
    import("../promotions/components/promotions-section").then((mod) => ({
      default: mod.PromotionsSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

const CustomProductsSection = dynamic(
  () =>
    import("../custom-products/components/custom-products-section").then((mod) => ({
      default: mod.CustomProductsSection,
    })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

/**
 * Tab Content Skeleton Component
 *
 * Pixel-perfect skeleton that mimics the exact structure of section components
 * to prevent layout shift during lazy loading.
 *
 * @returns {JSX.Element} Skeleton UI matching section component structure
 */
function TabContentSkeleton() {
  return (
    <Card className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] overflow-hidden shadow-md">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-7 w-32" />
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-6">
        {/* Filter Section Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Results Count Skeleton */}
        <div className="flex items-center border-b pb-2">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Card Grid Skeleton - using ItemCardGrid for consistency */}
        <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="group bg-card relative rounded-lg border px-0 py-4 shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="!px-4">
                {/* Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="mb-1 h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </div>

                {/* Separator */}
                <div className="bg-border my-2 h-px" />

                {/* Info */}
                <div className="my-2 space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-8 w-full rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </ItemCardGrid>
      </CardContent>
    </Card>
  );
}

type DataTab = "materials" | "recipes" | "products" | "suppliers" | "promotions" | "customProducts";

interface TabState {
  tab: DataTab;
}

const TAB_DEFAULTS: TabState = { tab: "materials" };

const DATA_TABS: DataTab[] = [
  "materials",
  "recipes",
  "products",
  "suppliers",
  "promotions",
  "customProducts",
];

/** What the quick start's prompt is preselected for on each tab (a menu elsewhere). */
const TAB_ENTITY_TYPE: Partial<Record<DataTab, EntityType>> = {
  materials: "material",
  recipes: "recipe",
  products: "product",
  suppliers: "supplier",
};

function sanitizeTabState(raw: unknown, defaults: TabState): TabState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<TabState>;
  return { tab: DATA_TABS.includes(r.tab as DataTab) ? (r.tab as DataTab) : defaults.tab };
}

interface DataViewClientProps {
  initialMaterials?: MaterialWithSuppliers[];
  // Real store-wide counts, separate from the `.length` of the page above —
  // see MaterialsSection/ProductsSection's own prop docs for why.
  initialMaterialsTotal?: number;
  initialRecipes?: RecipeWithIngredients[];
  initialRecipesTotal?: number;
  initialProducts?: Product[];
  initialProductsTotal?: number;
  initialSuppliers?: SupplierWithRelations[];
  storeId: string;
}

/**
 * Data View Client Component
 *
 * Main component for displaying materials, recipes, products, and suppliers in tabs.
 * Uses lazy loading, code splitting, and prefetching for optimal performance.
 *
 * @param {DataViewClientProps} props - Component props
 * @param {MaterialWithSuppliers[]} [props.initialMaterials] - Initial materials data
 * @param {RecipeWithIngredients[]} [props.initialRecipes] - Initial recipes data
 * @param {Product[]} [props.initialProducts] - Initial products data
 * @param {SupplierWithRelations[]} [props.initialSuppliers] - Initial suppliers data
 * @param {string} props.storeId - Store ID for data fetching
 * @returns {JSX.Element} Data view with tabs component
 */
export function DataViewClient({
  initialMaterials,
  initialMaterialsTotal,
  initialRecipes,
  initialRecipesTotal,
  initialProducts,
  initialProductsTotal,
  initialSuppliers,
  storeId,
}: DataViewClientProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: customProductsSettings } = useCustomProductsSettings(storeId);

  const [tabState, setTabState] = usePersistedState<TabState>(
    `epidom-data-tab-${storeId}`,
    TAB_DEFAULTS,
    sanitizeTabState
  );

  const urlTab = searchParams.get("tab");
  const activeTab: DataTab = DATA_TABS.includes(urlTab as DataTab)
    ? (urlTab as DataTab)
    : tabState.tab;

  const setActiveTab = useCallback(
    (value: string) => {
      const tab = value as DataTab;
      setTabState({ tab });
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, setTabState]
  );

  /**
   * Handle tab hover to prefetch data
   *
   * Prefetches data for tabs on hover to improve perceived performance.
   * Only prefetches if tab is not already active to avoid unnecessary requests.
   *
   * @param {string} tabName - Name of the tab being hovered
   */
  const handleTabHover = async (tabName: string) => {
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
      // Prefetch failures are non-critical and don't need logging
    }
  };

  // First run (src/features/dashboard/data/setup): an empty store picks how to
  // fill the page before seeing it. The totals start from the server's and go
  // live while the setup needs them, so the page moves on the moment the first
  // item is saved.
  const initialCounts: DataSetupCounts = {
    products: initialProductsTotal ?? initialProducts?.length ?? 0,
    materials: initialMaterialsTotal ?? initialMaterials?.length ?? 0,
    recipes: initialRecipesTotal ?? initialRecipes?.length ?? 0,
  };
  const setup = useDataSetupState(storeId);
  // Skipping the choice holds for this visit only: an empty store asks again.
  const [setupSkipped, setSetupSkipped] = useState(false);
  const counts = useDataSetupCounts(
    storeId,
    initialCounts,
    isDataEmpty(initialCounts) || (setup.state.path !== null && !setup.state.cardHidden)
  );
  const setupView = resolveDataSetupView(setup.state, counts, setupSkipped);
  const setupCard = setupView === "lists" ? resolveDataSetupCard(setup.state, counts) : null;
  const tabsRef = useRef<HTMLDivElement>(null);

  const goToTab = (tab: DataTab) => {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const choosePath = (path: DataSetupPath) => {
    setup.setState({ path, cardHidden: false });
    if (path === "guided") setActiveTab("materials");
  };
  const hideSetupCard = () => setup.setState({ ...setup.state, cardHidden: true });

  // The quick start opens by itself only while the lists are still empty;
  // after that it is one row the owner can expand.
  const listsAreEmpty = counts.products === 0 && counts.materials === 0;

  // Sent here by an empty till (?from=pos): the way to the menu on this page.
  const menuNotice = (
    <PosMenuNotice
      storeId={storeId}
      className="mb-4"
      action={
        setupView === "lists" && activeTab !== "products" ? (
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => goToTab("products")}
          >
            {t("pos.menuNotice.goToProducts")}
          </Button>
        ) : null
      }
    />
  );

  // The saved choice is read after mount: until then an empty store can't tell
  // "never picked" from "picked", so it shows neither.
  if (setupView !== "lists" && !setup.ready) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  if (setupView === "choose") {
    return (
      <>
        {menuNotice}
        <DataSetupChooser onChoose={choosePath} onSkip={() => setSetupSkipped(true)} />
      </>
    );
  }

  if (setupView === "import") {
    return (
      <>
        {menuNotice}
        <DataSetupImport
          storeId={storeId}
          onBack={() => setup.setState({ path: null, cardHidden: false })}
          onAddManually={() => {
            setSetupSkipped(true);
            setActiveTab("products");
          }}
        />
      </>
    );
  }

  return (
    <>
      {menuNotice}
      {setupCard === "guide" ? (
        <DataSetupGuide
          storeId={storeId}
          counts={counts}
          onGoToTab={goToTab}
          onHide={hideSetupCard}
          onSwitchToImport={() => setup.setState({ path: "import", cardHidden: false })}
          className="mb-6"
        />
      ) : setupCard === "menuReady" ? (
        <DataSetupMenuReady
          storeId={storeId}
          onContinueGuided={() => choosePath("guided")}
          onHide={hideSetupCard}
          className="mb-6"
        />
      ) : (
        // The page tip and the quick start step aside while a setup card
        // shows: one thing to do at a time.
        <>
          {/* The page has no header of its own: the intro sits above the tabs. */}
          <PageIntro id="data" storeId={storeId} className="mb-4" />
          <DataQuickStart
            storeId={storeId}
            startOpen={listsAreEmpty}
            defaultEntityType={TAB_ENTITY_TYPE[activeTab]}
            className="mb-6"
          />
        </>
      )}
      <Tabs
        ref={tabsRef}
        value={activeTab}
        onValueChange={setActiveTab}
        className="grid min-h-[calc((100vh-150px)/var(--app-zoom,1))] w-full gap-6"
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
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="promotions"
          >
            {t("promotions.tab")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="customProducts"
            onMouseEnter={() => handleTabHover("customProducts")}
          >
            {customProductsSettings?.customProductsLabel || t("pages.customProductsList")}
          </TabsTrigger>
        </TabsList>

        {/* Conditional rendering: Only render TabsContent for active tab
          This prevents all components from mounting simultaneously, which causes:
          - All data fetching to occur at once
          - High memory usage
          - Long initial load time */}
        {activeTab === "materials" && (
          <TabsContent value="materials" className="mt-0">
            <MaterialsSection
              initialMaterials={initialMaterials}
              initialMaterialsTotal={initialMaterialsTotal}
            />
          </TabsContent>
        )}

        {activeTab === "recipes" && (
          <TabsContent value="recipes" className="mt-0">
            <RecipesSection initialRecipes={initialRecipes} />
          </TabsContent>
        )}

        {activeTab === "products" && (
          <TabsContent value="products" className="mt-0">
            <ProductsSection
              initialProducts={initialProducts}
              initialProductsTotal={initialProductsTotal}
            />
          </TabsContent>
        )}

        {activeTab === "suppliers" && (
          <TabsContent value="suppliers" className="mt-0">
            <SuppliersSection initialSuppliers={initialSuppliers} />
          </TabsContent>
        )}

        {activeTab === "promotions" && (
          <TabsContent value="promotions" className="mt-0">
            <PromotionsSection storeId={storeId} />
          </TabsContent>
        )}

        {activeTab === "customProducts" && (
          <TabsContent value="customProducts" className="mt-0">
            <CustomProductsSection storeId={storeId} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
