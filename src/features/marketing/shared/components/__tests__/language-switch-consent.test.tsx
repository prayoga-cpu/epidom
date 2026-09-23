import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useI18n } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import {
  getCookiePreferences,
  hasAnalyticsConsent,
  hasConsentChoice,
  hasMarketingConsent,
} from "@/lib/cookie-consent";
import { CookieConsentBar } from "../cookie-consent-bar";

// The real I18nProvider, real dictionaries and the real bar: the visitor's path is
// "open the site, switch language with the header's switcher, and only then (maybe)
// answer the bar". The switcher calls the provider's setLocale, so that is what is used.

function SwitchToEnglish() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale("en")}>switch to English</button>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("switching language before answering the cookie bar", () => {
  it("does not record a refusal: the bar stays, and comes back on the next visit", () => {
    const first = render(
      <EagerI18nProvider initialLocale="fr">
        <CookieConsentBar />
        <SwitchToEnglish />
      </EagerI18nProvider>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch to English" }));

    // Nobody answered, so nothing is recorded, not even an all-off record.
    expect(hasConsentChoice()).toBe(false);
    expect(getCookiePreferences()).toBeNull();
    expect(window.localStorage.getItem("cookie-consent-preferences")).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasMarketingConsent()).toBe(false);
    // The language itself is remembered, and the bar now speaks it.
    expect(window.localStorage.getItem("locale")).toBe("en");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();

    // Next page load: still nothing answered, so the bar is shown again.
    first.unmount();
    render(
      <EagerI18nProvider initialLocale="en">
        <CookieConsentBar />
      </EagerI18nProvider>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("an answer given after the switch is still recorded, in the new language", () => {
    render(
      <EagerI18nProvider initialLocale="fr">
        <CookieConsentBar />
        <SwitchToEnglish />
      </EagerI18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "switch to English" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(hasConsentChoice()).toBe(true);
    expect(getCookiePreferences()).toMatchObject({
      analytics: false,
      marketing: false,
      language: "en",
    });
  });
});
