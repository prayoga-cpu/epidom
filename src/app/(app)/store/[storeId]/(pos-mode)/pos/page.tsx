import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { PosShell } from "@/features/pos/components/pos-shell";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function PosPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { store } = await verifyStoreAccess(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos");

  return <PosShell store={{ id: store.id, name: store.name }} />;
}
