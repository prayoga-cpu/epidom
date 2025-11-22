import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  fetchMaterialsForPage,
  fetchSuppliersForPage,
  fetchProductionBatchesForPage,
  fetchAlertsForPage,
} from "@/lib/server/data-fetchers";
import { DashboardClient } from "@/features/dashboard/dashboard/components/dashboard-client";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import type { ProductionBatchWithRelations } from "@/lib/repositories/production-batch.repository";
import type { Alert } from "@/features/dashboard/tracking/hooks/use-alerts";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch initial data in parallel for better performance
  const [materialsResult, suppliersResult, productionBatchesResult, alertsResult] = await Promise.all([
    fetchMaterialsForPage(storeId),
    fetchSuppliersForPage(storeId, { take: 4, sortBy: "name", sortOrder: "asc" }),
    fetchProductionBatchesForPage(storeId, {
      status: "COMPLETED",
      sortBy: "scheduledDate",
      sortOrder: "desc",
      skip: 0,
      take: 10,
    }),
    fetchAlertsForPage(storeId),
  ]);

  return (
    <DashboardClient
      initialMaterials={materialsResult.materials}
      initialSuppliers={suppliersResult.suppliers}
      initialProductionBatches={productionBatchesResult.batches}
      initialAlerts={alertsResult.alerts}
      storeId={storeId}
    />
  );
}
