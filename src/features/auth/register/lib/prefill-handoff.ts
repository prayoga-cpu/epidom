// How the closing CTA on the home, services and pricing pages hands the address
// the visitor typed over to the sign-up form WITHOUT putting it in the URL.
// Anything in a URL is sent to analytics as page_location (GA4 and the Meta Pixel,
// for visitors who consented), lands in browser history and in server logs, so a
// personal address must not ride there. sessionStorage is same-origin, per-tab and
// never leaves the browser.
//
// This file deliberately imports nothing (no zod, no react): the marketing bundle
// pulls it in for the write side. The read side validates with parsePrefillEmail.

export const PREFILL_EMAIL_STORAGE_KEY = "epidom:signup-prefill-email";

/**
 * Leaves `email` for the sign-up form to pick up on the next page. Storage can be
 * missing or throw (private mode, blocked site data, a full quota); the hand-over
 * is a convenience, so a failure is ignored and the visitor just retypes the address.
 */
export function stashPrefillEmail(email: string): void {
  try {
    window.sessionStorage.setItem(PREFILL_EMAIL_STORAGE_KEY, email);
  } catch {
    // Nothing to do: the sign-up form simply opens blank.
  }
}

/**
 * Returns whatever {@link stashPrefillEmail} left, or null, and removes it, so it is
 * read once. The value is UNVALIDATED (anything on the origin can write to storage):
 * run it through parsePrefillEmail before it reaches a field.
 */
export function takeStashedPrefillEmail(): string | null {
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
  try {
    window.sessionStorage.removeItem(PREFILL_EMAIL_STORAGE_KEY);
  } catch {
    // Read succeeded; a failed removal just means the entry lives until the tab closes.
  }
  return value;
}
