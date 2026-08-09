import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinanceClient } from "@/features/dashboard/finance/components/finance-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function FinancePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/finance");

  // Pre-fetch filter options for the Staff / Category selects, plus the
  // business's total store count — only worth surfacing the "All Outlets"
  // rollup link (see /owner) when there's actually more than one store to
  // roll up.
  const [staff, categories, store] = await Promise.all([
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
  ]);
  const businessStoreCount = store?.business?._count.stores ?? 1;

  return (
    <FinanceClient
      storeId={storeId}
      staff={staff}
      categories={categories}
      showOwnerLink={businessStoreCount > 1}
    />
  );
}
