/**
 * The app's own URL, in the two forms the server needs.
 *
 * NEXT_PUBLIC_APP_URL is the configured address. In production it is the apex
 * (https://epidom.fr), which Vercel answers with a 308 redirect to
 * https://www.epidom.fr. Browsers follow that hop without trouble, but some
 * clients don't: a mail app's one-click unsubscribe POST, and an OAuth client
 * such as Claude, which drops the Authorization header on a cross-host
 * redirect and checks that the issuer it was told about is the one it reached.
 * Those get servingAppUrl(), the host that answers directly.
 */

function configured(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** NEXT_PUBLIC_APP_URL without a trailing slash (localhost when unset). */
export function configuredAppUrl(): string {
  return configured();
}

/**
 * The host that serves the app without a redirect: www.epidom.fr when the
 * configured URL is the apex, any other host (localhost, dev.epidom.fr, a
 * preview) as it is.
 */
function serving(base: string): string {
  return base === "https://epidom.fr" ? "https://www.epidom.fr" : base;
}

export function servingAppUrl(): string {
  return serving(configured());
}

/**
 * Better Auth's base URL: BETTER_AUTH_URL when it is set (an explicit override,
 * trailing slashes stripped), otherwise NEXT_PUBLIC_APP_URL, served the same way
 * as servingAppUrl(), so an apex value still advertises the OAuth issuer on www.
 * The Google callback does not follow this: it stays pinned to configuredAppUrl()
 * in auth.ts, the one registered on the Google client.
 */
export function authBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  return serving(explicit || configured());
}
