import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ShiftsClient } from "@/features/dashboard/shifts/components/shifts-client";

export default async function ShiftsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Pre-fetch active staff for the open-shift dialog
  const staff = await prisma.staffMember.findMany({
    where: { storeId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return <ShiftsClient storeId={storeId} staff={staff} />;
}
