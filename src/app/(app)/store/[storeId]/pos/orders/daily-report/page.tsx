import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { buildShiftReport } from "@/lib/services/shift-report.service";
import { ShiftReportPrintView } from "@/features/pos/components/shift-report-print-view";

// Deliberately outside the (dashboard) route group so it doesn't inherit
// PageShell's sidebar/topbar chrome — this route is a standalone printable
// document, not a dashboard screen. Same rationale as the sibling `print/`
// route. It still inherits I18nProvider and CurrencyProvider from (app).
//
// The URL is the deliverable: it is stable and re-openable, so a shift's
// report can be re-printed later without re-deriving the window (the same
// shape as the public /r/[orderId] receipt page).

interface PageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export default async function DailyReportPage({ params, searchParams }: PageProps) {
  const { storeId } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await verifyStoreOwnership(storeId, session.user.id);
  // Same gate as the Order History page this report is an export of — the
  // report is whole-store revenue, and a KITCHEN persona's default pages are
  // only /pos/kds and /schedule. Every role that can open or close a till
  // (OWNER/MANAGER/CASHIER — see POS_CAPABLE_ROLES in my-schedule-list.tsx)
  // has /pos/orders, so the shift-close "View report" link still works.
  await requireStaffPageAccess(storeId, "/pos/orders");

  // Called directly rather than through /api/.../reports/shift-report — same
  // service either way, so the page and the thermal print can't disagree, and
  // this saves a round-trip on a server component.
  const result = await buildShiftReport(storeId, {
    shiftId: firstParam(sp.shiftId),
    from: parseDate(firstParam(sp.from)),
    to: parseDate(firstParam(sp.to)),
  });

  if (!result.ok) notFound();

  return (
    <ShiftReportPrintView
      report={result.report}
      storeName={result.storeName}
      currency={result.currency}
      shiftLabel={result.shiftLabel}
      generatedAt={new Date().toISOString()}
      // ?print=0 opens the report to read rather than to immediately paper it
      // — used by the "View report" link after closing a shift.
      autoPrint={firstParam(sp.print) !== "0"}
    />
  );
}
