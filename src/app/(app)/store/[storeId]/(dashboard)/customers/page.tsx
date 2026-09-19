import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomersClient } from "@/features/dashboard/customers/components/customers-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";

export default async function CustomersPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/customers");

  // Editing a customer, adjusting points and exporting the list are a manager's
  // job: a persona that is neither OWNER nor MANAGER gets a read-only page. The
  // API enforces the same rule (requireManagerOrOwnerApi) — this only hides
  // controls that would be refused.
  const staffSession = await getActiveStaffSession();
  const isRestricted =
    !!staffSession &&
    staffSession.storeId === storeId &&
    staffSession.role !== "OWNER" &&
    staffSession.role !== "MANAGER";

  return <CustomersClient storeId={storeId} canManage={!isRestricted} />;
}
