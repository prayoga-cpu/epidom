import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * Where a brand-new account lands once signup is done: the setup wizard, with
 * a query flag that tells the wizard HOW the visitor got there.
 *
 * - Email signup: the verification link (and every resend of it) points at
 *   `/onboarding?verified=1`. Better Auth signs the user in when they click it
 *   and then redirects to this URL. Without an explicit callbackURL it sends
 *   them to "/" (the marketing homepage), which is where new email signups
 *   used to end up.
 * - Google signup, from the login OR the register page:
 *   `/onboarding?signup=google`. Google signups used to fire no `sign_up`
 *   conversion at all. Both Google buttons pass this as Better Auth's
 *   `newUserCallbackURL`, which it follows only when the OAuth callback just
 *   CREATED the account (returning users get the plain `callbackURL`). The
 *   wizard still checks the account is brand new itself, as a second guard.
 *
 * Caveat for the wizard: Better Auth appends `&error=<CODE>` to the same URL
 * when the link is bad (TOKEN_EXPIRED, INVALID_TOKEN, USER_NOT_FOUND). So
 * `verified=1` only means "came from a verification link". Verification
 * succeeded only when there is no `error` param and there is a session.
 *
 * A safe `?next=` deep link (the store-transfer or staff-invite accept pages,
 * for example) always wins, the same way `safeInternalPath` has always been
 * applied. The one exception is a `next` that IS the wizard (e.g.
 * `/login?callbackUrl=/onboarding`, which is where the wizard sends a
 * signed-out visitor). It keeps its own query and gains the flag, so it lands
 * exactly like the default. For a new Google account a `next` of `/stores` is
 * treated as no deep link too (see googleSignupCallbackURL).
 */

export const ONBOARDING_PATH = "/onboarding";

/** `/onboarding?verified=1`: the user arrived from an email verification link. */
export const VERIFIED_PARAM = "verified";
export const VERIFIED_VALUE = "1";

/** `/onboarding?signup=google`: Google just created this account (login or register page). */
export const SIGNUP_PARAM = "signup";
export const SIGNUP_GOOGLE_VALUE = "google";

export const EMAIL_VERIFIED_LANDING = `${ONBOARDING_PATH}?${VERIFIED_PARAM}=${VERIFIED_VALUE}`;
export const GOOGLE_SIGNUP_LANDING = `${ONBOARDING_PATH}?${SIGNUP_PARAM}=${SIGNUP_GOOGLE_VALUE}`;

/**
 * Adds `key=value` to `path` when `path` is the wizard itself. Any other path
 * comes back exactly as given.
 */
function flagIfOnboarding(path: string, key: string, value: string): string {
  try {
    // The base is only there so a relative path parses. It never appears in
    // the result.
    const url = new URL(path, "http://placeholder.invalid");
    if (url.pathname !== ONBOARDING_PATH) return path;
    url.searchParams.set(key, value);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}

/**
 * The `callbackURL` for an email-verification link: signup, the resend on
 * /verify-email-sent and the resend on the login form's "not verified" notice.
 */
export function emailVerificationCallbackURL(next: string | null | undefined): string {
  const safe = safeInternalPath(next);
  if (!safe) return EMAIL_VERIFIED_LANDING;
  return flagIfOnboarding(safe, VERIFIED_PARAM, VERIFIED_VALUE);
}

/** Default landing for a signed-in visitor with no deep link: the store picker. */
export const STORES_PATH = "/stores";

/**
 * The `newUserCallbackURL` for "Continue with Google" on the login and
 * register pages: where Better Auth sends an account its OAuth callback has
 * just created.
 *
 * A `next` of `/stores` counts as no deep link. It is the generic post-login
 * landing (a visitor bounced off a protected page arrives with
 * `?callbackUrl=/stores`), and a brand-new account has no store, so /stores
 * would hard-navigate it on to /onboarding and drop the flag.
 */
export function googleSignupCallbackURL(next: string | null | undefined): string {
  const safe = safeInternalPath(next);
  if (!safe || pathnameOf(safe) === STORES_PATH) return GOOGLE_SIGNUP_LANDING;
  return flagIfOnboarding(safe, SIGNUP_PARAM, SIGNUP_GOOGLE_VALUE);
}

function pathnameOf(path: string): string | null {
  try {
    return new URL(path, "http://placeholder.invalid").pathname;
  } catch {
    return null;
  }
}
