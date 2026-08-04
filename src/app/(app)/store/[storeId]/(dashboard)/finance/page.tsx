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

  // Pre-fetch filter options for the Staff / Category selects
  const [staff, categories] = await Promise.all([
    prisma.staffMember.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.menuCategory.findMany({
      where: { storefront: { storeId } },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return <FinanceClient storeId={storeId} staff={staff} categories={categories} />;
}
