import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  TRACKING_EVENTS_ENDPOINT,
  normalizeTrackedPath,
  sendTrackingEvent,
  sitePageContext,
} from "../tracking-events";

describe("normalizeTrackedPath", () => {
  it.each([
    ["/", "/"],
    ["/pricing?plan=POS#faq", "/pricing"],
    ["/id/sales-page-2", "/id/sales-page-2"],
    ["/aplikasi-kasir-restoran-indonesia-terbaik", "/aplikasi-kasir-restoran-indonesia-terbaik"],
    ["/store/clx9a8b7c6d5e4f3g2h1i0j9k8/pos", "/store/:id/pos"],
    ["/r/123e4567-e89b-12d3-a456-426614174000", "/r/:id"],
    ["/@kopi-senja/menu", "/@:store/menu"],
    ["register", "/register"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeTrackedPath(raw)).toBe(expected);
  });

  it("caps the length", () => {
    expect(normalizeTrackedPath(`/${"a-".repeat(300)}`)).toHaveLength(200);
  });
});

describe("sendTrackingEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses sendBeacon, which survives the navigation that often follows", () => {
    vi.stubGlobal(
      "Blob",
      class {
        constructor(public parts: string[]) {}
      }
    );
    const beacon = vi.fn((_url: string, _body: unknown) => true);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    sendTrackingEvent({ kind: "PIXEL", name: "Contact", path: "/contact", source: "site" });

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe(TRACKING_EVENTS_ENDPOINT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch, and never throws", () => {
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
    const fetchSpy = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchSpy);

    expect(() =>
      sendTrackingEvent({ kind: "PIXEL", name: "Contact", path: "/contact", source: "site" })
    ).not.toThrow();
    expect(fetchSpy).toHaveBeenCalledWith(
      TRACKING_EVENTS_ENDPOINT,
      expect.objectContaining({ method: "POST", keepalive: true })
    );
  });
});

describe("sitePageContext", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("lang");
    vi.restoreAllMocks();
  });

  it("is the current page, cleaned, with the page's language", () => {
    document.documentElement.setAttribute("lang", "fr");
    window.history.replaceState(null, "", "/store/clx9a8b7c6d5e4f3g2h1i0j9k8/billing?x=1");
    expect(sitePageContext()).toEqual({ path: "/store/:id/billing", source: "site", locale: "fr" });
  });

  describe("before an app page has set <html lang> (its first PageView, an automatic consent)", () => {
    beforeEach(() => document.documentElement.removeAttribute("lang"));

    it("takes ?lang=, which the auth pages apply", () => {
      window.history.replaceState(null, "", "/register?lang=id&utm_source=meta");
      expect(sitePageContext().locale).toBe("id");
    });

    it("then the saved language preference", () => {
      window.history.replaceState(null, "", "/register");
      localStorage.setItem("locale", "fr");
      expect(sitePageContext().locale).toBe("fr");
    });

    it("then the browser's language, as the app does", () => {
      window.history.replaceState(null, "", "/login");
      vi.spyOn(navigator, "language", "get").mockReturnValue("id-ID");
      expect(sitePageContext().locale).toBe("id");
    });
  });

  it("an unknown <html lang> also falls back instead of dropping the language", () => {
    document.documentElement.setAttribute("lang", "de");
    window.history.replaceState(null, "", "/register?lang=en");
    expect(sitePageContext().locale).toBe("en");
  });
});
