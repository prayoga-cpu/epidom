import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  DEFAULT_ZOOM,
  MIN_LAYOUT_WIDTH,
  ZOOM_BOOT_SCRIPT,
  ZOOM_CHANGE_EVENT,
  ZOOM_LEVELS,
  ZOOM_STORAGE_KEY,
  applyZoom,
  canStepZoom,
  maxZoomForWidth,
  normalizeZoom,
  readEffectiveZoom,
  readMaxZoom,
  readStoredZoom,
  resolveZoom,
  setStoredZoom,
  stepZoom,
  subscribeZoom,
} from "@/lib/app-zoom";

const JSDOM_DEFAULT_WIDTH = 1024;

/** `innerWidth` is what the cap reads; jsdom exposes it as a plain settable value. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

describe("app zoom", () => {
  beforeEach(() => {
    setViewportWidth(JSDOM_DEFAULT_WIDTH);
    window.localStorage.clear();
    document.documentElement.style.zoom = "";
    // Reset alongside `zoom` — a value left behind by one case would otherwise
    // read as "already applied" in the next and hide a writer that stopped
    // setting it.
    document.documentElement.style.removeProperty("--app-zoom");
    document.documentElement.removeAttribute("data-app-zoomed");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeZoom", () => {
    it("keeps values that are already on the ladder", () => {
      for (const level of ZOOM_LEVELS) expect(normalizeZoom(level)).toBe(level);
    });

    it("snaps an off-ladder value to the nearest level", () => {
      expect(normalizeZoom(96)).toBe(100);
      expect(normalizeZoom(118)).toBe(125); // 118 is 8 from 110, 7 from 125
      expect(normalizeZoom(112)).toBe(110);
    });

    it("clamps outside the ladder instead of leaving the UI unreachable", () => {
      expect(normalizeZoom(10)).toBe(ZOOM_LEVELS[0]);
      expect(normalizeZoom(500)).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    });

    it("falls back to the default for junk", () => {
      expect(normalizeZoom("not a number")).toBe(DEFAULT_ZOOM);
      expect(normalizeZoom(null)).toBe(DEFAULT_ZOOM);
      expect(normalizeZoom(undefined)).toBe(DEFAULT_ZOOM);
      expect(normalizeZoom(NaN)).toBe(DEFAULT_ZOOM);
      expect(normalizeZoom(Infinity)).toBe(DEFAULT_ZOOM);
    });
  });

  describe("stepZoom / canStepZoom", () => {
    it("walks the ladder one level at a time", () => {
      expect(stepZoom(100, -1)).toBe(90);
      expect(stepZoom(90, -1)).toBe(80);
      expect(stepZoom(100, 1)).toBe(110);
    });

    it("stops at both ends rather than wrapping", () => {
      const min = ZOOM_LEVELS[0];
      const max = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      expect(stepZoom(min, -1)).toBe(min);
      expect(stepZoom(max, 1)).toBe(max);
      expect(canStepZoom(min, -1)).toBe(false);
      expect(canStepZoom(min, 1)).toBe(true);
      expect(canStepZoom(max, 1)).toBe(false);
      expect(canStepZoom(max, -1)).toBe(true);
    });

    it("steps from the nearest level when handed an off-ladder value", () => {
      expect(stepZoom(97, -1)).toBe(90);
    });
  });

  describe("applyZoom", () => {
    it("writes the zoom as a ratio on <html>", () => {
      applyZoom(90);
      expect(document.documentElement.style.zoom).toBe("0.9");
      applyZoom(150);
      expect(document.documentElement.style.zoom).toBe("1.5");
    });

    it("clears the inline style at 100% rather than writing zoom: 1", () => {
      applyZoom(80);
      applyZoom(100);
      expect(document.documentElement.style.zoom).toBe("");
    });

    // Every `calc(<viewport unit> / var(--app-zoom, 1))` in the app depends on
    // this property being published — and, just as much, on it being *absent*
    // at 100%, which is what makes the divisor fall back to 1 and every such
    // declaration compile to exactly what it was before the zoom feature.
    it("publishes the scale as --app-zoom for the layout to divide by", () => {
      applyZoom(150);
      expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("1.5");
      applyZoom(70);
      expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("0.7");
    });

    it("removes --app-zoom at 100% so the fallback of 1 takes over", () => {
      applyZoom(70);
      applyZoom(100);
      expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("");
    });

    // globals.css scopes the Radix popper correction to html[data-app-zoomed],
    // so that at 100% those rules do not exist at all rather than merely
    // evaluating to an identity transform.
    it("marks the document while zoomed and unmarks it at 100%", () => {
      applyZoom(125);
      expect(document.documentElement.hasAttribute("data-app-zoomed")).toBe(true);
      applyZoom(100);
      expect(document.documentElement.hasAttribute("data-app-zoomed")).toBe(false);
    });
  });

  describe("setStoredZoom", () => {
    it("persists, applies and returns the normalized value", () => {
      expect(setStoredZoom(112)).toBe(110);
      expect(window.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe("110");
      expect(document.documentElement.style.zoom).toBe("1.1");
    });

    it("still applies when storage is unavailable", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => setStoredZoom(80)).not.toThrow();
      expect(document.documentElement.style.zoom).toBe("0.8");
    });

    it("notifies subscribers so a second mounted control stays in sync", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribeZoom(onChange);
      setStoredZoom(80);
      expect(onChange).toHaveBeenCalledTimes(1);
      unsubscribe();
      setStoredZoom(90);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("readStoredZoom", () => {
    it("defaults when nothing is stored", () => {
      expect(readStoredZoom()).toBe(DEFAULT_ZOOM);
    });

    it("sanitizes a value written by an older ladder", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "85");
      expect([80, 90]).toContain(readStoredZoom());
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "999");
      expect(readStoredZoom()).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "garbage");
      expect(readStoredZoom()).toBe(DEFAULT_ZOOM);
    });
  });

  describe("subscribeZoom", () => {
    it("applies and reports a change made in another tab", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribeZoom(onChange);
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "80");
      window.dispatchEvent(new StorageEvent("storage", { key: ZOOM_STORAGE_KEY }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(document.documentElement.style.zoom).toBe("0.8");
      unsubscribe();
    });

    // The ceiling moves with the screen (rotation, a dragged window), and a
    // control that is already open has to re-read it.
    it("reports the screen being resized", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribeZoom(onChange);
      window.dispatchEvent(new Event("resize"));
      expect(onChange).toHaveBeenCalledTimes(1);
      unsubscribe();
      window.dispatchEvent(new Event("resize"));
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("ignores unrelated storage keys", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribeZoom(onChange);
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
      expect(onChange).not.toHaveBeenCalled();
      unsubscribe();
    });
  });

  // Zooming in shrinks the layout (`innerWidth / zoom`) while media queries keep
  // reading the physical screen, so on a phone a zoomed-in layout is the phone
  // layout squeezed narrower than it was built for. These pin the cap that
  // stops that — the numbers are the layout width at the boundary level.
  describe("maxZoomForWidth", () => {
    it("allows every level once the screen is wide enough to hold the top one", () => {
      const top = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      // 563 / 1.5 = 375.3 — just inside the floor.
      expect(maxZoomForWidth(Math.ceil(MIN_LAYOUT_WIDTH * (top / 100)))).toBe(top);
      expect(maxZoomForWidth(1280)).toBe(top);
      expect(maxZoomForWidth(1920)).toBe(top);
    });

    it("stops at the last level whose layout is still at least the minimum width", () => {
      expect(maxZoomForWidth(562)).toBe(125); // 562 / 1.5 = 374.7: one px short
      expect(maxZoomForWidth(430)).toBe(110); // iPhone Pro Max: 391 at 110%, 344 at 125%
      expect(maxZoomForWidth(412)).toBe(100); // Pixel: 374.5 at 110%
      expect(maxZoomForWidth(390)).toBe(100); // iPhone: 354 at 110%
    });

    // The cap only ever removes zoom-IN. A 360px Android would otherwise be
    // dropped to 90% at its own default just to reach a 375px layout.
    it("never forces the UI below 100%", () => {
      expect(maxZoomForWidth(375)).toBe(DEFAULT_ZOOM);
      expect(maxZoomForWidth(360)).toBe(DEFAULT_ZOOM);
      expect(maxZoomForWidth(320)).toBe(DEFAULT_ZOOM);
    });

    it("does not restrict anything when the width is unusable", () => {
      const top = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      expect(maxZoomForWidth(NaN)).toBe(top);
      expect(maxZoomForWidth(0)).toBe(top);
      expect(maxZoomForWidth(-5)).toBe(top);
    });
  });

  describe("resolveZoom", () => {
    it("holds a saved zoom-in to the screen's ceiling", () => {
      expect(resolveZoom(150, 390)).toBe(100);
      expect(resolveZoom(150, 430)).toBe(110);
      expect(resolveZoom(125, 800)).toBe(125);
    });

    it("leaves zooming out alone — a wider layout is always safe", () => {
      expect(resolveZoom(70, 390)).toBe(70);
      expect(resolveZoom(90, 320)).toBe(90);
    });
  });

  describe("on a narrow screen", () => {
    it("applyZoom holds a saved zoom-in to what fits, and clears it entirely at 100%", () => {
      setViewportWidth(390);
      applyZoom(150);
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("");
      expect(document.documentElement.hasAttribute("data-app-zoomed")).toBe(false);
    });

    it("applyZoom applies the highest level that does fit", () => {
      setViewportWidth(430);
      applyZoom(150);
      expect(document.documentElement.style.zoom).toBe("1.1");
      expect(document.documentElement.style.getPropertyValue("--app-zoom")).toBe("1.1");
    });

    it("still zooms out", () => {
      setViewportWidth(390);
      applyZoom(70);
      expect(document.documentElement.style.zoom).toBe("0.7");
    });

    // The saved value is the user's choice; the cap is a property of the screen
    // it is on right now. Rotating must give the choice back.
    it("keeps the saved preference, and restores it when the screen widens again", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      setViewportWidth(390);
      expect(readStoredZoom()).toBe(150);
      expect(readEffectiveZoom()).toBe(100);
      expect(readMaxZoom()).toBe(100);

      setViewportWidth(1024);
      expect(readEffectiveZoom()).toBe(150);
      expect(readMaxZoom()).toBe(150);
    });

    it("re-applies on a later applyZoom once the screen has changed", () => {
      setViewportWidth(390);
      applyZoom(150);
      expect(document.documentElement.style.zoom).toBe("");
      setViewportWidth(1024);
      applyZoom(150);
      expect(document.documentElement.style.zoom).toBe("1.5");
    });
  });

  describe("stepping under a ceiling", () => {
    it("stops going up at the ceiling", () => {
      expect(stepZoom(100, 1, 100)).toBe(100);
      expect(canStepZoom(100, 1, 100)).toBe(false);
      expect(stepZoom(100, 1, 110)).toBe(110);
      expect(canStepZoom(100, 1, 110)).toBe(true);
      expect(stepZoom(110, 1, 110)).toBe(110);
    });

    it("never restricts stepping down", () => {
      expect(stepZoom(100, -1, 100)).toBe(90);
      expect(canStepZoom(100, -1, 100)).toBe(true);
    });

    it("defaults to the ladder's own top when no ceiling is given", () => {
      expect(stepZoom(125, 1)).toBe(150);
      expect(canStepZoom(150, 1)).toBe(false);
    });
  });

  describe("boot script", () => {
    // The script is inlined into <head> as a string, so nothing type-checks it —
    // run it against the same document the rest of the module works on.
    const run = () => new Function(ZOOM_BOOT_SCRIPT)();

    it("applies a saved zoom before React ever mounts", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "80");
      run();
      expect(document.documentElement.style.zoom).toBe("0.8");
    });

    // Two writers, one contract. If the boot script sets `zoom` but not
    // `--app-zoom`, the first paint scales every box while leaving every
    // viewport-unit length undivided — the layout is wrong until React
    // hydrates and applyZoom catches up, which is the exact flash this script
    // exists to prevent, just moved from the scale onto the geometry.
    it("publishes --app-zoom identically to applyZoom", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "80");
      run();
      const snapshot = () => ({
        zoom: document.documentElement.style.zoom,
        appZoom: document.documentElement.style.getPropertyValue("--app-zoom"),
        marked: document.documentElement.hasAttribute("data-app-zoomed"),
      });
      const booted = snapshot();

      document.documentElement.style.zoom = "";
      document.documentElement.style.removeProperty("--app-zoom");
      document.documentElement.removeAttribute("data-app-zoomed");
      applyZoom(80);

      expect(booted).toEqual(snapshot());
      expect(booted).toEqual({ zoom: "0.8", appZoom: "0.8", marked: true });
    });

    // The same cap has to hold before React mounts — otherwise a phone with a
    // saved 150% paints its first frame at 150% and only corrects on hydration.
    it("holds a saved zoom-in to what the screen can take, like applyZoom", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");

      for (const width of [390, 430, 450, 562, 563, 1024]) {
        for (const key of ["zoom", "--app-zoom"]) {
          document.documentElement.style.removeProperty(key);
        }
        document.documentElement.style.zoom = "";
        document.documentElement.removeAttribute("data-app-zoomed");

        setViewportWidth(width);
        run();
        const booted = document.documentElement.style.zoom;

        document.documentElement.style.zoom = "";
        document.documentElement.style.removeProperty("--app-zoom");
        applyZoom(150);
        expect(booted, `width ${width}`).toBe(document.documentElement.style.zoom);
      }
    });

    it("does not zoom in at all on a phone", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      setViewportWidth(390);
      run();
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.documentElement.hasAttribute("data-app-zoomed")).toBe(false);
    });

    it("still zooms a phone out", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "70");
      setViewportWidth(390);
      run();
      expect(document.documentElement.style.zoom).toBe("0.7");
    });

    it("leaves the document alone at the default, when unset, or on junk", () => {
      run();
      expect(document.documentElement.style.zoom).toBe("");
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(DEFAULT_ZOOM));
      run();
      expect(document.documentElement.style.zoom).toBe("");
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "garbage");
      run();
      expect(document.documentElement.style.zoom).toBe("");
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "9000");
      run();
      expect(document.documentElement.style.zoom).toBe("");
    });

    it("agrees with the module on what it writes", () => {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, "150");
      run();
      const fromBootScript = document.documentElement.style.zoom;
      document.documentElement.style.zoom = "";
      applyZoom(150);
      expect(fromBootScript).toBe(document.documentElement.style.zoom);
    });
  });

  it("emits the change event under the documented name", () => {
    const listener = vi.fn();
    window.addEventListener(ZOOM_CHANGE_EVENT, listener);
    setStoredZoom(70);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ZOOM_CHANGE_EVENT, listener);
  });
});
