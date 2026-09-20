import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PREFILL_EMAIL_STORAGE_KEY,
  stashPrefillEmail,
  takeStashedPrefillEmail,
} from "../lib/prefill-handoff";

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("PREFILL_EMAIL_STORAGE_KEY", () => {
  it("is namespaced so it cannot collide with another script's key", () => {
    expect(PREFILL_EMAIL_STORAGE_KEY).toMatch(/^epidom:/);
  });
});

describe("stashPrefillEmail / takeStashedPrefillEmail", () => {
  it("hands the address over, unchanged", () => {
    stashPrefillEmail("jane+shop@bakery.com");

    expect(takeStashedPrefillEmail()).toBe("jane+shop@bakery.com");
  });

  it("writes to sessionStorage (per tab), never localStorage or a cookie", () => {
    stashPrefillEmail("jane@bakery.com");

    expect(window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBe("jane@bakery.com");
    expect(window.localStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain("bakery");
  });

  it("is read once: taking it removes it", () => {
    stashPrefillEmail("jane@bakery.com");

    expect(takeStashedPrefillEmail()).toBe("jane@bakery.com");
    expect(window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBeNull();
    expect(takeStashedPrefillEmail()).toBeNull();
  });

  it("returns null when nothing was stashed", () => {
    expect(takeStashedPrefillEmail()).toBeNull();
  });

  it("returns whatever is there without judging it: validation is the reader's job", () => {
    window.sessionStorage.setItem(PREFILL_EMAIL_STORAGE_KEY, "<script>alert(1)</script>");

    expect(takeStashedPrefillEmail()).toBe("<script>alert(1)</script>");
  });

  it("a second stash replaces the first", () => {
    stashPrefillEmail("first@bakery.com");
    stashPrefillEmail("second@bakery.com");

    expect(takeStashedPrefillEmail()).toBe("second@bakery.com");
  });
});

describe("when storage is unavailable", () => {
  it("stashing swallows the error, so the CTA can still navigate", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() => stashPrefillEmail("jane@bakery.com")).not.toThrow();
  });

  it("taking returns null instead of throwing when the read fails", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(takeStashedPrefillEmail()).toBeNull();
  });

  it("taking still returns the value when only the removal fails", () => {
    stashPrefillEmail("jane@bakery.com");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(takeStashedPrefillEmail()).toBe("jane@bakery.com");
  });
});
