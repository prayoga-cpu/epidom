import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Real stubs (the ones the pages ship inline), so "queued" means what it means in production.
vi.mock("next/script", () => ({ default: () => null }));

import { GOOGLE_ANALYTICS_STUB } from "@/components/analytics/google-analytics-script";
import { META_PIXEL_STUB } from "@/components/analytics/meta-pixel-script";
import { trackEvent, trackConversion, trackMetaPixelEvent } from "../analytics";
import { setCookiePreferences } from "../cookie-consent";

type W = {
  dataLayer?: IArguments[];
  gtag?: unknown;
  fbq?: { queue: IArguments[] };
  _fbq?: unknown;
};
const win = () => window as unknown as W;

const gaCalls = () => (win().dataLayer ?? []).map((e) => Array.from(e));
const gaEvents = () => gaCalls().filter((c) => c[0] === "event");
const metaCalls = () => (win().fbq?.queue ?? []).map((e) => Array.from(e));

beforeEach(() => {
  window.localStorage.clear();
  delete win().dataLayer;
  delete win().gtag;
  delete win().fbq;
  delete win()._fbq;
  new Function(GOOGLE_ANALYTICS_STUB)();
  new Function(META_PIXEL_STUB)();
});

describe("events without consent are dropped, not queued", () => {
  it("drops every kind of event when nothing was chosen", () => {
    trackEvent("cta_click", { event_label: "x" });
    trackConversion("sign_up");
    trackMetaPixelEvent("CompleteRegistration");

    expect(gaEvents()).toEqual([]);
    expect(metaCalls()).toEqual([]);
  });

  it("does not replay them when consent is granted afterwards", () => {
    trackEvent("cta_click");
    trackConversion("sign_up");
    trackMetaPixelEvent("Lead");

    setCookiePreferences({ analytics: true, marketing: true });

    // Granting consent does not flush anything: the calls above never reached a queue.
    expect(gaEvents()).toEqual([]);
    expect(metaCalls()).toEqual([]);
  });

  it("does not replay them after a withdrawal and a later re-grant either", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    setCookiePreferences({ analytics: false, marketing: false });

    trackEvent("cta_click");
    trackConversion("sign_up");
    trackMetaPixelEvent("Lead");
    setCookiePreferences({ analytics: true, marketing: true });

    expect(gaEvents()).toEqual([]);
    expect(metaCalls()).toEqual([]);
  });

  it("a marketing-only visitor sends nothing to Google (gtag.js is not even loaded for them)", () => {
    setCookiePreferences({ analytics: false, marketing: true });

    trackEvent("cta_click");
    trackConversion("sign_up");

    expect(gaEvents()).toEqual([]);
  });

  it("an analytics-only visitor sends nothing to Meta, and no conversion", () => {
    setCookiePreferences({ analytics: true, marketing: false });

    trackMetaPixelEvent("Lead");
    trackConversion("sign_up");

    expect(metaCalls()).toEqual([]);
    expect(gaEvents()).toEqual([]);
  });
});

describe("events still fire once consent exists", () => {
  it("analytics consent: trackEvent reaches gtag", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    trackEvent("cta_click", { event_label: "hero" });
    expect(gaEvents()).toEqual([["event", "cta_click", { event_label: "hero" }]]);
  });

  it("analytics + marketing consent: a conversion reaches gtag with its default category", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    trackConversion("sign_up", { event_label: "email" });
    expect(gaEvents()).toEqual([
      ["event", "sign_up", { event_label: "email", event_category: "conversion" }],
    ]);
  });

  it("marketing consent: trackMetaPixelEvent reaches fbq", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    trackMetaPixelEvent("Subscribe", { value: 3 });
    expect(metaCalls()).toEqual([["track", "Subscribe", { value: 3 }]]);
  });

  it("passes an event id on to Meta as eventID", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    trackMetaPixelEvent("StartTrial", { content_name: "POS" }, { eventId: "cs_test_1" });
    expect(metaCalls()).toEqual([
      ["track", "StartTrial", { content_name: "POS" }, { eventID: "cs_test_1" }],
    ]);
  });
});

describe("the first-party copy behind /admin/pixel", () => {
  const beacons = () =>
    (navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => {
      const [url, blob] = call as [string, { parts: string[] }];
      return { url, body: JSON.parse(blob.parts.join("")) };
    });

  beforeEach(() => {
    vi.stubGlobal(
      "Blob",
      class {
        constructor(public parts: string[]) {}
      }
    );
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn(() => true) });
    document.documentElement.setAttribute("lang", "id");
    window.history.replaceState(null, "", "/id/pricing?plan=POS");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies each Meta event sent, with its page, language, plan and value", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    trackMetaPixelEvent("InitiateCheckout", {
      content_name: "POS",
      content_category: "trial",
      value: 229000,
      currency: "IDR",
    });

    expect(beacons()).toEqual([
      {
        url: "/api/public/tracking-events",
        body: {
          kind: "PIXEL",
          name: "InitiateCheckout",
          path: "/id/pricing",
          source: "site",
          locale: "id",
          content: "POS",
          value: 229000,
          currency: "IDR",
        },
      },
    ]);
  });

  it("copies nothing that wasn't sent: no consent, no copy", () => {
    trackMetaPixelEvent("CompleteRegistration");
    expect(beacons()).toEqual([]);
  });

  it("copies nothing where the pixel isn't mounted (a preview deployment)", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    delete win().fbq;
    trackMetaPixelEvent("CompleteRegistration");
    expect(beacons()).toEqual([]);
  });
});
