import { randomBytes } from "crypto";

/** How long an invite link stays claimable. Re-issuing invalidates older ones. */
export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 32 bytes of CSPRNG randomness, base64url — same construction as
 * StaffSession.token (src/lib/staff-session.ts) and better-auth's own
 * Session.token. This string IS the bearer secret for claiming a staff
 * account, so it must never be derived from (or fall back to) anything
 * guessable such as a cuid or a counter.
 */
export function generateStaffInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Absolute claim URL for the emailed link. The token rides in the query string
 * (not the path) so it never lands in the route recorded by the audit log, and
 * the claim page sends no Referer. It is [A-Za-z0-9_-] only.
 */
export function buildStaffInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/staff-invite?token=${token}`;
}

/**
 * "jane.doe@example.com" -> "j***@example.com". Shown on the public claim
 * page and in mismatch errors so the person opening a link can confirm it's
 * meant for their mailbox without the page becoming a way to read an
 * arbitrary staff member's full email off a leaked or guessed link.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

/** Claim tokens are compared case-sensitively; emails are not. */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Why a token can't be claimed — distinct copy on the public page for each. */
export type StaffInviteState = "valid" | "expired" | "consumed" | "not_found";

export function staffInviteState(
  invite: { expiresAt: Date; consumedAt: Date | null } | null,
  now: Date = new Date()
): StaffInviteState {
  if (!invite) return "not_found";
  if (invite.consumedAt) return "consumed";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
