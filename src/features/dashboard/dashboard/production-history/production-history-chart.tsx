"use client";
import { useI18n } from "@/components/lang/i18n-provider";
import { ExportButton } from "@/components/ui/export-button";
import DashboardCard from "../_components/dashboard-card";
import Chart from "./components/chart";
import { useState, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { MOCK_ORDERS, MOCK_DASHBOARD_STATS, MOCK_PRODUCTION_HISTORY_WEEKLY } from "@/mocks";
import { exportData } from "@/features/dashboard/dashboard/production-history/utils/export";

export default function ProductionHistoryChart() {
  const { t } = useI18n();

  // Initialize without date filter (show all data by default)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter orders based on date range and other filters
  // TODO: Replace with API call that accepts date range, search, and status filters
  const filteredOrders = useMemo(() => {
    let filtered = MOCK_ORDERS;

    // Filter by date range
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter((order) => {
        if (!order.deliveryDate) return false;
        const orderDate = new Date(order.deliveryDate);
        return orderDate >= dateRange.from! && orderDate <= dateRange.to!;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.customerEmail?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status.toLowerCase() === statusFilter);
    }

    return filtered;
  }, [dateRange, searchQuery, statusFilter]);

  // Filter chart data based on date range
  // TODO: Replace with API call that accepts date range
  // Note: Mock data uses day names (Mon, Tue, etc.) which can't be filtered by date
  // In production, this will filter by actual dates from the API
  const filteredChartData = useMemo(() => {
    // For mock data, always show all data (day names can't be parsed as dates)
    // In production with real dates, implement date filtering here
    return MOCK_PRODUCTION_HISTORY_WEEKLY;
  }, [dateRange]);

  // Calculate dynamic stats based on filtered data
  // TODO: Replace with API call
  const dashboardStats = useMemo(() => {
    const pendingOrders = filteredOrders.filter(
      (o) => o.status === "pending" || o.status === "processing"
    ).length;

    return {
      stockUtilization: MOCK_DASHBOARD_STATS.stockUtilization,
      totalOpenOrders: pendingOrders > 0 ? pendingOrders : MOCK_DASHBOARD_STATS.totalOpenOrders,
      activeRecipes: MOCK_DASHBOARD_STATS.activeRecipes,
    };
  }, [filteredOrders]);

  return (
    <DashboardCard
      cardClassName="col-span-4"
      cardTitle={t("pages.prodHistory")}
      cardDescription={t("pages.prodHistoryDesc")}
      cardOther={
        <ExportButton
          data={exportData({ chartData: filteredChartData })}
          filename="production-history"
          variant="outline"
          size="sm"
        />
      }
      cardContent={<Chart chartData={filteredChartData} />}
    />
  );
}
