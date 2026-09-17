import { redirect } from "next/navigation";
import { getActiveStaffSession } from "@/lib/staff-session";

/**
 * Server-side gate for a specific dashboard page. If the current browser has
 * an active staff PIN session for this store, the page must be in that
 * staff member's resolved allowedPages (role default or owner override) —
 * otherwise redirect them to the first page they *are* allowed, or a safe
 * fallback. No active staff session at all means the real owner is
 * browsing — always unrestricted.
 *
 * `page` accepts an array when a single route now serves more than one
 * grantable permission (e.g. /storefront also covers the retired standalone
 * /menu page's narrower grant — see grantableOnlyNavItems in
 * navigation.config.ts) — access is allowed if ANY of the pages is granted.
 *
 * Call at the top of the page, alongside requirePlan if present. Distinct
 * from requireOwnerOnly, which is an all-or-nothing gate for pages no staff
 * persona should ever reach (Profile, Billing, Staff).
 */
export async function requireStaffPageAccess(
  storeId: string,
  page: string | string[]
): Promise<void> {
  const staffSession = await getActiveStaffSession();
  if (!staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER") return;

  const pages = Array.isArray(page) ? page : [page];
  if (!pages.some((p) => staffSession.allowedPages.includes(p))) {
    // /pos, not /dashboard: a restricted persona reaching this branch is by
    // definition not the account owner, and /dashboard is not a page most
    // staff roles are ever granted — falling back to it just traded one
    // "you can't be here" redirect for a second one. /pos is every staff
    // role's actual safe home (POS Mode, not Back Office), preferred over
    // allowedPages[0] even when that's already set, since an owner-edited
    // permission order shouldn't accidentally change where a denied staffer
    // lands. Empty allowedPages (an owner unchecked every box) still falls
    // back to /pos rather than /dashboard for the same reason.
    const fallback = staffSession.allowedPages.includes("/pos")
      ? "/pos"
      : (staffSession.allowedPages[0] ?? "/pos");
    redirect(`/store/${storeId}${fallback}`);
  }
}
