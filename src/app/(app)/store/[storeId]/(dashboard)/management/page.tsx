import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchSupplierOrdersForPage } from "@/lib/server/data-fetchers";
import { ManagementClient } from "@/features/dashboard/management/components/management-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

function ManagementSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default async function ManagementPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/management");

  // Fetch initial supplier orders
  // Optimize: Only fetch PLACED (active) and RECEIVED orders for the deliveries tab
  // This matches the client-side filtering and prevents loading unnecessary data
  const supplierOrdersResult = await fetchSupplierOrdersForPage(storeId, {
    status: ["PLACED", "RECEIVED"],
    take: 100, // Reasonable limit for initial view
  });

  return (
    <Suspense fallback={<ManagementSkeleton />}>
      <ManagementClient initialSupplierOrders={supplierOrdersResult.orders} storeId={storeId} />
    </Suspense>
  );
}
