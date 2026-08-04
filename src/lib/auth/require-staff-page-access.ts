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
 * Call at the top of the page, alongside requirePlan if present. Distinct
 * from requireOwnerOnly, which is an all-or-nothing gate for pages no staff
 * persona should ever reach (Profile, Billing, Staff).
 */
export async function requireStaffPageAccess(storeId: string, page: string): Promise<void> {
  const staffSession = await getActiveStaffSession();
  if (!staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER") return;

  if (!staffSession.allowedPages.includes(page)) {
    const fallback = staffSession.allowedPages[0] ?? "/dashboard";
    redirect(`/store/${storeId}${fallback}`);
  }
}
