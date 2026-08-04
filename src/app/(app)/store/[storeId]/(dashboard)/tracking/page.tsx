import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchMaterialsForPage } from "@/lib/server/data-fetchers";
import { TrackingClient } from "@/features/dashboard/tracking/components/tracking-client";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function TrackingPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/tracking");

  // Fetch initial materials for stock levels
  const materialsResult = await fetchMaterialsForPage(storeId);

  return <TrackingClient initialMaterials={materialsResult.materials} storeId={storeId} />;
}
