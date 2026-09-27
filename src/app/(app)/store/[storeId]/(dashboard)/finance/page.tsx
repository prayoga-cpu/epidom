import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinanceReport } from "@/features/dashboard/finance/components/finance-report";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { getActiveStaffSession } from "@/lib/staff-session";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";

export default async function FinancePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/finance");

  // Pre-fetch filter options for the Staff / Category selects, plus the
  // business's total store count — the "All outlets" scope only exists when
  // there's more than one store to roll up.
  const [staff, categories, store, viewer, staffSession] = await Promise.all([
    prisma.staffMember.findMany({
      where: { storeId },
      // Kept regardless of isActive — past orders/reports can still be tied
      // to a since-deactivated staff member, so the filter needs to be able
      // to select them (labeled Inactive in FinanceClient), not just staff
      // currently on the roster.
      select: { id: true, name: true, role: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.menuCategory.findMany({
      where: { storefront: { storeId } },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { business: { select: { _count: { select: { stores: true } } } } },
    }),
    getStoreViewer(storeId),
    getActiveStaffSession(),
  ]);
  const businessStoreCount = store?.business?._count.stores ?? 1;

  // requireStaffPageAccess only restricts THIS outlet's personas; a manager
  // persona from another outlet would get the page and then a 403 from every
  // report route. Same rule as the routes (require-finance-access.ts).
  if (staffSession && !staffPersonaMayReadFinance(staffSession, storeId)) {
    redirect(`/store/${staffSession.storeId}/pos`);
  }

  // The roll-up shows every outlet's revenue and profit, so it is the
  // owner's alone: a manager persona granted /finance runs one outlet and
  // must not read the others. Any non-OWNER persona on this browser hides
  // it, whichever outlet the persona belongs to — the same rule GET
  // /api/owner/summary enforces, which has no store to compare against.
  const isOwnerViewing =
    viewer.kind === "owner" && (!staffSession || staffSession.role === "OWNER");

  return (
    <FinanceReport
      storeId={storeId}
      staff={staff}
      categories={categories}
      canViewAllOutlets={businessStoreCount > 1 && isOwnerViewing}
    />
  );
}
