import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { PosOrdersTabs } from "@/features/pos/components/pos-orders-tabs";
import { PosOrdersPageHeader } from "@/features/pos/components/pos-page-headers";

export default async function PosOrdersPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  await verifyStoreOwnership(storeId, session.user.id);

  return (
    <div className="flex h-full flex-1 flex-col">
      <PosOrdersPageHeader />
      <PosOrdersTabs storeId={storeId} />
    </div>
  );
}
