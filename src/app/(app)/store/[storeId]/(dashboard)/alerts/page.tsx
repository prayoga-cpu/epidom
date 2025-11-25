import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchAlertsForPage } from "@/lib/server/data-fetchers";
import { AlertsClient } from "@/features/dashboard/alerts/components/alerts-client";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch initial alerts data
  const alertsResult = await fetchAlertsForPage(storeId);

  return <AlertsClient initialAlerts={alertsResult.alerts} storeId={storeId} />;
}
