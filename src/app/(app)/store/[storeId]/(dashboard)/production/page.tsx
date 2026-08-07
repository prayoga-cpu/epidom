import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { ProductionShell } from "@/features/dashboard/production/components/production-shell";

export const metadata = { title: "Production | Epidom" };

export default async function ProductionPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await verifyStoreOwnership(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/production");

  // No active staff session at all means the real owner is browsing —
  // always allowed to flip the on/off toggle. A staff PIN session may have
  // this page in its allowedPages without being the OWNER role, and that
  // should still not be able to change this store-wide operational mode.
  const staffSession = await getActiveStaffSession();
  const canManageSettings =
    !staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER";

  return (
    <div className="flex h-full flex-1 flex-col">
      <ProductionShell storeId={storeId} canManageSettings={canManageSettings} />
    </div>
  );
}
