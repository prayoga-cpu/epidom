import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { KdsShell } from "@/features/pos/components/kds/kds-shell";
import { KdsPageHeader } from "@/features/pos/components/pos-page-headers";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata = { title: "Kitchen & Bar | Epidom" };

export default async function KdsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  await verifyStoreOwnership(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos/kds");

  // No active staff session at all means the real owner is browsing —
  // always allowed to flip the on/off toggle. A staff PIN session may have
  // this page in its allowedPages without being the OWNER role, and that
  // should still not be able to change this store-wide operational mode.
  const staffSession = await getActiveStaffSession();
  const canManageSettings =
    !staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER";

  return (
    <div className="flex h-full flex-1 flex-col">
      <KdsPageHeader />
      <div className="min-h-0 flex-1 overflow-hidden">
        <KdsShell storeId={storeId} canManageSettings={canManageSettings} />
      </div>
    </div>
  );
}
