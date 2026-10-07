import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ShiftsClient } from "@/features/dashboard/shifts/components/shifts-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { isOwnerActing } from "@/lib/auth/require-owner-only";

// The manager's shift report: every till session, its opening cash and how the
// drawer closed. Separate from Schedule (rosters and attendance) on purpose —
// opening and finishing a till happens on POS Mode's Operational page (Shift tab);
// this is the read-back, plus one override: the owner can close a till someone
// else left open (the POS lets only its opener finish it).
export default async function ShiftsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/shifts");

  const staff = await prisma.staffMember.findMany({
    where: { storeId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <ShiftsClient storeId={storeId} staff={staff} canCloseShifts={await isOwnerActing(storeId)} />
  );
}
