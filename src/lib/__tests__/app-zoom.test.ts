import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  DEFAULT_ZOOM,
  ZOOM_BOOT_SCRIPT,
  ZOOM_CHANGE_EVENT,
  ZOOM_LEVELS,
  ZOOM_STORAGE_KEY,
  applyZoom,
  canStepZoom,
  normalizeZoom,
  readStoredZoom,
  setStoredZoom,
  stepZoom,
  subscribeZoom,
} from "@/lib/app-zoom";

describe("app zoom", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.style.zoom = "";
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

    it("ignores unrelated storage keys", () => {
      const onChange = vi.fn();
      const unsubscribe = subscribeZoom(onChange);
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
      expect(onChange).not.toHaveBeenCalled();
      unsubscribe();
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
