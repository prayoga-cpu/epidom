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

  // Fetch initial supplier orders.
  //
  // This seeds ONE React Query cache key (`["supplier-orders","list",storeId]`)
  // that TWO panels read: Supplier Deliveries wants PLACED/RECEIVED, and Orders
  // to Place wants PENDING. Seeding only the deliveries half left a freshly
  // created (PENDING) order invisible until the 10s poll came round, since the
  // hook sets refetchOnMount: false.
  //
  // CANCELLED is still excluded: nothing renders it, and cancelled orders
  // accumulate forever — including them would let them crowd out live ones
  // under the `take` limit below.
  const supplierOrdersResult = await fetchSupplierOrdersForPage(storeId, {
    status: ["PENDING", "PLACED", "RECEIVED"],
    take: 100, // Reasonable limit for initial view
  });

  return (
    <Suspense fallback={<ManagementSkeleton />}>
      <ManagementClient initialSupplierOrders={supplierOrdersResult.orders} storeId={storeId} />
    </Suspense>
  );
}
