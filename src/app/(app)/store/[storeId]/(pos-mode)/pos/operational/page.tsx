import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { posModeNavItems } from "@/config/navigation.config";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStorePlan } from "@/lib/plans/store-plan";
import { planHasFeature } from "@/lib/plans/entitlements";
import { PosModeOperational } from "@/features/pos-mode/pos-mode-operational";
import { resolveOperationalTabs } from "@/features/pos-mode/lib/operational-tabs";

/** The POS System's tab routes, in the bar's order. */
const POS_SYSTEM_PAGES = ["/pos", "/pos/orders", "/pos/kds", "/tables"];

// POS Mode's Operational page: the till shift, My Schedule, the team's published
// schedule and Clock In / Out as tabs of one page, shown without the POS System's bottom tab bar (see
// PosModeShell). It replaces /pos/shift and /pos/schedule, which now redirect
// here with ?tab=.
//
// Not a permission of its own: any POS Mode grant opens it, and each tab keeps
// the grant its old page or drawer row had (resolveOperationalTabs). No
// whole-page redirect for the owner the way the old /pos/schedule did — that
// would take the Shift and Clock tabs away from them too.
export default async function PosModeOperationalPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requireStaffPageAccess(
    storeId,
    posModeNavItems.map((item) => item.href)
  );

  const [viewer, staffSession, clockableStaff, storePlan] = await Promise.all([
    getStoreViewer(storeId),
    getActiveStaffSession(),
    prisma.staffMember.count({ where: { storeId, isActive: true, role: { not: "OWNER" } } }),
    getStorePlan(storeId),
  ]);
  if (viewer.kind === "none") redirect("/stores");

  const session = staffSession?.storeId === storeId ? staffSession : null;
  const tabs = resolveOperationalTabs({
    viewer: viewer.kind,
    session,
    hasClockableStaff: clockableStaff > 0,
    staffOperations: planHasFeature(storePlan, "staffOperations"),
  });

  // Nothing here for this persona (say, a linked kitchen account with no
  // schedule grant, arriving from an old /pos/schedule link): send them to the
  // POS System tab they do have rather than a blank page with no tab bar. Never
  // "/pos/schedule" — that redirects back here.
  if (tabs.length === 0 && session) {
    const home = POS_SYSTEM_PAGES.find((page) => session.allowedPages.includes(page));
    if (home) redirect(`/store/${storeId}${home}`);
  }

  // The Team Schedule's rows: active staff only, and only what Back Office's own
  // roster lists (name and role — no contact details).
  const rosterStaff = tabs.includes("roster")
    ? await prisma.staffMember.findMany({
        where: { storeId, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <PosModeOperational
      storeId={storeId}
      tabs={tabs}
      scheduleStaffMemberId={session?.staffMemberId ?? null}
      renderedFor={session?.staffMemberId ?? "owner"}
      rosterStaff={rosterStaff}
    />
  );
}
