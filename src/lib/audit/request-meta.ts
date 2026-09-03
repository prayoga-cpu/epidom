import { createHash, randomUUID } from "crypto";
import type { AuditRequestMeta } from "./actor-scope";

/**
 * Request metadata reader for the audit trail.
 *
 * Replaces the copy-pasted `x-real-ip` / `x-forwarded-for` pair that several
 * routes hand-rolled, and adds the hashing the raw pattern lacked.
 */

/**
 * Client IP from the proxy headers Vercel sets.
 *
 * `x-forwarded-for` is a comma-separated chain; the left-most entry is the
 * original client. Everything to its right was appended by intermediaries and
 * is not the caller.
 */
export function readClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/**
 * Salted SHA-256 of an IP, truncated to 32 hex chars.
 *
 * Storing raw addresses would put personal data (GDPR Art. 4) in a table
 * designed to outlive the account it describes. A hash still answers the
 * question the trail needs — "were these actions from the same origin?" —
 * without retaining the identifier itself.
 *
 * The salt is `BETTER_AUTH_SECRET`, so hashes are stable across deploys but
 * cannot be reversed by anyone without it. Without a salt, the IPv4 space is
 * small enough to brute-force a rainbow table in seconds, which would make the
 * hash decorative.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Truncated so a hostile client cannot pad the trail with a huge header. */
const MAX_USER_AGENT = 512;

export function readUserAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  if (!ua) return null;
  return ua.length > MAX_USER_AGENT ? ua.slice(0, MAX_USER_AGENT) : ua;
}

/**
 * Route pathname with the query string removed.
 *
 * Query strings carry search terms, filters and occasionally tokens; none of
 * that belongs in a long-lived table. The pathname alone identifies the
 * endpoint, which is what the trail groups by.
 */
export function readRoute(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

/**
 * Build request metadata for an incoming request.
 *
 * The request id is generated here rather than read from `x-request-id`:
 * `src/proxy.ts` sets that header on the *response* for `/api/*` and returns
 * early, so it is never visible to a route handler.
 */
export function buildRequestMeta(request: Request): AuditRequestMeta {
  const headers = request.headers;
  return {
    requestId: randomUUID(),
    method: request.method,
    route: readRoute(request.url),
    ipHash: hashIp(readClientIp(headers)),
    userAgent: readUserAgent(headers),
    startedAt: Date.now(),
  };
}
