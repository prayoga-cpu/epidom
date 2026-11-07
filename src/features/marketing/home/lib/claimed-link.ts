import { isValidStoreSlug } from "@/features/onboarding/lib/store-link";

/**
 * The store link a visitor claimed in the home page's search ("epidom.fr/@x is
 * free: create my store with this link"), handed to the setup wizard so the
 * store is created with it.
 *
 * localStorage, not sessionStorage: sign-up sends a verification email, and its
 * link opens a new tab, which would not see this tab's session storage. It
 * expires after two days and is read once. Storage can be missing or throw
 * (private mode, blocked site data); the hand-over is a convenience, so a
 * failure is ignored and the wizard proposes a link from the store's name as
 * before.
 *
 * Read side: `takeClaimedLink()`, for the wizard's store step. It must still
 * check the link is free when the store is saved (someone may have taken it
 * since), as it does for an Instagram-derived link.
 */
export const CLAIMED_LINK_STORAGE_KEY = "epidom:claimed-link";
const TTL_MS = 2 * 24 * 60 * 60 * 1000;

export function stashClaimedLink(slug: string, now: number = Date.now()): void {
  if (!isValidStoreSlug(slug)) return;
  try {
    window.localStorage.setItem(CLAIMED_LINK_STORAGE_KEY, JSON.stringify({ slug, at: now }));
  } catch {
    // Nothing to do: the wizard proposes a link from the name instead.
  }
}

/** The claimed link, or null (none, expired, or not a valid link). Removes it either way. */
export function takeClaimedLink(now: number = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CLAIMED_LINK_STORAGE_KEY);
    window.localStorage.removeItem(CLAIMED_LINK_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const { slug, at } = JSON.parse(raw) as { slug?: unknown; at?: unknown };
    if (typeof slug !== "string" || typeof at !== "number") return null;
    if (now - at > TTL_MS || now < at) return null;
    return isValidStoreSlug(slug) ? slug : null;
  } catch {
    return null;
  }
}
