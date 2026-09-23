/**
 * Shared shape for a pending store-ownership transfer invite, stored as a
 * row in the shared `Verification` table (no dedicated model — same
 * approach as the Owner PIN reset OTP, see
 * src/app/api/user/owner-pin/request-otp/route.ts).
 *
 * Keyed by TOKEN, not storeId: the accept flow only ever has the token and
 * must resolve it to a store with a single exact-match lookup — an
 * authorization-relevant lookup has no business depending on a `contains`
 * scan over JSON text. The owner-side route knows storeId instead, and finds
 * (to replace/cancel/report) a store's pending transfer with a scan.
 *
 * The token is a bearer secret. It is only ever sent in a POST body (never a
 * URL path or query): the audit trail records request pathnames
 * (src/lib/audit/request-meta.ts) and platform logs record full URLs.
 */
import { randomBytes } from "crypto";

export const TRANSFER_IDENTIFIER_PREFIX = "store-transfer:";
export const TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoreTransferValue {
  storeId: string;
  toEmail: string;
  fromUserId: string;
  storeName: string;
}

export function generateTransferToken(): string {
  return randomBytes(32).toString("hex");
}

export function transferIdentifier(token: string): string {
  return `${TRANSFER_IDENTIFIER_PREFIX}${token}`;
}

export function parseTransferValue(raw: string): StoreTransferValue | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.storeId === "string" &&
      typeof parsed.toEmail === "string" &&
      typeof parsed.fromUserId === "string" &&
      typeof parsed.storeName === "string"
    ) {
      return {
        storeId: parsed.storeId,
        toEmail: parsed.toEmail,
        fromUserId: parsed.fromUserId,
        storeName: parsed.storeName,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Path the emailed link points at (token in the query — it has to be, it's a
 * link a human clicks — but every API call afterwards carries it in a body). */
export function buildAcceptUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/transfer-ownership/accept?token=${token}`;
}
