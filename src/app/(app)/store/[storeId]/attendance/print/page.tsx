import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";
import { AttendancePrintView } from "@/features/dashboard/attendance/components/attendance-print-view";
import { getBusinessDateKey } from "@/lib/attendance/business-date";
import {
  fetchHoursReport,
  getStoreHoursSettings,
  resolveReportRange,
} from "@/lib/attendance/fetch-hours-report";
import { fetchPayroll } from "@/lib/attendance/fetch-payroll";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStorePlan } from "@/lib/plans/store-plan";
import { planHasFeature } from "@/lib/plans/entitlements";
import { fetchUnifiedLog } from "@/lib/attendance/unified-log";
import { formatCurrency } from "@/lib/utils/formatting";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent.

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
  const settings = await getStoreHoursSettings(storeId);
  const rangeParams = new URLSearchParams();
  const fromParam = firstParam(sp.from);
  const toParam = firstParam(sp.to);
  if (fromParam) rangeParams.set("from", fromParam);
  if (toParam) rangeParams.set("to", toParam);
  const range = resolveReportRange(rangeParams, settings.timeZone, now);
  const todayKey = getBusinessDateKey(now, settings.timeZone);
  const from = range?.fromKey ?? `${todayKey.slice(0, 8)}01`;
  const to = range?.toKey ?? todayKey;
  const staffId = firstParam(sp.staffId);
  const tabParam = firstParam(sp.tab);
  const tab = tabParam === "hours" || tabParam === "salary" ? tabParam : "log";

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  if (tab === "salary") {
    // Salaries: the real owner with no other persona on the device — what
    // GET /payroll enforces. requireOwnerOnly above only turns away a persona
    // of THIS store.
    const persona = await getActiveStaffSession();
    if (persona && persona.role !== "OWNER") redirect(`/store/${storeId}/schedule`);
    // Same plan gate as the Schedule page and GET /payroll — this page sits
    // outside the (dashboard) group, so no layout applies it here.
    if (!planHasFeature(await getStorePlan(storeId), "staffOperations")) {
      redirect(`/store/${storeId}/schedule`);
    }

    const payroll = await fetchPayroll({ storeId, fromKey: from, toKey: to, staffId, settings, now });
    return (
      <AttendancePrintView
        storeName={store.name}
        from={from}
        to={to}
        payroll={payroll}
        generatedAt={now.toISOString()}
      />
    );
  }

  if (tab === "hours") {
    const { rows } = await fetchHoursReport({ storeId, fromKey: from, toKey: to, staffId, settings, now });
    const staff = await prisma.staffMember.findMany({
      where: { storeId, id: { in: [...new Set(rows.map((r) => r.staffMemberId))] } },
      select: { id: true, name: true },
    });
    const staffMap = new Map(staff.map((s) => [s.id, s.name]));

    return (
      <AttendancePrintView
        storeName={store.name}
        from={from}
        to={to}
        hoursRows={rows.map((row) => ({ ...row, staffName: staffMap.get(row.staffMemberId) ?? row.staffMemberId }))}
        generatedAt={now.toISOString()}
      />
    );
  }

  const { currency } = await getFinanceSettings(storeId);

  // Attendance only: till cash is the Shifts page's report, not part of who was
  // on the clock.
  const records = await fetchUnifiedLog({
    storeId,
    from: fromDate,
    to: toDate,
    staffId: staffId ?? undefined,
    types: ["CLOCK_IN", "CLOCK_OUT", "ABSENCE"],
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
