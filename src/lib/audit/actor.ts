import { createHash } from "crypto";
import type { Session } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { resolveGrantSource } from "@/lib/auth/require-admin-api";
import type { AuditActor } from "./actor-scope";

/**
 * Actor resolution for the audit trail.
 *
 * The hard case is the shared POS device. A cashier operates it through a
 * StaffMember persona established by PIN (src/lib/staff-session.ts) that has no
 * User row of its own — but the browser still carries the owner's better-auth
 * session cookie. Resolving naively from the session alone therefore attributes
 * every cashier action to the owner, which is worse than no attribution: it is
 * a confident, wrong answer that an investigation would act on.
 *
 * So a staff session, when present, always wins over the User session.
 */

/**
 * Stable pseudonymous id for an actor, so the trail can still group "everything
 * this person did" after their account is purged and `actorRefId` is nulled.
 * Salted for the same reason IP hashes are: the id space is small and
 * enumerable, so an unsalted hash would be trivially reversible.
 */
export function hashActorIdentity(kind: string, refId: string | null): string | null {
  if (!refId) return null;
  const salt = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${kind}:${refId}`).digest("hex").slice(0, 32);
}

const SYSTEM_ACTOR: AuditActor = {
  kind: "SYSTEM",
  refId: null,
  displayName: null,
  email: null,
  adminGrantSource: null,
};

/** Actor for a background job. `jobName` becomes the ref so jobs are groupable. */
export function systemActor(jobName: string): AuditActor {
  return { ...SYSTEM_ACTOR, refId: jobName, displayName: jobName };
}

/** Actor for an external provider callback. */
export function webhookActor(provider: string): AuditActor {
  return {
    kind: "WEBHOOK",
    refId: provider,
    displayName: provider,
    email: null,
    adminGrantSource: null,
  };
}

/** Actor for an unauthenticated public request (storefront ordering). */
export function publicActor(): AuditActor {
  return { kind: "PUBLIC", refId: null, displayName: null, email: null, adminGrantSource: null };
}

/**
 * Resolve the acting identity for an authenticated request.
 *
 * `isAdminFlag` comes from the session's user record when the caller already
 * has it; passing it avoids a second query on the hot path. The staff lookup is
 * skipped entirely unless `checkStaff` is set, so ordinary owner requests and
 * POS *reads* pay nothing for a cookie they do not have.
 */
export async function resolveActor(
  session: NonNullable<Session>,
  options: { checkStaff?: boolean; isAdminFlag?: boolean } = {}
): Promise<AuditActor> {
  if (options.checkStaff) {
    try {
      const staff = await getActiveStaffSession();
      if (staff) {
        return {
          kind: "STAFF",
          refId: staff.staffMemberId,
          displayName: staff.name,
          email: null,
          adminGrantSource: null,
        };
      }
    } catch {
      // A failed staff lookup must never break the request it is describing.
      // Falling through to the User actor is the honest degradation: the
      // action still happened and is still recorded, just less precisely.
    }
  }

  return {
    kind: "USER",
    refId: session.user.id,
    displayName: session.user.name ?? null,
    email: session.user.email ?? null,
    adminGrantSource: resolveGrantSource(session.user.email, options.isAdminFlag ?? false),
  };
}
