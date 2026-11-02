import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { FiscalJournal } from "@/features/dashboard/fiscal/components/fiscal-journal";

// The till's signed sales journal (src/lib/fiscal). No plan gate, on purpose:
// the records must stay reachable for six years whatever plan the store is on.
// Personas follow the Finance rule, with the /fiscal page grant.
export default async function FiscalPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/fiscal");
  const staffSession = await getActiveStaffSession();
  if (staffSession && !staffPersonaMayReadFinance(staffSession, storeId, ["/fiscal"])) {
    redirect(`/store/${staffSession.storeId}/pos`);
  }

  return <FiscalJournal storeId={storeId} />;
}
