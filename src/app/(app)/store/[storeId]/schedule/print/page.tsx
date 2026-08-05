import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { SchedulePrintView } from "@/features/dashboard/schedule/components/schedule-print-view";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent — so it doesn't inherit the sidebar/
// topbar chrome. This route is a standalone printable document.

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface PrintPageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulePrintPage({ params, searchParams }: PrintPageProps) {
  const { storeId } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);

  const now = new Date();
  const from = firstParam(sp.from) ?? now.toISOString().slice(0, 10);
  const to = firstParam(sp.to) ?? from;

  const schedules = await prisma.staffSchedule.findMany({
    where: {
      storeId,
      date: { gte: businessDateKeyToDate(from), lte: businessDateKeyToDate(to) },
    },
    include: {
      staffMember: { select: { name: true } },
      scheduleShift: true,
    },
    orderBy: [{ date: "asc" }],
  });

  const rows = schedules.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    staffName: s.staffMember.name,
    isDayOff: s.isDayOff,
    scheduleShiftLabel: s.scheduleShift
      ? `${s.scheduleShift.name} (${s.scheduleShift.startTime}–${s.scheduleShift.endTime})`
      : null,
    customStartTime: s.customStartTime,
    customEndTime: s.customEndTime,
    department: s.department,
    status: s.status,
  }));

  return (
    <SchedulePrintView
      storeName={store.name}
      from={from}
      to={to}
      rows={rows}
      generatedAt={new Date().toISOString()}
    />
  );
}
