// How email signup hands the address it just registered over to
// /verify-email-sent (which shows it and resends the link to it) WITHOUT
// putting it in the URL. The (auth) layout mounts the consented analytics, and
// GA4 and the Meta Pixel record the full page URL as page_location, so a
// `?email=` there sends a personal address to Google and Meta. sessionStorage
// is same-origin, per-tab and never leaves the browser.
//
// The page still accepts a legacy `?email=` (links already in history or
// bookmarks), stashes it here and strips it from the address bar.

export const VERIFY_EMAIL_STORAGE_KEY = "epidom:verify-email-address";

/**
 * Leaves `email` for /verify-email-sent. Returns false when storage is missing
 * or throws (blocked site data, a full quota), so the caller can fall back.
 */
export function stashVerifyEmail(email: string): boolean {
  try {
    window.sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, email);
    return true;
  } catch {
    return false;
  }
}

/**
 * The address {@link stashVerifyEmail} left, or null. It is NOT removed: the
 * page must survive a reload, and the visitor may press "resend" more than
 * once. The value is unvalidated (anything on the origin can write storage);
 * React escapes it on display and the resend endpoint validates it.
 */
export function readStashedVerifyEmail(): string | null {
  try {
    return window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}
