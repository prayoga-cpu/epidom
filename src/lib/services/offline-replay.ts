/**
 * How far a till's clock may run ahead of or behind the server's and still be
 * believed. Tablets drift, and one left offline for a while drifts more.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The oldest an offline sale may claim to be. A till can genuinely sit offline
 * for days (a market stall, a power cut), but a time weeks back is far likelier
 * a dead clock battery than a real sale, and would quietly rewrite a month that
 * may already have been reported.
 */
export const MAX_OFFLINE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Is this request a sale replayed from a till's offline queue — one the
 * customer has ALREADY paid for, so nothing may refuse it over a coupon, a
 * customer or an item switched off since (see buildPosSettlement's `tolerant`)?
 *
 * The live checkout sends a clientRequestId too (an idempotency key, so a
 * timed-out request can fall back to the queue without doubling), and marks
 * itself with `liveCheckout`. Keying on that mark — not on clientCreatedAt —
 * keeps a till that is still running the previous release lenient: its queued
 * sales carry a clientRequestId and nothing else, and refusing one five times
 * makes that old client delete a sale that was paid for.
 */
export function isOfflineReplay(input: {
  clientRequestId?: string;
  clientCreatedAt?: string;
  liveCheckout?: boolean;
}): boolean {
  if (!input.clientRequestId) return false;
  return !!input.clientCreatedAt || !input.liveCheckout;
}

/**
 * When a replayed offline sale happened, by the till's clock — or `null` to
 * record it at the server's `now` as before.
 *
 * Only for a real replay (`clientRequestId` present): an online checkout is
 * stamped by the server, full stop. A time slightly in the future is clock
 * drift and becomes `now`; anything outside the window is distrusted entirely.
 */
export function resolveOfflineOccurredAt(
  input: { clientRequestId?: string; clientCreatedAt?: string },
  now: Date = new Date()
): Date | null {
  if (!input.clientRequestId || !input.clientCreatedAt) return null;
  const at = new Date(input.clientCreatedAt);
  const t = at.getTime();
  if (Number.isNaN(t)) return null;
  const nowMs = now.getTime();
  if (t > nowMs + CLOCK_SKEW_TOLERANCE_MS) return null;
  if (t < nowMs - MAX_OFFLINE_AGE_MS) return null;
  return t > nowMs ? now : at;
}
