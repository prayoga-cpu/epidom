"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "./page-header";
import { AnalyticsSection } from "../analytics/analytics-section";
import { ChartSkeleton } from "./chart-skeleton";
import { CardSkeleton } from "./card-skeleton";
import { AlertsCard } from "../alerts/alerts-card";
import { NewOrdersCard } from "../new-orders/new-orders-card";
import { TrackingCard } from "../tracking/tracking-card";
import { SubscriptionLockedState } from "@/features/dashboard/shared/components/subscription-locked-state";
import { useI18n } from "@/components/lang/i18n-provider";

import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { Alert } from "@/features/dashboard/shared/hooks/use-alerts";

// Lazy load heavy chart component to reduce initial bundle size (~200KB savings)
// Use Next.js dynamic with ssr: false to prevent hydration mismatch
const ProductionHistoryChart = dynamic(
  () =>
    import("../production-history/production-history-chart").then((mod) => ({
      default: mod.ProductionHistoryChart,
    })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Prevent SSR to avoid hydration mismatch
  }
);

const OperationsCard = dynamic(
  () => import("../operations/operations-card").then((mod) => ({ default: mod.OperationsCard })),
  {
    loading: () => <CardSkeleton rows={4} />,
    ssr: false,
  }
);

// Lazy load below-the-fold component for progressive loading
const SupplierCard = dynamic(
  () =>
    import("../supplier/supplier-card").then((mod) => ({
      default: mod.SupplierCard,
    })),
  {
    loading: () => <CardSkeleton rows={3} />,
    ssr: false,
  }
);

const RecentMovementsCard = dynamic(
  () =>
    import("../recent-movements/recent-movements-card").then((mod) => ({
      default: mod.RecentMovementsCard,
    })),
  {
    loading: () => <CardSkeleton rows={5} />,
    ssr: false,
  }
);

interface DashboardClientProps {
  initialStockLevels: MaterialWithSuppliers[];
  initialAlerts: Alert[];
  storeId: string;
  /** Plan includes OPERATIONS — inventory, alerts and staff-operations cards. */
  hasOperationsAccess: boolean;
  /** Plan includes OPERATIONS *and* the owner enabled recipe→batch production. */
  showProductionHistory: boolean;
  /** OPERATIONS plan, and the viewer is the owner or a MANAGER persona. */
  showOperations: boolean;
}

export function DashboardClient({
  initialStockLevels,
  initialAlerts,
  storeId,
  hasOperationsAccess,
  showProductionHistory,
  showOperations,
}: DashboardClientProps) {
  const { t } = useI18n();

  // Process data for TrackingCard (calculate percentage once)
  const stockLevels = useMemo(() => {
    return initialStockLevels.map((material) => {
      const currentStock = Number(material.currentStock);
      const minStock = Number(material.minStock);
      const maxStock = Number(material.maxStock);
      const stockPercentage = maxStock > 0 ? (currentStock / maxStock) * 100 : 0;

      return {
        id: material.id,
        name: material.name,
        currentStock,
        minStock,
        maxStock,
        unit: material.unit,
        stockPercentage,
      };
    });
  }, [initialStockLevels]);

  // The wide row holds up to three tiles (production chart, live operations,
  // alerts) but any of them can be switched off, so the column count is
  // derived rather than hardcoded — otherwise a hidden tile leaves a gap or
  // strands a lone card at 4/7 width. Every branch is a literal class string
  // so Tailwind's scanner still sees them. Mobile is always one column.
  const wideRowCards = [showProductionHistory, showOperations, hasOperationsAccess].filter(
    Boolean
  ).length;
  const wideRowClass =
    wideRowCards >= 3
      ? "md:grid-cols-2 lg:grid-cols-3"
      : wideRowCards === 2
        ? "md:grid-cols-2"
        : "";
  // At three tiles on a tablet the row is 2-up, which would leave the last
  // one orphaned at half width — let it take the full second row instead.
  const lastTileSpan = wideRowCards >= 3 ? "md:col-span-2 lg:col-span-1" : "";

  return (
    <div className="grid min-h-[calc((100vh-120px)/var(--app-zoom,1))] w-full gap-6 pb-6">
      <PageHeader pageTitle={t("dashboard.title")} pageDescription={t("dashboard.description")} />

      <AnalyticsSection storeId={storeId} />

      {/* New orders awaiting confirmation — incoming storefront orders don't get missed */}
      <NewOrdersCard storeId={storeId} />

      {wideRowCards > 0 && (
        <div className={`grid w-full grid-cols-1 gap-4 lg:items-stretch ${wideRowClass}`}>
          {showProductionHistory && (
            <div className="w-full min-w-0">
              <ProductionHistoryChart />
            </div>
          )}
          {showOperations && (
            <div className="w-full min-w-0">
              <OperationsCard storeId={storeId} />
            </div>
          )}
          {hasOperationsAccess && (
            <div className={`w-full min-w-0 ${lastTileSpan}`}>
              <AlertsCard initialAlerts={initialAlerts} storeId={storeId} />
            </div>
          )}
        </div>
      )}

      {hasOperationsAccess ? (
        <>
          {/* Bottom Stats */}
          <div className="grid w-full gap-4 md:grid-cols-2">
            <TrackingCard stockLevels={stockLevels} />
            <SupplierCard />
          </div>

          {/* Recent Stock Movements — POS sales, production, manual adjustments */}
          <div className="mb-6 w-full">
            <RecentMovementsCard />
          </div>
        </>
      ) : (
        // One upgrade tile in place of the five OPERATIONS-only cards above —
        // a dashboard of locked cards reads as broken, not as an offer.
        <SubscriptionLockedState
          className="mb-6 w-full"
          requiredPlan="OPERATIONS"
          title={t("dashboard.operationsUpsell.title")}
          message={t("dashboard.operationsUpsell.description")}
        />
      )}
    </div>
  );
}
