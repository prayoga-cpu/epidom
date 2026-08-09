import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { PosOrdersTabs } from "@/features/pos/components/pos-orders-tabs";
import { PosOrdersPageHeader } from "@/features/pos/components/pos-page-headers";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";

export default async function PosOrdersPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  await verifyStoreOwnership(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos/orders");

  // Same rule as the Kitchen & Bar page's toggle (kds/page.tsx) — the Active
  // Queue toggle is the same store-wide setting, so it gets the same
  // owner-only gate: a staff PIN session may have this page in
  // allowedPages without being the OWNER role, and that should still not be
  // able to flip this operational mode.
  const staffSession = await getActiveStaffSession();
  const canManageSettings =
    !staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER";

  return (
    <div className="flex h-full flex-1 flex-col">
      <PosOrdersPageHeader />
      <PosOrdersTabs storeId={storeId} canManageSettings={canManageSettings} />
    </div>
  );
}
