import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getAdminAccess, type AdminGrantSource } from "@/lib/auth/admin-access";
import {
  canOpenSection,
  type AdminSectionKey,
  type GrantableAdminSectionKey,
} from "@/config/admin-sections.config";

/**
 * Admin gate for API routes.
 *
 * Replaces the seven byte-identical `async function requireAdmin()` helpers
 * that were copy-pasted across `src/app/api/admin/**`. Those returned only the
 * user, which meant nothing downstream could tell *how* the caller qualified.
 *
 * That distinction matters for the audit trail. `isAdminUser()` is
 * `isAdminFlag || isAdminEmail(email)` (src/lib/admin.ts) — an account that
 * qualifies solely through the hardcoded email list has `User.isAdmin === false`
 * in the database, so after the fact there is no stored evidence it was ever
 * privileged. Recording the grant source on every admin action is the only
 * durable trace that class of actor existed at all.
 */

/** How the acting account satisfied the admin check. */
export type { AdminGrantSource };

export interface ActingAdmin {
  id: string;
  email: string;
  name: string;
  /**
   * DB_FLAG when `User.isAdmin` is true. HARDCODED_EMAIL when the flag is
   * false and the address is in HARDCODED_ADMIN_EMAILS — i.e. the case that
   * leaves no database trace of its own. SECTION_GRANT for an account given
   * some admin pages only (User.adminSections).
   */
  grantSource: AdminGrantSource;
  /** A full admin (DB flag or hardcoded email): every page and action. */
  full: boolean;
  /** The pages a SECTION_GRANT admin was given (empty for a full admin). */
  sections: GrantableAdminSectionKey[];
}

export interface AdminGateOptions {
  /**
   * The admin page this route belongs to. A full admin always passes; an
   * account given that page (User.adminSections) passes too. Left out, only a
   * full admin passes: a route nobody mapped stays locked.
   */
  section?: AdminSectionKey;
}

/**
 * Resolve the acting admin, or null when the caller may not use this route.
 *
 * Prefer {@link requireAdminApi} in route handlers; this variant is for
 * callers that need to branch on the result rather than return a response.
 */
export async function getActingAdmin(options: AdminGateOptions = {}): Promise<ActingAdmin | null> {
  const access = await getAdminAccess();
  if (!access?.grantSource) return null;

  const allowed = options.section
    ? canOpenSection(access, options.section)
    : access.full;
  if (!allowed) return null;

  return {
    id: access.user.id,
    email: access.user.email,
    name: access.user.name,
    grantSource: access.grantSource,
    full: access.full,
    sections: access.sections,
  };
}

/**
 * Admin gate returning either the acting admin or a 403 response to return
 * immediately.
 *
 * Deliberately mirrors the shape of `requireSessionApi()` so route handlers
 * read the same way:
 *
 * ```ts
 * const admin = await requireAdminApi();
 * if (admin instanceof NextResponse) return admin;
 * ```
 *
 * The 403 body is `{ error: "Forbidden" }`, byte-identical to what the seven
 * hand-rolled copies returned, so no admin client code needs changing.
 */
export async function requireAdminApi(
  options: AdminGateOptions = {}
): Promise<ActingAdmin | NextResponse> {
  const admin = await getActingAdmin(options);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return admin;
}

/**
 * Grant source for an email/flag pair already loaded by the caller.
 * Exported for the audit layer, which resolves actors outside route handlers.
 */
export function resolveGrantSource(
  email: string | null | undefined,
  isAdminFlag: boolean
): AdminGrantSource | null {
  if (isAdminFlag) return "DB_FLAG";
  if (isAdminEmail(email)) return "HARDCODED_EMAIL";
  return null;
}
