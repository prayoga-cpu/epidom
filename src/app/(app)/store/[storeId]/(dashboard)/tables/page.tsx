import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { TablesManager } from "@/features/pos/components/tables/tables-manager";
import { TablesPageHeader } from "@/features/pos/components/pos-page-headers";

export const metadata = { title: "Tables | Epidom" };

export default async function TablesPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  await verifyStoreOwnership(storeId, session.user.id);

  return (
    <div className="flex flex-col flex-1 h-full">
      <TablesPageHeader />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <TablesManager storeId={storeId} />
      </div>
    </div>
  );
}
