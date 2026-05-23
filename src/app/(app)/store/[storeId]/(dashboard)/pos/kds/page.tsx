import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { KdsShell } from "@/features/pos/components/kds/kds-shell";
import { KdsPageHeader } from "@/features/pos/components/pos-page-headers";

export const metadata = { title: "KDS | Epidom" };

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
      <KdsPageHeader />
      <div className="flex-1 min-h-0 overflow-hidden">
        <KdsShell storeId={storeId} />
      </div>
    </div>
  );
}
