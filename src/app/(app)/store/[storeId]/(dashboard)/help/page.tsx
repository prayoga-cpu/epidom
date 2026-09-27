/**
 * In-app Help centre: guides, the latest releases, getting-started shortcuts
 * and support. Gets the PageShell chrome from the (dashboard) layout.
 *
 * Open to every member of the store, like /changelog: no requireStaffPageAccess
 * gate, because help is not a permission — a Cashier persona on the owner's
 * device needs the guides as much as the owner. (A linked staff account never
 * gets here: the layout sends it to POS Mode, where the same Help centre opens
 * in a sheet from the Epidom menu.)
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { changelogService, type ReleaseDTO } from "@/lib/services/changelog.service";
import { HelpCenter } from "@/features/guide/components/help-center";
import { HELP_GUIDE_PARAM, HELP_RELEASE_COUNT } from "@/features/guide/lib/help-guides";

export default async function StoreHelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [query, staffSession, releases] = await Promise.all([
    searchParams,
    getActiveStaffSession(),
    // What's new is a nice-to-have: a failed read shows the empty state, not an error page.
    changelogService.getReleases().catch((): ReleaseDTO[] => []),
  ]);

  // A PIN persona of THIS store other than the owner's own. The checklist and
  // the tour live on the dashboard, and the checklist API answers the owner or
  // an OWNER/MANAGER persona only — so offer each only where it would open.
  const persona =
    staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER"
      ? staffSession
      : null;
  const canManage = !persona || persona.role === "MANAGER";
  const canOpenDashboard = !persona || persona.allowedPages.includes("/dashboard");

  const rawGuide = query[HELP_GUIDE_PARAM];
  const guide = typeof rawGuide === "string" && rawGuide.length > 0 ? rawGuide : null;

  return (
    <HelpCenter
      // A new ?guide= (a Learn more link, the sidebar's Help link) starts the reader fresh.
      key={guide ?? "index"}
      context="backoffice"
      storeId={storeId}
      canManage={canManage}
      canOpenDashboard={canOpenDashboard}
      releases={releases.slice(0, HELP_RELEASE_COUNT)}
      initialGuideSlug={guide}
    />
  );
}
