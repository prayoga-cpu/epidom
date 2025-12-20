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
  const supplierOrdersResult = await fetchSupplierOrdersForPage(storeId);

  return <ManagementClient initialSupplierOrders={supplierOrdersResult.orders} storeId={storeId} />;
}
