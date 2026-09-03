import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, isAdminUser } from "@/lib/admin";

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
export type AdminGrantSource = "DB_FLAG" | "HARDCODED_EMAIL";

export interface ActingAdmin {
  id: string;
  email: string;
  name: string;
  /**
   * DB_FLAG when `User.isAdmin` is true. HARDCODED_EMAIL when the flag is
   * false and the address is in HARDCODED_ADMIN_EMAILS — i.e. the case that
   * leaves no database trace of its own.
   */
  grantSource: AdminGrantSource;
}

/**
 * Resolve the acting admin, or null when the caller is not one.
 *
 * Prefer {@link requireAdminApi} in route handlers; this variant is for
 * callers that need to branch on the result rather than return a response.
 */
export async function getActingAdmin(): Promise<ActingAdmin | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // The DB flag wins when both are true: it is the durable grant, and the
    // hardcoded list is the fallback that leaves no record.
    grantSource: user.isAdmin ? "DB_FLAG" : "HARDCODED_EMAIL",
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
export async function requireAdminApi(): Promise<ActingAdmin | NextResponse> {
  const admin = await getActingAdmin();
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
