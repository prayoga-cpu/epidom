// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CONSENT_BOOT_SCRIPT,
  CONSENT_MODE_COOKIE,
  applyConsentModeCookie,
  consentModeForCountry,
} from "../consent-region";
import { COOKIE_CONSENT_STORAGE_KEY, getCookiePreferences, getLanguagePreference } from "../cookie-consent";

describe("consentModeForCountry", () => {
  it.each(["FR", "DE", "ES", "IT", "NL", "IE", "GB", "CH", "NO", "IS", "LI", "RE", "GP", "fr"])(
    "%s needs consent first",
    (country) => expect(consentModeForCountry(country)).toBe("opt-in")
  );

  it.each(["ID", "US", "SG", "MY", "AU", "JP", "BR", "CA"])("%s doesn't", (country) =>
    expect(consentModeForCountry(country)).toBe("opt-out")
  );

  it.each([null, undefined, "", "XX1", "EU", "XX", "T1", "?"].map((v) => [v]))(
    "an unknown country (%s) asks first",
    (country) => {
      // Placeholders for "not a country" (EU-wide, unknown, Tor): still ask.
      expect(consentModeForCountry(country as string | null | undefined)).toBe("opt-in");
    }
  );
});

describe("applyConsentModeCookie", () => {
  const request = (country: string | null, cookie?: string) => ({
    headers: new Headers(country ? { "x-vercel-ip-country": country } : {}),
    cookies: { get: (name: string) => (cookie && name === CONSENT_MODE_COOKIE ? { value: cookie } : undefined) },
    nextUrl: { protocol: "https:" },
  });
  const response = () => {
    const set = vi.fn();
    return { set, res: { cookies: { set } } };
  };

  it("labels an Indonesian visitor opt-out, readable by the page", () => {
    const { set, res } = response();
    applyConsentModeCookie(request("ID") as never, res as never);
    expect(set).toHaveBeenCalledWith(
      CONSENT_MODE_COOKIE,
      "opt-out",
      expect.objectContaining({ path: "/", httpOnly: false, sameSite: "lax", secure: true })
    );
  });

  it("labels a French visitor, and one with no country, opt-in", () => {
    for (const country of ["FR", null]) {
      const { set, res } = response();
      applyConsentModeCookie(request(country) as never, res as never);
      expect(set).toHaveBeenCalledWith(CONSENT_MODE_COOKIE, "opt-in", expect.anything());
    }
  });

  it("sends nothing when the browser already has the right label", () => {
    const { set, res } = response();
    applyConsentModeCookie(request("ID", "opt-out") as never, res as never);
    expect(set).not.toHaveBeenCalled();
  });

  it("relabels a visitor whose country changed", () => {
    const { set, res } = response();
    applyConsentModeCookie(request("FR", "opt-out") as never, res as never);
    expect(set).toHaveBeenCalledWith(CONSENT_MODE_COOKIE, "opt-in", expect.anything());
  });
});

describe("CONSENT_BOOT_SCRIPT", () => {
  type W = { __epidomAutoConsent?: boolean };
  const boot = () => new Function(CONSENT_BOOT_SCRIPT)();
  const setMode = (mode: string | null) => {
    document.cookie = `${CONSENT_MODE_COOKIE}=; Max-Age=0; Path=/`;
    if (mode) document.cookie = `${CONSENT_MODE_COOKIE}=${mode}; Path=/`;
  };
  const record = () => JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? "null");

  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as W).__epidomAutoConsent;
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    setMode(null);
    vi.restoreAllMocks();
  });

  it("where no consent is needed, saves an automatic accept and flags it", () => {
    setMode("opt-out");
    boot();
    expect(record()).toMatchObject({
      essential: true,
      analytics: true,
      marketing: true,
      version: "1.0.0",
      auto: true,
    });
    expect((window as unknown as W).__epidomAutoConsent).toBe(true);
    expect(getCookiePreferences()).toMatchObject({ analytics: true, marketing: true, auto: true });
  });

  it("keeps the language the app would have picked without it", () => {
    setMode("opt-out");
    vi.spyOn(navigator, "language", "get").mockReturnValue("id-ID");
    const before = getLanguagePreference();
    boot();
    expect(before).toBe("id");
    expect(getLanguagePreference()).toBe("id");

    localStorage.clear();
    localStorage.setItem("locale", "fr");
    boot();
    expect(record().language).toBe("fr");
  });

  it("never overrides a choice the visitor made", () => {
    setMode("opt-out");
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, analytics: false, marketing: false, language: "en", timestamp: 1, version: "1.0.0" })
    );
    boot();
    expect(record()).toMatchObject({ analytics: false, marketing: false });
    expect(record().auto).toBeUndefined();
    expect((window as unknown as W).__epidomAutoConsent).toBeUndefined();
  });

  it("where consent is needed, drops an automatic accept so the visitor is asked", () => {
    setMode("opt-out");
    boot();
    setMode("opt-in");
    boot();
    expect(record()).toBeNull();
  });

  it("where consent is needed, keeps a choice the visitor made", () => {
    setMode("opt-in");
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, analytics: true, marketing: true, language: "fr", timestamp: 1, version: "1.0.0" })
    );
    boot();
    expect(record()).toMatchObject({ marketing: true });
  });

  it("asks when the country is unknown (no label)", () => {
    setMode(null);
    boot();
    expect(record()).toBeNull();
  });

  it("never switches tracking on for a merchant's storefront or a receipt", () => {
    setMode("opt-out");
    for (const path of ["/@kopi-senja", "/@kopi-senja/menu", "/r/clx9a8b7c6d5e4f3g2h1i0j9k8"]) {
      window.history.replaceState(null, "", path);
      boot();
      expect(record()).toBeNull();
    }
  });
});
