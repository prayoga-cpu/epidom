/**
 * Single source of truth for deriving Postgres connection strings from the env.
 *
 * Every consumer of DATABASE_URL/DIRECT_URL kept re-deriving the same two things
 * independently, and drifting:
 *
 * 1. `sslmode`. Neon's dashboard hands out URLs ending in `sslmode=require`.
 *    pg-connection-string >= 2.13 (pulled in by pg 8.21 via @prisma/adapter-pg)
 *    emits a one-time `process.emitWarning` for any sslmode other than
 *    `verify-full` — which Next's dev overlay surfaces as a server "Console
 *    Error". More importantly it is a real, scheduled behaviour change: today
 *    `prefer`, `require` and `verify-ca` are all *aliases* for `verify-full`
 *    (certificate AND hostname verified), but in pg-connection-string v3 / pg v9
 *    they adopt libpq semantics, where `require` means "encrypt, but trust any
 *    certificate" — a silent downgrade to a MITM-able connection. Rewriting them
 *    to `verify-full` is a no-op today and preserves the current guarantees then.
 *
 * 2. Pooled vs direct endpoint. Migrations and bulk COPY must not run through
 *    Neon's `-pooler` (pgBouncer) host: the session-level advisory lock leaks
 *    onto a recycled backend and permanently blocks every later `migrate deploy`
 *    with a P1002 timeout.
 *
 * Deliberately dependency-free so `prisma.config.ts` — loaded by the Prisma CLI,
 * outside the Next/tsconfig-path world — can import it relatively.
 */

/** SSL modes pg-connection-string currently aliases to `verify-full` and warns about. */
const DEPRECATED_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Rewrite a deprecated `sslmode` to the explicit `verify-full` it is currently an
 * alias for. Operates on the query substring only — reconstructing the URL via
 * `new URL()` would re-encode the userinfo and can corrupt passwords.
 *
 * Left untouched when there is no query string, no `sslmode`, the mode is already
 * explicit, or the caller opted into libpq semantics with `uselibpqcompat=true`
 * (in which case `require` means something different on purpose).
 */
export function normalizeSslMode(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;

  const query = url.slice(queryStart + 1);
  if (/(^|&)uselibpqcompat=true(&|$)/i.test(query)) return url;

  const rewritten = query.replace(/(^|&)(sslmode=)([^&]*)/gi, (match, sep, key, value) =>
    DEPRECATED_SSL_MODES.has(value.toLowerCase()) ? `${sep}${key}verify-full` : match
  );

  return rewritten === query ? url : url.slice(0, queryStart + 1) + rewritten;
}

/** Drop Neon's `-pooler` host suffix to reach the direct (non-pgBouncer) endpoint. */
export function toDirectEndpoint(url: string): string {
  return url.includes("-pooler") ? url.replace("-pooler", "") : url;
}

/**
 * The pooled, runtime connection string — what the app's PrismaClient should use.
 * Returns `undefined` rather than throwing when unset, so callers keep whatever
 * missing-env behaviour they already had.
 */
export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  return url ? normalizeSslMode(url) : undefined;
}

/**
 * The direct (non-pooled) connection string, for migrations and bulk COPY.
 * Prefers DIRECT_URL, otherwise derives the direct endpoint from a pooled
 * DATABASE_URL — so this stays correct even where DIRECT_URL is unset.
 */
export function directDatabaseUrl(): string | undefined {
  const direct = process.env.DIRECT_URL;
  if (direct) return normalizeSslMode(direct);

  const url = process.env.DATABASE_URL;
  return url ? normalizeSslMode(toDirectEndpoint(url)) : undefined;
}

/**
 * Host + database name of a connection string, used to compare two URLs for
 * "same database" without being fooled by differing credentials, query-param
 * order or sslmode spelling. Returns `null` when the string isn't a parseable URL.
 */
export function databaseIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}
