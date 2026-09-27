import {
  EMPTY_GUIDE_STATE,
  PAGE_INTRO_IDS,
  type GuideState,
  type GuideStatePatch,
  type PageIntroId,
} from "@/lib/guide/contracts";

/**
 * Pure GuideState helpers, shared by the server (guide.service.ts, which stores
 * the result) and the client (useGuideState, which applies the same change
 * optimistically) — so the card a tap hides is exactly the card the server
 * records as hidden. Client-safe: no Prisma, no server imports.
 */

/** No list in the stored state grows past this; the oldest entries go first. */
export const GUIDE_STATE_LIST_CAP = 100;

/** Same bound guideStatePatchSchema puts on a store id. */
const MAX_STORE_ID_LENGTH = 64;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Order-preserving dedupe, then keep the newest GUIDE_STATE_LIST_CAP (appends go last). */
function dedupeAndCap<T>(values: T[]): T[] {
  const unique = Array.from(new Set(values));
  return unique.length > GUIDE_STATE_LIST_CAP ? unique.slice(-GUIDE_STATE_LIST_CAP) : unique;
}

function isPageIntroId(value: unknown): value is PageIntroId {
  return typeof value === "string" && (PAGE_INTRO_IDS as readonly string[]).includes(value);
}

function isStoreId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STORE_ID_LENGTH;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** A fresh copy of EMPTY_GUIDE_STATE (its arrays are never shared). */
export function emptyGuideState(): GuideState {
  return { ...EMPTY_GUIDE_STATE, dismissedTips: [], dismissedChecklists: [] };
}

/**
 * Whatever is stored in User.guideState, as a valid GuideState: unknown keys
 * dropped, invalid entries filtered out, lists deduped and capped at
 * GUIDE_STATE_LIST_CAP. Never throws. Always returns fresh arrays.
 */
export function parseGuideState(json: unknown): GuideState {
  if (!isPlainObject(json)) return emptyGuideState();

  const tips = Array.isArray(json.dismissedTips) ? json.dismissedTips.filter(isPageIntroId) : [];
  const checklists = Array.isArray(json.dismissedChecklists)
    ? json.dismissedChecklists.filter(isStoreId)
    : [];

  return {
    tourSeenAt: parseTimestamp(json.tourSeenAt),
    dismissedTips: dedupeAndCap(tips),
    dismissedChecklists: dedupeAndCap(checklists),
  };
}

/**
 * A patch applied to a state. Never mutates its input. Order when several keys
 * are sent together: resetTour before tourSeen, restoreTips before dismissTip,
 * restoreChecklist before dismissChecklist — so "reset and mark seen" ends seen
 * and "restore all, then dismiss X" ends with just X.
 */
export function applyPatchToState(
  state: GuideState,
  patch: GuideStatePatch,
  now: Date = new Date()
): GuideState {
  let { tourSeenAt, dismissedTips, dismissedChecklists } = state;

  if (patch.resetTour) tourSeenAt = null;
  if (patch.tourSeen) tourSeenAt = now.toISOString();

  if (patch.restoreTips) dismissedTips = [];
  if (patch.dismissTip) dismissedTips = dedupeAndCap([...dismissedTips, patch.dismissTip]);

  if (patch.restoreChecklist) {
    dismissedChecklists = dismissedChecklists.filter((id) => id !== patch.restoreChecklist);
  }
  if (patch.dismissChecklist) {
    dismissedChecklists = dedupeAndCap([
      // Re-dismissing moves the id to the end, so the cap drops truly old ones.
      ...dismissedChecklists.filter((id) => id !== patch.dismissChecklist),
      patch.dismissChecklist,
    ]);
  }

  return {
    tourSeenAt,
    dismissedTips: [...dismissedTips],
    dismissedChecklists: [...dismissedChecklists],
  };
}
