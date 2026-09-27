/**
 * Dashboard Page
 *
 * Main dashboard overview. Server-side rendered with parallel data fetching.
 *
 * The dashboard is reachable on every plan, so it resolves which surfaces the
 * viewer is actually entitled to *here* rather than letting each card
 * discover its own 403 client-side: an OPERATIONS-only card renders for an
 * OPERATIONS viewer, and everyone below that gets a single upgrade tile
 * instead of a wall of locked ones. Doing it server-side also means no
 * flash-then-disappear on load, and no queries run for cards nobody will see.
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fetchAlertsForPage, fetchStockLevelsForPage } from "@/lib/server/data-fetchers";
import { DashboardClient } from "@/features/dashboard/dashboard/components/dashboard-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { subscriptionService } from "@/lib/services";
import { planHasFeature } from "@/lib/plans/entitlements";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { isWithinNewStoreWindow } from "@/lib/services/setup-progress.service";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";

export default async function DashboardPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/dashboard");

  const [plan, staffSession, store] = await Promise.all([
    subscriptionService.getActivePlan(session.user.id),
    getActiveStaffSession(),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { productionEnabled: true, createdAt: true },
    }),
  ]);

  const hasOperationsAccess = planHasFeature(plan, "staffOperations");

  // Attendance and till sessions are the manager audit surface — a CASHIER or
  // KITCHEN PIN persona shouldn't see the whole floor's clock records, same
  // rule the /attendance API enforces via requireManagerOrOwnerApi.
  const isRestrictedStaff =
    !!staffSession &&
    staffSession.storeId === storeId &&
    staffSession.role !== "OWNER" &&
    staffSession.role !== "MANAGER";

  // Both gates must hold: the plan sets the ceiling, the owner's per-store
  // toggle the intent. A store that never opted into recipe→batch production
  // has nothing but a flat zero line to show.
  const showProductionHistory =
    planHasFeature(plan, "production") && (store?.productionEnabled ?? false);
  const showOperations = hasOperationsAccess && !isRestrictedStaff;
  // The analytics block links into Finance for the same dates — only when the
  // plan includes it and this viewer could open it (the Finance page and its
  // routes apply the same persona rule), so the link never leads to a redirect.
  const canOpenFinance =
    planHasFeature(plan, "finance") && staffPersonaMayReadFinance(staffSession, storeId);

  // In-app guide. The Getting-started checklist is for the owner or a MANAGER
  // persona on the owner's device (the setup-progress API's own rule, so it
  // never asks for a 403); the welcome tour opens by itself for the owner
  // only. A linked staff account is never the owner. getStoreViewer is
  // request-cached — requireStaffPageAccess above already paid for it.
  const viewer = await getStoreViewer(storeId);
  const guidePersonaRole =
    staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER"
      ? staffSession.role
      : null;
  const onOwnerAccount = viewer.kind === "owner";
  const isOwner = onOwnerAccount && guidePersonaRole === null;
  const showSetupGuide =
    onOwnerAccount && (guidePersonaRole === null || guidePersonaRole === "MANAGER");
  const isNewStore = store ? isWithinNewStoreWindow(store.createdAt) : false;

  // Stock levels and alerts back OPERATIONS-only cards — skip the queries
  // outright when the viewer can't see them.
  const [stockLevelsResult, alertsResult] = await Promise.all([
    hasOperationsAccess ? fetchStockLevelsForPage(storeId) : null,
    hasOperationsAccess ? fetchAlertsForPage(storeId) : null,
  ]);

  return (
    <DashboardClient
      initialStockLevels={stockLevelsResult?.materials ?? []}
      initialAlerts={alertsResult?.alerts ?? []}
      storeId={storeId}
      hasOperationsAccess={hasOperationsAccess}
      showProductionHistory={showProductionHistory}
      showOperations={showOperations}
      canOpenFinance={canOpenFinance}
      showSetupGuide={showSetupGuide}
      isOwner={isOwner}
      isNewStore={isNewStore}
    />
  );
}
