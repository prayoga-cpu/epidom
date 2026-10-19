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
 * Gate for the partner page: the account's own, and only when it is a
 * partner. Admins follow every partner on the Referrals page instead. No
 * staff persona may be active.
 */
export async function requirePartnerPage(): Promise<{ access: AdminAccess; partnerId: string }> {
  const access = await requireAdminSection("my-referrals");
  // A cashier who took over the owner's iPad with a PIN must not see the
  // owner's partner earnings.
  const persona = await getActiveStaffSession();
  if (persona && persona.role !== "OWNER") redirect("/stores");
  if (!access.partnerId) redirect("/stores");
  return { access, partnerId: access.partnerId };
}

/** The first page in the admin nav this account may open, or null. */
export function firstAdminHref(access: AdminAccess): string | null {
  return visibleSections(access)[0]?.href ?? null;
}

function sectionPath(key: AdminSectionKey): string {
  return key === "users" ? "/admin" : `/admin/${key}`;
}
