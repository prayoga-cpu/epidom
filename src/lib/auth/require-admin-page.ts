import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminAccess, type AdminAccess } from "@/lib/auth/admin-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import {
  canOpenSection,
  visibleSections,
  type AdminSectionKey,
} from "@/config/admin-sections.config";

/**
 * Gate for an admin page. Call at the top of every page under
 * src/app/(app)/admin/: the admin layout is not an auth boundary (a soft
 * navigation between admin pages doesn't re-render it).
 *
 * Signed out → /login. Signed in without this page → the first admin page
 * the account may open, or /stores when there is none.
 */
export async function requireAdminSection(key: AdminSectionKey): Promise<AdminAccess> {
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(sectionPath(key))}`);

  const access = await getAdminAccess();
  if (!access) redirect("/stores");
  if (!canOpenSection(access, key)) redirect(firstAdminHref(access) ?? "/stores");
  return access;
}

/**
 * Gate for a partner page: the account's own (it is a partner) or one it may
 * view read-only (PartnerViewer). `requested` picks among them (?partner=);
 * otherwise its own, else the first it views. No staff persona may be active.
 */
export async function requirePartnerPage(
  requested?: string | null
): Promise<{ access: AdminAccess; partnerId: string; readOnly: boolean }> {
  const access = await requireAdminSection("my-referrals");
  // A cashier who took over the owner's iPad with a PIN must not see the
  // owner's partner earnings.
  const persona = await getActiveStaffSession();
  if (persona && persona.role !== "OWNER") redirect("/stores");
  const partnerId =
    requested && access.viewablePartnerIds.includes(requested)
      ? requested
      : access.viewablePartnerIds[0];
  if (!partnerId) redirect("/stores");
  return { access, partnerId, readOnly: partnerId !== access.partnerId };
}

/** The first page in the admin nav this account may open, or null. */
export function firstAdminHref(access: AdminAccess): string | null {
  return visibleSections(access)[0]?.href ?? null;
}

function sectionPath(key: AdminSectionKey): string {
  return key === "users" ? "/admin" : `/admin/${key}`;
}
