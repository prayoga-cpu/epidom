import { redirect } from "next/navigation";
import { getActiveStaffSession } from "@/lib/staff-session";

/**
 * Server-side gate for owner-only pages (Profile, Billing, Staff). Redirects
 * away if the current browser has an active staff PIN session for this
 * store — i.e. someone switched to a restricted staff persona — since only
 * the real account owner (no staff session at all) should reach these.
 *
 * Call at the top of the page/layout, alongside requirePlan if present.
 */
export async function requireOwnerOnly(storeId: string): Promise<void> {
  const staffSession = await getActiveStaffSession();
  // role === "OWNER" covers a StaffMember row that is itself the owner (e.g.
  // seeded accounts) — functionally the same as no staff session at all.
  if (staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER") {
    // Send them to a page they can actually see, not just "/pos" — a Kitchen
    // persona (say) doesn't have /pos either, which would just bounce again.
    const fallback = staffSession.allowedPages[0] ?? "/pos";
    redirect(`/store/${storeId}${fallback}`);
  }
}
