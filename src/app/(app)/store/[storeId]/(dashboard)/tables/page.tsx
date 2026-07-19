import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { TablesManager } from "@/features/pos/components/tables/tables-manager";
import { ReservationList } from "@/features/pos/components/tables/reservation-list";
import { TablesPageHeader } from "@/features/pos/components/pos-page-headers";

export const metadata = { title: "Tables | Epidom" };

export default async function TablesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  await verifyStoreOwnership(storeId, session.user.id);

  return (
    <div className="flex h-full flex-1 flex-col">
      <TablesPageHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TablesManager storeId={storeId} />
        <ReservationList storeId={storeId} />
      </div>
    </div>
  );
}
