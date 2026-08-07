import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";
import { AttendancePrintView } from "@/features/dashboard/attendance/components/attendance-print-view";
import { pairAttendanceIntoWorkdays } from "@/lib/attendance/hours-aggregation";
import { getBusinessDateKey } from "@/lib/attendance/business-date";
import { fetchUnifiedLog } from "@/lib/attendance/unified-log";
import { formatCurrency } from "@/lib/utils/formatting";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent.

const DAY_MS = 24 * 60 * 60 * 1000;

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface PrintPageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AttendancePrintPage({ params, searchParams }: PrintPageProps) {
  const { storeId } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Attendance is a manager/owner-only surface — the audit trail this print
  // view exports is the same data the dashboard page restricts.
  await requireOwnerOnly(storeId);

  const store = await verifyStoreOwnership(storeId, session.user.id);

  const now = new Date();
  const from = firstParam(sp.from) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = firstParam(sp.to) ?? now.toISOString().slice(0, 10);
  const staffId = firstParam(sp.staffId);
  const tab = firstParam(sp.tab) === "hours" ? "hours" : "log";

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  if (tab === "hours") {
    const business = await prisma.store.findUnique({
      where: { id: storeId },
      select: { standardWorkMinutesPerDay: true, business: { select: { timezone: true } } },
    });
    const timezone = business?.business.timezone ?? "UTC";
    const standardWorkMinutesPerDay = business?.standardWorkMinutesPerDay ?? 480;

    const events = await prisma.attendanceRecord.findMany({
      where: {
        storeId,
        type: { in: ["CLOCK_IN", "CLOCK_OUT", "ABSENCE"] },
        ...(staffId && { staffMemberId: staffId }),
        timestamp: { gte: new Date(fromDate.getTime() - DAY_MS), lte: new Date(toDate.getTime() + DAY_MS) },
      },
      select: { id: true, staffMemberId: true, type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    });
    const result = pairAttendanceIntoWorkdays(events, standardWorkMinutesPerDay, timezone, now);
    const fromKey = getBusinessDateKey(fromDate, timezone);
    const toKey = getBusinessDateKey(toDate, timezone);
    const staff = await prisma.staffMember.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.staffMemberId))] } },
      select: { id: true, name: true },
    });
    const staffMap = new Map(staff.map((s) => [s.id, s.name]));

    const hoursRows = result.dailyRows
      .filter((row) => row.date >= fromKey && row.date <= toKey)
      .map((row) => ({
        date: row.date,
        staffName: staffMap.get(row.staffMemberId) ?? row.staffMemberId,
        regularMinutes: row.regularMinutes,
        overtimeMinutes: row.overtimeMinutes,
      }));

    return (
      <AttendancePrintView
        storeName={store.name}
        from={from}
        to={to}
        hoursRows={hoursRows}
        generatedAt={new Date().toISOString()}
      />
    );
  }

  const business = await prisma.store.findUnique({
    where: { id: storeId },
    select: { business: { select: { currency: true } } },
  });
  const currency = business?.business.currency ?? "IDR";

  const records = await fetchUnifiedLog({
    storeId,
    from: fromDate,
    to: toDate,
    staffId: staffId ?? undefined,
  });

  const logRows = records.map((r) => ({
    timestamp: r.timestamp,
    staffName: r.staffName,
    type: r.type,
    hasSelfie: !!r.selfieUrl,
    locationLabel: r.locationLabel,
    amountFormatted: r.amount != null ? formatCurrency(r.amount, currency) : null,
  }));

  return (
    <AttendancePrintView
      storeName={store.name}
      from={from}
      to={to}
      logRows={logRows}
      generatedAt={new Date().toISOString()}
    />
  );
}
