import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceClient } from "@/features/dashboard/attendance/components/attendance-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/attendance");

  const staff = await prisma.staffMember.findMany({
    where: { storeId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return <AttendanceClient storeId={storeId} staff={staff} />;
}
