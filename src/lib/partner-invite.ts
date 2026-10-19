/**
 * A pending invitation to become a referral partner, for someone with no
 * Epidom account yet: a row in the shared `Verification` table (same scheme
 * as store-ownership transfers, src/lib/store-transfer.ts), keyed by token.
 * The Partner row already exists with `userId` null and `inviteEmail` set;
 * accepting links it to the account that signed up with that address.
 *
 * The token is a bearer secret: it only travels in the emailed link and then
 * in POST bodies (/api/partner-invite/lookup, /accept), never in an API path.
 */
import { randomBytes } from "crypto";

export const PARTNER_INVITE_PREFIX = "partner-invite:";
/** Two weeks: long enough to get round to signing up. A new invite replaces the old one. */
export const PARTNER_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface PartnerInviteValue {
  partnerId: string;
  email: string;
}

export function generatePartnerInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function partnerInviteIdentifier(token: string): string {
  return `${PARTNER_INVITE_PREFIX}${token}`;
}

export function parsePartnerInviteValue(raw: string): PartnerInviteValue | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.partnerId === "string" && typeof parsed.email === "string"
      ? { partnerId: parsed.partnerId, email: parsed.email }
      : null;
  } catch {
    return null;
  }
}

/** The emailed link (the page then POSTs the token). */
export function buildPartnerInviteUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/partner-invite?token=${token}`;
}
