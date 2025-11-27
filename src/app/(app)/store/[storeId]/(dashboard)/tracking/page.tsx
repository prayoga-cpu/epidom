import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchMaterialsForPage } from "@/lib/server/data-fetchers";
import { TrackingClient } from "@/features/dashboard/tracking/components/tracking-client";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch initial materials for stock levels
  const materialsResult = await fetchMaterialsForPage(storeId);

  return (
    <TrackingClient
      initialMaterials={materialsResult.materials}
      storeId={storeId}
    />
  );
}
