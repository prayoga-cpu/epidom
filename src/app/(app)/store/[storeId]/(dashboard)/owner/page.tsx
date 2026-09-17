import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OwnerDashboardClient } from "@/features/dashboard/owner/components/owner-dashboard-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

// Cross-store rollup for multi-outlet Enterprise businesses. storeId is
// cosmetic for this page's own data (GET /api/owner/summary rolls up by
// business, not by store) but real for the shell's StoreSwitcher/breadcrumb
// context, same trade every non-single-store-specific page in this shell
// already makes.
export default async function OwnerPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/owner");

  return <OwnerDashboardClient />;
}
