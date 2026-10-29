/**
 * The sign-in hop of the Claude connector's OAuth flow.
 *
 * When Claude starts sign-in and the visitor has no Epidom session, the OAuth
 * provider sends them to OAUTH_SIGN_IN_PAGE with the authorize request,
 * signed. That page needs a session (the proxy sends a signed-out visitor to
 * /login?callbackUrl=…, and every way of signing in — email, Google, a
 * verification link — returns there), then restarts the authorize request.
 * The provider checks the client, redirect URI and PKCE again on that
 * request, so nothing here is trusted.
 */

/** Parameters the provider adds when it signs the query; not authorize's own. */
const SIGNATURE_PARAMS = ["sig", "exp", "ba_iat", "ba_pl", "ba_param"];

/**
 * Prompts that sent the visitor to sign in. They are satisfied by the time
 * this runs; asking for them again would loop back here.
 */
const SATISFIED_PROMPTS = new Set(["login", "create"]);

/** The authorize URL (a path) to resume with, from the sign-in page's query. */
export function resumeAuthorizePath(query: URLSearchParams): string {
  const params = new URLSearchParams(query);
  for (const name of SIGNATURE_PARAMS) params.delete(name);

  const prompt = params.get("prompt");
  if (prompt !== null) {
    const remaining = prompt.split(" ").filter((value) => value && !SATISFIED_PROMPTS.has(value));
    if (remaining.length > 0) params.set("prompt", remaining.join(" "));
    else params.delete("prompt");
  }

  return `/api/auth/oauth2/authorize?${params.toString()}`;
}

/** The redirect URI's host, which the consent screen must show (MCP spec). */
export function redirectHost(redirectUri: string | null | undefined): string | null {
  if (!redirectUri) return null;
  try {
    return new URL(redirectUri).host;
  } catch {
    return null;
  }
}
