"use client";
import PageHeader from "./page-header";
import ProductionHistoryChart from "../production-history/production-history-chart";
import AlertsCard from "../alerts/alerts-card";
import TrackingCard from "../tracking/tracking-card";
import SupplierCard from "../supplier/supplier-card";
import { useI18n } from "@/components/lang/i18n-provider";

export function DashboardView() {
  const { t } = useI18n();

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full gap-6">
      <PageHeader
        pageTitle={t("dashboard.title")}
        pageDescription={t("dashboard.description")}
      />

      {/* Top Stats */}
      <div className="grid w-full gap-4 lg:grid-cols-7">
        <ProductionHistoryChart />
        <AlertsCard />
      </div>

      {/* Bottom Stats */}
      <div className="grid w-full gap-4 lg:grid-cols-2">
        <TrackingCard />
        <SupplierCard />
      </div>
    </div>
  );
}
