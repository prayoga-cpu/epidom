import { describe, it, expect, beforeEach } from "vitest";
import {
  acceptAllCookies,
  getCookiePreferences,
  getLanguagePreference,
  hasAnalyticsConsent,
  hasConsent,
  hasConsentChoice,
  hasMarketingConsent,
  rejectAllCookies,
  setCookiePreferences,
  setLanguagePreference,
} from "../cookie-consent";

const RECORD_KEY = "cookie-consent-preferences";

function captureUpdates() {
  const events: Array<Record<string, unknown>> = [];
  const listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener("cookie-consent-updated", listener);
  return { events, stop: () => window.removeEventListener("cookie-consent-updated", listener) };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("a language switch is not a consent choice", () => {
  it("setLanguagePreference with nothing saved leaves hasConsentChoice() false", () => {
    setLanguagePreference("id");

    expect(hasConsentChoice()).toBe(false);
    expect(getCookiePreferences()).toBeNull();
    // No consent record was written, so nothing can be read back as a refusal.
    expect(window.localStorage.getItem(RECORD_KEY)).toBeNull();
  });

  it("still remembers the language, in the legacy keys getLanguagePreference falls back to", () => {
    setLanguagePreference("fr");

    expect(window.localStorage.getItem("locale")).toBe("fr");
    expect(window.localStorage.getItem("lang")).toBe("fr");
    expect(getLanguagePreference()).toBe("fr");
  });

  it("setCookiePreferences({ language }) alone behaves the same way", () => {
    setCookiePreferences({ language: "en" });

    expect(hasConsentChoice()).toBe(false);
    expect(getLanguagePreference()).toBe("en");
  });

  it("no category counts as consented while the visitor has not answered", () => {
    setLanguagePreference("id");

    expect(hasConsent("analytics")).toBe(false);
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasMarketingConsent()).toBe(false);
  });

  it("switching language several times still records no choice", () => {
    setLanguagePreference("id");
    setLanguagePreference("en");
    setLanguagePreference("fr");

    expect(hasConsentChoice()).toBe(false);
    expect(getLanguagePreference()).toBe("fr");
  });

  it("still fires the update event with the language, for listeners that follow it", () => {
    const { events, stop } = captureUpdates();
    setLanguagePreference("id");
    stop();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ language: "id" });
    // The event must not claim a consent choice either.
    expect(events[0]).not.toHaveProperty("analytics");
    expect(events[0]).not.toHaveProperty("marketing");
  });

  it("an invalid language falls back to English without recording a choice", () => {
    setCookiePreferences({ language: "de" as never });

    expect(hasConsentChoice()).toBe(false);
    expect(getLanguagePreference()).toBe("en");
  });
});

describe("a real answer is still recorded", () => {
  it("Reject after a language switch records an explicit refusal, in that language", () => {
    setLanguagePreference("id");
    expect(hasConsentChoice()).toBe(false);

    rejectAllCookies("id");

    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toMatchObject({
      analytics: false,
      marketing: false,
      language: "id",
    });
  });

  it("Accept after a language switch records the acceptance", () => {
    setLanguagePreference("fr");

    acceptAllCookies("fr");

    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toMatchObject({
      analytics: true,
      marketing: true,
      language: "fr",
    });
  });

  it.each([
    ["analytics only", { analytics: true }, { analytics: true, marketing: false }],
    ["marketing only", { marketing: true }, { analytics: false, marketing: true }],
    [
      "an explicit all-off",
      { analytics: false, marketing: false },
      { analytics: false, marketing: false },
    ],
    ["an explicit analytics-off", { analytics: false }, { analytics: false, marketing: false }],
  ] as const)("a category choice (%s) creates the record", (_label, input, expected) => {
    setCookiePreferences(input);

    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toMatchObject(expected);
  });
});

describe("once a choice exists, the language rides along in it", () => {
  it("switching language keeps the saved analytics and marketing choice", () => {
    setCookiePreferences({ analytics: true, marketing: false, language: "en" });

    setLanguagePreference("id");

    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toMatchObject({
      analytics: true,
      marketing: false,
      language: "id",
    });
    expect(window.localStorage.getItem("locale")).toBe("id");
  });

  it("a saved refusal stays a refusal after a language switch", () => {
    rejectAllCookies("en");

    setLanguagePreference("fr");

    expect(getCookiePreferences()).toMatchObject({ analytics: false, marketing: false });
    expect(getCookiePreferences()?.language).toBe("fr");
  });

  it("dispatches the full record in the event once a choice exists", () => {
    setCookiePreferences({ analytics: true, marketing: true, language: "en" });
    const { events, stop } = captureUpdates();

    setLanguagePreference("fr");
    stop();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ analytics: true, marketing: true, language: "fr" });
  });
});

describe("records written before this change keep working", () => {
  it("reads a stored record exactly as saved, including a refusal", () => {
    window.localStorage.setItem(
      RECORD_KEY,
      JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        language: "fr",
        timestamp: 1_700_000_000_000,
        version: "1.0.0",
      })
    );

    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toEqual({
      essential: true,
      analytics: false,
      marketing: false,
      language: "fr",
      timestamp: 1_700_000_000_000,
    });
  });

  it("a stored acceptance survives a language switch", () => {
    window.localStorage.setItem(
      RECORD_KEY,
      JSON.stringify({
        essential: true,
        analytics: true,
        marketing: true,
        language: "en",
        timestamp: 1_700_000_000_000,
        version: "1.0.0",
      })
    );

    setLanguagePreference("id");

    expect(hasAnalyticsConsent()).toBe(true);
    expect(hasMarketingConsent()).toBe(true);
    expect(getCookiePreferences()?.language).toBe("id");
  });
});
