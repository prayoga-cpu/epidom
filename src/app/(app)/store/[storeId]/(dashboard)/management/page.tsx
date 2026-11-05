import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchSupplierOrdersForPage } from "@/lib/server/data-fetchers";
import { ManagementClient } from "@/features/dashboard/management/components/management-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { PageIntro } from "@/features/guide/components/page-intro";
import { ClaudeConnectorPromo } from "@/features/claude-connector/components/claude-connector-promo";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { getActiveStaffSession } from "@/lib/staff-session";

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

  // The "Ask Claude" tip is for the owner or a manager persona on the owner's
  // device (the same rule as the dashboard's setup guide), never a cashier.
  const [viewer, staffSession] = await Promise.all([
    getStoreViewer(storeId),
    getActiveStaffSession(),
  ]);
  const personaRole = staffSession && staffSession.storeId === storeId ? staffSession.role : null;
  const showClaudePromo =
    viewer.kind === "owner" &&
    (personaRole === null || personaRole === "OWNER" || personaRole === "MANAGER");

  // Fetch initial supplier orders.
  //
  // This seeds ONE React Query cache key (`["supplier-orders","list",storeId]`)
  // that both halves of Reorder & Deliveries read: "Awaiting delivery" wants
  // PLACED (and legacy PENDING), Delivery history wants RECEIVED/CANCELLED.
  // Seed every status: the hook sets refetchOnMount: false, so anything left
  // out here only turns up on the first 10s poll, and a cancelled order would
  // vanish from both lists until then.
  const supplierOrdersResult = await fetchSupplierOrdersForPage(storeId, {
    status: ["PENDING", "PLACED", "RECEIVED", "CANCELLED"],
    take: 100, // Reasonable limit for initial view
  });

  return (
    <>
      {/* The page has no header of its own: the intro sits above the tabs. */}
      <PageIntro id="stock" storeId={storeId} className="mb-4" />
      <ClaudeConnectorPromo
        surface="stock"
        storeId={storeId}
        canView={showClaudePromo}
        className="mb-4"
      />
      <Suspense fallback={<ManagementSkeleton />}>
        <ManagementClient initialSupplierOrders={supplierOrdersResult.orders} storeId={storeId} />
      </Suspense>
    </>
  );
}
