import { isResumableAppPath } from "@/lib/last-visited";

/**
 * The pages visited most recently in each store, on this device — the data
 * behind Home's "Recently visited" row (src/features/dashboard/home).
 *
 * Device-local by design, like the last-visited cookies it rides along with
 * (LastVisitedTracker writes both): it answers "where was I on this screen",
 * not "what did my team look at". Kept per store so switching stores never
 * shows another store's pages, and kept by section (no query string) so ten
 * visits to the same page with different filters are one card, not ten.
 *
 * Every read and write tolerates blocked or full storage: the row simply
 * stays empty.
 */

const KEY_PREFIX = "epidom:recentVisits:";

/** Cards on Home; anything older drops off the end. */
export const RECENT_VISITS_MAX = 8;

/** Fired on window after a write, so a mounted Home can refresh without a reload. */
export const RECENT_VISITS_EVENT = "epidom:recent-visits";

/** Sections that are never listed: Home itself shows the list. */
const NEVER_LISTED = new Set(["/home"]);

export interface RecentVisit {
  /** Store-relative section, e.g. "/finance" or "/pos/orders". */
  section: string;
  /** Epoch milliseconds of the latest visit. */
  at: number;
}

export function recentVisitsKey(storeId: string): string {
  return `${KEY_PREFIX}${storeId}`;
}

/** `{ storeId, section }` for a resumable in-store page, or null for anything else. */
export function storeSectionFromPath(url: string): { storeId: string; section: string } | null {
  if (!isResumableAppPath(url)) return null;
  const segments = url.split(/[?#]/)[0].split("/").filter(Boolean);
  if (segments[0] !== "store" || segments.length < 3) return null;
  return { storeId: segments[1], section: `/${segments.slice(2).join("/")}` };
}

function isRecentVisit(value: unknown): value is RecentVisit {
  if (!value || typeof value !== "object") return false;
  const visit = value as Record<string, unknown>;
  return (
    typeof visit.section === "string" &&
    visit.section.startsWith("/") &&
    typeof visit.at === "number" &&
    Number.isFinite(visit.at)
  );
}

/** Newest first. Malformed entries (a hand-edited key, an older shape) are dropped. */
export function readRecentVisits(storeId: string): RecentVisit[] {
  try {
    const raw = localStorage.getItem(recentVisitsKey(storeId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentVisit).slice(0, RECENT_VISITS_MAX);
  } catch {
    return [];
  }
}

/** Moves `url`'s section to the front of its store's list. No-op for pages that aren't listed. */
export function recordRecentVisit(url: string, now: number = Date.now()): void {
  const target = storeSectionFromPath(url);
  if (!target || NEVER_LISTED.has(target.section)) return;
  const next: RecentVisit[] = [
    { section: target.section, at: now },
    ...readRecentVisits(target.storeId).filter((visit) => visit.section !== target.section),
  ].slice(0, RECENT_VISITS_MAX);
  try {
    localStorage.setItem(recentVisitsKey(target.storeId), JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_VISITS_EVENT));
  } catch {
    // Blocked or full storage: Home just shows fewer cards.
  }
}
