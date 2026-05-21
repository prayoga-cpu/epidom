import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { TablesManager } from "@/features/pos/components/tables/tables-manager";

export const metadata = { title: "Manajemen Meja | Epidom" };

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
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight">Manajemen Meja</h1>
        <p className="text-sm text-muted-foreground">
          Pantau status meja dine-in secara real-time
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <TablesManager storeId={storeId} />
      </div>
    </div>
  );
}
