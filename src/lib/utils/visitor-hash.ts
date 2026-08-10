import { createHash } from "crypto";

/**
 * Anonymous, daily-rotating visitor fingerprint for storefront analytics.
 * Never stores the raw IP — only this hash is persisted. Rotating by UTC day
 * means the same visitor gets a new hash tomorrow, trading a perfectly
 * precise lifetime-unique count for not needing a cookie/consent flow, in
 * the same spirit as privacy-first analytics tools (Plausible, Fathom).
 * "Unique visitors" over a multi-day range is therefore a sum of
 * daily-uniques (a DAU-style approximation), not a true range-unique count.
 */
export function hashVisitor(ip: string, userAgent: string, salt: string): string {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return createHash("sha256")
    .update(`${ip}:${userAgent}:${dateKey}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}
