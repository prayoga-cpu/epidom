/**
 * Device-level UI zoom — the in-app equivalent of the browser's Ctrl +/−,
 * exposed as a stepper in the account dropdown (`zoom-control.tsx`).
 *
 * Why the app can't just leave this to the browser: the root layout locks the
 * viewport (`userScalable: false`, `maximumScale: 1` in `src/app/layout.tsx`)
 * so pinch-zoom does nothing on a POS tablet, and an installed PWA has no
 * browser chrome to reach a zoom menu from. Cashiers on a small counter
 * screen need to fit more of the order queue on screen; the same control at
 * 125/150% is the accessibility direction for a shared kitchen display.
 *
 * Implemented as CSS `zoom` on <html> rather than a `transform: scale()`
 * wrapper: zoom scales the initial containing block, so fixed chrome (the
 * topbar, the mobile nav) and portalled overlays (dialogs, dropdowns — which
 * mount on <body>, not inside the page tree) keep their geometry. A transform
 * wrapper would leave all of those pinned to the unscaled viewport.
 *
 * The preference is per-device (localStorage, not the user record) because
 * that is what it describes — a screen, not an account. A shared POS tablet
 * keeps its zoom across every persona that signs in on it.
 */

/** localStorage key. Read by the boot script below before first paint. */
export const ZOOM_STORAGE_KEY = "epidom:ui-zoom";

/** Percentages the stepper walks through, mirroring the browser's own ladder. */
export const ZOOM_LEVELS = [70, 80, 90, 100, 110, 125, 150] as const;

export const DEFAULT_ZOOM = 100;

const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/**
 * Fired on `window` after a change. The topbar mounts `<NavUser>` twice (the
 * desktop bar and the mobile one), so a control instance can't own the state
 * alone — both subscribe to this and re-read the stored value.
 */
export const ZOOM_CHANGE_EVENT = "epidom:ui-zoom-change";

/**
 * Snaps any value to a real level, so a hand-edited storage entry — or one
 * written by an older build with a different ladder — can't leave the UI at
 * an unreachable zoom the stepper has no way back from.
 */
export function normalizeZoom(value: unknown): number {
  // Only numbers and non-blank numeric strings are candidates — `Number(null)`
  // and `Number("")` are both 0, which would otherwise clamp to the minimum
  // and silently shrink the UI on a missing/blank entry.
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_ZOOM;
  if (n <= MIN_ZOOM) return MIN_ZOOM;
  if (n >= MAX_ZOOM) return MAX_ZOOM;
  return ZOOM_LEVELS.reduce((best, level) =>
    Math.abs(level - n) < Math.abs(best - n) ? level : best
  );
}

export function readStoredZoom(): number {
  if (typeof window === "undefined") return DEFAULT_ZOOM;
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw === null) return DEFAULT_ZOOM;
    return normalizeZoom(raw);
  } catch {
    // Blocked/unavailable storage (Safari private mode, kiosk lockdowns) —
    // the app still works, it just doesn't remember the zoom.
    return DEFAULT_ZOOM;
  }
}

/** Applies a zoom to the document. Idempotent — safe to call on every mount. */
export function applyZoom(zoom: number): void {
  if (typeof document === "undefined") return;
  const normalized = normalizeZoom(zoom);
  const root = document.documentElement;
  // Clear rather than write `zoom: 1` at the default, so the untouched case
  // leaves no inline style behind at all. Assigning "" rather than calling
  // removeProperty("zoom"): `zoom` reaches the CSSOM through its named setter,
  // and removeProperty() doesn't see it there under jsdom.
  if (normalized === DEFAULT_ZOOM) root.style.zoom = "";
  else root.style.zoom = String(normalized / 100);
}

/**
 * Persists, applies, and broadcasts in one call. Returns the value actually
 * used after normalization.
 */
export function setStoredZoom(zoom: number): number {
  const normalized = normalizeZoom(zoom);
  applyZoom(normalized);
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(normalized));
  } catch {
    // Persistence is best-effort — the zoom still applies for this session.
  }
  window.dispatchEvent(new CustomEvent(ZOOM_CHANGE_EVENT, { detail: normalized }));
  return normalized;
}

/** Next level up (`+1`) or down (`-1`), clamped at the ends of the ladder. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_LEVELS.indexOf(normalizeZoom(current) as (typeof ZOOM_LEVELS)[number]);
  const next = index + direction;
  if (next < 0 || next >= ZOOM_LEVELS.length) return ZOOM_LEVELS[index];
  return ZOOM_LEVELS[next];
}

export function canStepZoom(current: number, direction: 1 | -1): boolean {
  const normalized = normalizeZoom(current);
  return direction === 1 ? normalized < MAX_ZOOM : normalized > MIN_ZOOM;
}

/**
 * Subscribes to changes from this tab (custom event) and from other tabs
 * (`storage`) — an owner with the dashboard open in two tabs gets one
 * consistent zoom rather than two.
 */
export function subscribeZoom(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ZOOM_STORAGE_KEY) return;
    applyZoom(readStoredZoom());
    onChange();
  };
  window.addEventListener(ZOOM_CHANGE_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(ZOOM_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Inline script for the document head. Applies the saved zoom before first
 * paint — without it the page renders at 100% and visibly snaps once React
 * hydrates, which on a 70% preference is a large jump. Same trick
 * `next-themes` uses to avoid a theme flash.
 *
 * Kept in this module (rather than pasted into the layout) so it can't drift
 * from the storage key and bounds above. NaN fails every comparison, so a
 * garbage entry falls through to the default.
 */
export const ZOOM_BOOT_SCRIPT = `try{var z=parseFloat(localStorage.getItem(${JSON.stringify(
  ZOOM_STORAGE_KEY
)}));if(z>=${MIN_ZOOM}&&z<=${MAX_ZOOM}&&z!==${DEFAULT_ZOOM})document.documentElement.style.zoom=""+z/100}catch(e){}`;
