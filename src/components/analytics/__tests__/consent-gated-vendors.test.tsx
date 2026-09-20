import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

// next/script only matters here as "what markup does the component emit".
vi.mock("next/script", () => ({
  default: ({
    id,
    strategy,
    children,
    dangerouslySetInnerHTML,
  }: {
    id?: string;
    strategy?: string;
    children?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <script
      id={id}
      data-strategy={strategy}
      dangerouslySetInnerHTML={dangerouslySetInnerHTML ?? { __html: children ?? "" }}
    />
  ),
}));

import { GoogleAnalyticsConsentBridge } from "../google-analytics-consent-bridge";
import { MetaPixelConsentBridge } from "../meta-pixel-consent-bridge";
import { GoogleAnalyticsScript, GOOGLE_ANALYTICS_STUB } from "../google-analytics-script";
import { MetaPixelScript, META_PIXEL_STUB } from "../meta-pixel-script";
import {
  GA_MEASUREMENT_ID,
  META_PIXEL_ID,
  deleteCookiesMatching,
  resetTrackingVendorState,
} from "../tracking-vendors";
import { setCookiePreferences, clearCookiePreferences } from "@/lib/cookie-consent";

const GTAG_SRC = 'script[src*="googletagmanager.com"]';
const FBEVENTS_SRC = 'script[src*="connect.facebook.net"]';
const GA_DISABLE = `ga-disable-${GA_MEASUREMENT_ID}`;

type W = Record<string, unknown>;
const win = () => window as unknown as W;

function wipeCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function resetEnvironment() {
  window.localStorage.clear();
  document.head.querySelectorAll("script, img").forEach((el) => el.remove());
  document.body.querySelectorAll("script, img").forEach((el) => el.remove());
  for (const key of ["gtag", "dataLayer", "fbq", "_fbq", GA_DISABLE]) delete win()[key];
  wipeCookies();
  resetTrackingVendorState();
}

/** Every element that could make a request to a vendor. */
const requestingNodes = () => document.querySelectorAll("script[src], img[src], iframe[src]");

function mountBridges() {
  return render(
    <>
      <GoogleAnalyticsConsentBridge />
      <MetaPixelConsentBridge />
    </>
  );
}

beforeEach(() => {
  resetEnvironment();
});
afterEach(() => {
  resetEnvironment();
});

describe("no vendor request before consent", () => {
  it("a first visit (nothing saved) inserts no vendor script and no tracking image", () => {
    mountBridges();
    expect(document.querySelector(GTAG_SRC)).toBeNull();
    expect(document.querySelector(FBEVENTS_SRC)).toBeNull();
    expect(requestingNodes()).toHaveLength(0);
  });

  it("rejecting everything still requests nothing", () => {
    mountBridges();
    act(() => setCookiePreferences({ analytics: false, marketing: false }));
    expect(requestingNodes()).toHaveLength(0);
  });

  it("the inline Meta stub defines fbq and makes no request", () => {
    new Function(META_PIXEL_STUB)();
    expect(typeof win().fbq).toBe("function");
    expect(requestingNodes()).toHaveLength(0);
    // Calls made before the pixel exists are queued, not thrown.
    (win().fbq as (...a: unknown[]) => void)("track", "Lead");
    expect((win().fbq as { queue: unknown[] }).queue).toHaveLength(1);
  });

  it("the inline Google stub defines dataLayer and gtag and makes no request", () => {
    new Function(GOOGLE_ANALYTICS_STUB)();
    expect(typeof win().gtag).toBe("function");
    expect(Array.isArray(win().dataLayer)).toBe(true);
    expect(requestingNodes()).toHaveLength(0);
  });

  it("neither inline stub carries a vendor URL, and the Meta noscript pixel is gone", () => {
    for (const stub of [META_PIXEL_STUB, GOOGLE_ANALYTICS_STUB]) {
      expect(stub).not.toMatch(/googletagmanager|facebook\.(com|net)|fbevents|gtag\/js/);
    }
    const html = renderToStaticMarkup(
      <>
        <MetaPixelScript />
        <GoogleAnalyticsScript />
      </>
    );
    expect(html).not.toMatch(/<noscript|<img|facebook\.com\/tr|noscript=1/i);
    expect(html).not.toMatch(/\ssrc=/);
    expect(html).toContain('id="meta-pixel-base"');
    expect(html).toContain('id="google-analytics-base"');
  });

  it("does not put the vendor IDs in the markup either (the bridges hold them)", () => {
    const html = renderToStaticMarkup(
      <>
        <MetaPixelScript />
        <GoogleAnalyticsScript />
      </>
    );
    expect(html).not.toContain(META_PIXEL_ID);
    expect(html).not.toContain(GA_MEASUREMENT_ID);
  });
});

describe("loading on consent, mid-session", () => {
  it("accepting analytics loads gtag only, once, and configures GA", () => {
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: false }));

    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
    expect(document.querySelector(GTAG_SRC)?.getAttribute("src")).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    );
    expect(document.querySelector(FBEVENTS_SRC)).toBeNull();
    expect(win()[GA_DISABLE]).toBe(false);

    const layer = win().dataLayer as IArguments[];
    const commands = layer.map((entry) => Array.from(entry).slice(0, 2));
    expect(commands).toContainEqual(["config", GA_MEASUREMENT_ID]);
  });

  it("accepting marketing loads fbevents only, once, and inits the pixel", () => {
    mountBridges();
    act(() => setCookiePreferences({ analytics: false, marketing: true }));

    expect(document.querySelectorAll(FBEVENTS_SRC)).toHaveLength(1);
    expect(document.querySelector(FBEVENTS_SRC)?.getAttribute("src")).toBe(
      "https://connect.facebook.net/en_US/fbevents.js"
    );
    expect(document.querySelector(GTAG_SRC)).toBeNull();

    const queued = (win().fbq as { queue: IArguments[] }).queue.map((a) => Array.from(a));
    expect(queued).toContainEqual(["init", META_PIXEL_ID]);
    expect(queued).toContainEqual(["track", "PageView"]);
  });

  it("repeated consent events and a remount never insert a script twice", () => {
    const first = mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    act(() => setCookiePreferences({ language: "fr" }));
    first.unmount();
    mountBridges();

    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
    expect(document.querySelectorAll(FBEVENTS_SRC)).toHaveLength(1);
    // One PageView and one config in total, not one per event.
    const queued = (win().fbq as { queue: IArguments[] }).queue.map((a) => Array.from(a));
    expect(queued.filter((c) => c[0] === "track" && c[1] === "PageView")).toHaveLength(1);
    const configs = (win().dataLayer as IArguments[]).filter((e) => e[0] === "config");
    expect(configs).toHaveLength(1);
  });

  it("does not double up when the inline stub already ran before the bridge", () => {
    new Function(GOOGLE_ANALYTICS_STUB)();
    new Function(META_PIXEL_STUB)();
    const gtagBefore = win().gtag;
    const fbqBefore = win().fbq;
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    expect(win().gtag).toBe(gtagBefore);
    expect(win().fbq).toBe(fbqBefore);
    const jsCalls = (win().dataLayer as IArguments[]).filter((e) => e[0] === "js");
    expect(jsCalls).toHaveLength(1);
  });
});

describe("loading on page load when the choice is already saved", () => {
  it("a saved analytics + marketing choice loads both scripts on mount", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    expect(requestingNodes()).toHaveLength(0);

    mountBridges();

    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
    expect(document.querySelectorAll(FBEVENTS_SRC)).toHaveLength(1);
  });

  it("a saved analytics-only choice loads only gtag", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    mountBridges();
    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
    expect(document.querySelector(FBEVENTS_SRC)).toBeNull();
  });

  it("a saved marketing-only choice loads only fbevents", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    mountBridges();
    expect(document.querySelector(GTAG_SRC)).toBeNull();
    expect(document.querySelectorAll(FBEVENTS_SRC)).toHaveLength(1);
  });

  it("a saved reject-all loads nothing", () => {
    setCookiePreferences({ analytics: false, marketing: false });
    mountBridges();
    expect(requestingNodes()).toHaveLength(0);
  });

  it("consent saved by another tab (storage event) is picked up", () => {
    mountBridges();
    // Another tab wrote the record: localStorage changed, no in-tab custom event.
    window.localStorage.setItem(
      "cookie-consent-preferences",
      JSON.stringify({
        essential: true,
        analytics: true,
        marketing: false,
        language: "en",
        timestamp: Date.now(),
        version: "1.0.0",
      })
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "cookie-consent-preferences" }));
    });
    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
  });
});

describe("withdrawal", () => {
  const plantCookies = () => {
    document.cookie = "_ga=GA1.1.1; path=/";
    document.cookie = "_ga_ABC123=GS1; path=/";
    document.cookie = "_gid=GA1.2; path=/";
    document.cookie = "_fbp=fb.1.1; path=/";
    document.cookie = "_fbc=fb.1.2; path=/";
    document.cookie = "epidom_locale_pref=fr; path=/";
  };
  const cookieNames = () =>
    document.cookie
      .split(";")
      .map((c) => c.split("=")[0].trim())
      .filter(Boolean)
      .sort();

  it("withdrawing analytics disables GA at once and deletes its cookies, keeping the others", () => {
    const fbq = vi.fn();
    win().fbq = fbq;
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    plantCookies();
    fbq.mockClear();

    act(() => setCookiePreferences({ analytics: false }));

    expect(win()[GA_DISABLE]).toBe(true);
    expect(cookieNames()).toEqual(["_fbc", "_fbp", "epidom_locale_pref"]);
    // Marketing is untouched.
    expect(fbq).not.toHaveBeenCalledWith("consent", "revoke");
  });

  it("withdrawing marketing revokes Meta consent and deletes _fbp/_fbc, keeping the others", () => {
    const fbq = vi.fn();
    win().fbq = fbq;
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    plantCookies();

    act(() => setCookiePreferences({ marketing: false }));

    expect(fbq).toHaveBeenCalledWith("consent", "revoke");
    expect(win()[GA_DISABLE]).toBe(false);
    expect(cookieNames()).toEqual(["_ga", "_ga_ABC123", "_gid", "epidom_locale_pref"]);
  });

  it("rejecting everything after accepting removes every tracking cookie", () => {
    win().fbq = vi.fn();
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    plantCookies();

    act(() => setCookiePreferences({ analytics: false, marketing: false }));

    expect(cookieNames()).toEqual(["epidom_locale_pref"]);
    expect(win()[GA_DISABLE]).toBe(true);
  });

  it("clearing the saved record counts as withdrawal too", () => {
    mountBridges();
    act(() => setCookiePreferences({ analytics: true }));
    plantCookies();

    act(() => clearCookiePreferences());

    expect(win()[GA_DISABLE]).toBe(true);
    expect(cookieNames()).not.toContain("_ga");
  });

  it("withdrawal in another tab stops tracking here", () => {
    mountBridges();
    act(() => setCookiePreferences({ analytics: true }));
    expect(win()[GA_DISABLE]).toBe(false);

    window.localStorage.removeItem("cookie-consent-preferences");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "cookie-consent-preferences" }));
    });
    expect(win()[GA_DISABLE]).toBe(true);
  });

  it("accepting again after a withdrawal re-enables both without reloading a script", () => {
    const fbq = vi.fn();
    win().fbq = fbq;
    mountBridges();
    act(() => setCookiePreferences({ analytics: true, marketing: true }));
    act(() => setCookiePreferences({ analytics: false, marketing: false }));
    fbq.mockClear();

    act(() => setCookiePreferences({ analytics: true, marketing: true }));

    expect(win()[GA_DISABLE]).toBe(false);
    expect(fbq).toHaveBeenCalledWith("consent", "grant");
    expect(document.querySelectorAll(GTAG_SRC)).toHaveLength(1);
    expect(document.querySelectorAll(FBEVENTS_SRC)).toHaveLength(1);
  });
});

describe("deleteCookiesMatching", () => {
  it("expires each cookie on the host and on every parent domain, never on the bare TLD", () => {
    document.cookie = "_ga=1; path=/";
    const writes: string[] = [];
    const spy = vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => {
      writes.push(v);
    });

    deleteCookiesMatching(/^_ga$/, "app.dev.epidom.fr");
    spy.mockRestore();

    const domains = writes.map((w) => /domain=([^;]+)/.exec(w)?.[1] ?? "(host-only)");
    expect(domains).toEqual([
      "(host-only)",
      "app.dev.epidom.fr",
      ".app.dev.epidom.fr",
      ".dev.epidom.fr",
      ".epidom.fr",
    ]);
    expect(writes.every((w) => w.startsWith("_ga=;") && w.includes("path=/"))).toBe(true);
    expect(writes.every((w) => /expires=Thu, 01 Jan 1970/.test(w))).toBe(true);
  });

  it("does nothing when no matching cookie exists", () => {
    document.cookie = "epidom_locale_pref=fr; path=/";
    const writes: string[] = [];
    const spy = vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => {
      writes.push(v);
    });
    deleteCookiesMatching(/^_ga$/, "epidom.fr");
    spy.mockRestore();
    expect(writes).toEqual([]);
  });
});
