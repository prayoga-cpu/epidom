import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchSupplierOrdersForPage } from "@/lib/server/data-fetchers";
import { ManagementClient } from "@/features/dashboard/management/components/management-client";

export default async function ManagementPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch initial supplier orders
  // Optimize: Only fetch PLACED (active) and RECEIVED orders for the deliveries tab
  // This matches the client-side filtering and prevents loading unnecessary data
  const supplierOrdersResult = await fetchSupplierOrdersForPage(storeId, {
    status: ["PLACED", "RECEIVED"],
    take: 100, // Reasonable limit for initial view
  });

  return <ManagementClient initialSupplierOrders={supplierOrdersResult.orders} storeId={storeId} />;
}
