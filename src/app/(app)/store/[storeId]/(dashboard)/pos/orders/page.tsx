import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { PosOrderQueue } from "@/features/pos/components/pos-order-queue";

export default async function PosOrdersPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  await verifyStoreOwnership(storeId, session.user.id);

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Antrian Pesanan</h1>
        <p className="text-muted-foreground">Kelola pesanan dari toko online dan kasir secara real-time.</p>
      </div>
      <PosOrderQueue storeId={storeId} />
    </div>
  );
}
