import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchAlertsForPage } from "@/lib/server/data-fetchers";
import { AlertsClient } from "@/features/dashboard/alerts/components/alerts-client";
import { Skeleton } from "@/components/ui/skeleton";

function AlertsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

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

  return (
    <Suspense fallback={<AlertsSkeleton />}>
      <AlertsClient initialAlerts={alertsResult.alerts} storeId={storeId} />
    </Suspense>
  );
}

