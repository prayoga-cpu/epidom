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
export function servingAppUrl(): string {
  const base = configured();
  return base === "https://epidom.fr" ? "https://www.epidom.fr" : base;
}
