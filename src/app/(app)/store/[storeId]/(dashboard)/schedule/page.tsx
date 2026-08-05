import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ScheduleClient } from "@/features/dashboard/schedule/components/schedule-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";

export default async function SchedulePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/schedule");

  const staffSession = await getActiveStaffSession();
  const isRestricted =
    !!staffSession &&
    staffSession.storeId === storeId &&
    staffSession.role !== "OWNER" &&
    staffSession.role !== "MANAGER";

  const staff = await prisma.staffMember.findMany({
    where: { storeId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <ScheduleClient
      storeId={storeId}
      staff={staff}
      canManage={!isRestricted}
      viewerStaffMemberId={isRestricted ? staffSession!.staffMemberId : null}
    />
  );
}
