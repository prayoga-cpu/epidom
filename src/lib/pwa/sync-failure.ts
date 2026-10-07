import { ApiClientError } from "@/lib/api/client";

/**
 * Why replaying one queued offline write failed, which decides what happens to
 * the entry:
 *
 *  - `transient` — no connection, a timeout, a captive portal, a 5xx, a rate
 *    limit. Says nothing about the entry itself. It stays queued with its
 *    attempt count untouched, and the rest of this pass is skipped: the next
 *    entry would only hit the same wall.
 *  - `auth` — 401. The device's sign-in expired while it was offline (a Better
 *    Auth session lasts about a week). Also not the entry's fault: it waits for
 *    someone to sign in again.
 *  - `rejected` — any other 4xx: the server read the entry and refused it. Only
 *    these count toward parking the entry for a person to look at.
 *
 * Before this split every failure counted, and the fifth one deleted the entry:
 * a till that reconnected five times on flaky wifi, or came back after a week
 * with an expired session, silently threw away sales it had already taken money
 * for.
 */
export type SyncFailureKind = "transient" | "auth" | "rejected";

export function classifySyncFailure(error: unknown): SyncFailureKind {
  if (!(error instanceof ApiClientError)) return "transient";
  if (error.status === 401) return "auth";
  if (error.status === 408 || error.status === 429 || error.status >= 500) return "transient";
  return "rejected";
}

/**
 * Rejections an entry may collect before it's parked as needing attention.
 * Parked entries stay on the device — never deleted without a person choosing
 * to — and are no longer replayed automatically.
 */
export const MAX_REJECTED_ATTEMPTS = 5;

/** What the Offline & Sync panel shows for a parked entry. */
export interface SyncFailureRecord {
  /** HTTP status when the server answered, null otherwise. */
  status: number | null;
  message: string;
  at: string;
}

export function describeSyncFailure(error: unknown): SyncFailureRecord {
  return {
    status: error instanceof ApiClientError ? error.status : null,
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  };
}
