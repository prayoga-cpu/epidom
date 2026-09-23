export type AuthMode = "login" | "register";

/**
 * Params that must NOT follow the Login <-> Register toggle.
 *
 * - `error`, `registered`: the login form reads them once and strips them from the
 *   URL itself (an OAuth error to toast, the "account created" toast). They describe
 *   something that just happened on this screen, not where the visitor is headed, so
 *   they must not follow the toggle: the toast would fire again on the way back.
 * - `email`: a legacy sign-up prefill (`/register?email=`). The address is personal
 *   data and everything in a URL is sent to analytics as page_location and kept in
 *   history, so it must never be copied onto a second URL. The sign-up form reads it
 *   once and strips it itself; the login form has no use for it.
 */
const DROPPED_PARAMS = ["error", "registered", "email"] as const;

/**
 * Where the Login <-> Register toggle navigates.
 *
 * `/login` and `/register` are two routes, so a toggle that names only the path
 * throws away whatever the visitor arrived with: `?next=` / `?callbackUrl=` from a
 * protected page or a transfer/invite link, campaign params. Everything is carried
 * over except {@link DROPPED_PARAMS}.
 *
 * `search` is anything that prints as a query string (`useSearchParams()`, a
 * `URLSearchParams`, or the raw string), so the caller does not have to convert.
 */
export function authModeHref(mode: AuthMode, search: { toString(): string } | null): string {
  const kept = new URLSearchParams(search?.toString() ?? "");
  for (const key of DROPPED_PARAMS) kept.delete(key);

  const path = mode === "login" ? "/login" : "/register";
  const query = kept.toString();
  return query ? `${path}?${query}` : path;
}
