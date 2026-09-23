/**
 * Better Auth cookie naming and scope, shared by `src/lib/auth.ts` and
 * `src/proxy.ts` so the two can never disagree about which cookie is "the
 * session".
 *
 * Deliberately import-free: the proxy loads this, and it must not drag in
 * Prisma or Better Auth.
 *
 * Why this exists: `dev.epidom.fr` is a Vercel *preview* that shares the
 * registrable domain with production. Production's session cookie is scoped to
 * `.epidom.fr`, so the browser also sends it to the preview, under the very
 * name the preview reads. Both apps then see each other's cookie — the preview
 * even accepts it, because its database is a nightly clone of production's.
 * Better Auth's own handler takes the FIRST same-named cookie while Next's
 * `cookies()` takes the LAST, so the two disagree and a login "succeeds" while
 * the app still looks signed out.
 *
 * The fix is two independent layers, both inert on production:
 *  - previews use their own cookie prefix, so names never collide;
 *  - only the apex and its www alias may write a `.domain` cookie, so a preview
 *    on a sibling subdomain stays host-only.
 */

/** Better Auth's built-in prefix. Production and local keep it — renaming it would sign every user out. */
const DEFAULT_AUTH_COOKIE_PREFIX = "better-auth";

/** Prefix used by Vercel Preview deployments only. */
const PREVIEW_AUTH_COOKIE_PREFIX = "epidom-preview";

/**
 * The cookie prefix to hand Better Auth, or `undefined` to leave its default
 * in place. Returning `undefined` (rather than the default string) on
 * production keeps the production auth config byte-identical to what it was
 * before this module existed.
 */
export function previewAuthCookiePrefix(vercelEnv: string | undefined): string | undefined {
  return vercelEnv === "preview" ? PREVIEW_AUTH_COOKIE_PREFIX : undefined;
}

/**
 * The two names Better Auth may store the session token under: plain, and with
 * the `__Secure-` prefix it adds when `useSecureCookies` is on (every
 * production build, including previews).
 */
export function sessionCookieNames(vercelEnv: string | undefined): readonly [string, string] {
  const name = `${previewAuthCookiePrefix(vercelEnv) ?? DEFAULT_AUTH_COOKIE_PREFIX}.session_token`;
  return [name, `__Secure-${name}`];
}

/**
 * Cross-subdomain cookie scope for Better Auth, or `undefined` for host-only
 * cookies.
 *
 * Shared between the apex and its `www` alias only — that is the OAuth
 * www <-> apex hop this exists for (it otherwise drops the state cookie and
 * fails with `state_mismatch`). Any other subdomain of the same registrable
 * domain (`dev.`, `staging.`, ...) stays host-only, so it can never write,
 * overwrite or expire the production apex's cookie of the same name.
 *
 * Skipped for localhost and `*.vercel.app`, where a custom cookie domain would
 * break cookies entirely.
 */
export function resolveCrossSubDomainCookies(
  appUrl: string | undefined,
  nodeEnv: string | undefined
): { enabled: boolean; domain: string } | undefined {
  if (nodeEnv !== "production") return undefined;
  try {
    const host = new URL(appUrl || "").hostname;
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return undefined;
    const parts = host.split(".");
    const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
    if (host !== root && host !== `www.${root}`) return undefined;
    return { enabled: true, domain: `.${root}` };
  } catch {
    return undefined;
  }
}
