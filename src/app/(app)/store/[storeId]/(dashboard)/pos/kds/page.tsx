import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { KdsShell } from "@/features/pos/components/kds/kds-shell";

export const metadata = { title: "KDS – Dapur Digital | Epidom" };

export default async function KdsPage({
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
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Kitchen Display System</h1>
          <p className="text-sm text-muted-foreground">
            Tampilan dapur real-time · Tap item untuk update status
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <KdsShell storeId={storeId} />
      </div>
    </div>
  );
}
