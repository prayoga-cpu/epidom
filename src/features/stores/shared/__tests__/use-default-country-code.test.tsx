import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import { useBrowserTimezone, useDefaultCountryCode } from "../use-default-country-code";
import { mockBrowserTimezone } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

function wrapperFor(locale: Locale) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <EagerI18nProvider initialLocale={locale}>{children}</EagerI18nProvider>;
  };
}

describe("useDefaultCountryCode", () => {
  it("picks the country whose zones include the browser's", () => {
    mockBrowserTimezone("Asia/Makassar");
    const { result } = renderHook(() => useDefaultCountryCode(), { wrapper: wrapperFor("en") });
    expect(result.current).toBe("ID");
  });

  it("falls back to the UI language's market", () => {
    mockBrowserTimezone("America/Lima");
    expect(
      renderHook(() => useDefaultCountryCode(), { wrapper: wrapperFor("fr") }).result.current
    ).toBe("FR");
    expect(
      renderHook(() => useDefaultCountryCode(), { wrapper: wrapperFor("id") }).result.current
    ).toBe("ID");
    expect(
      renderHook(() => useDefaultCountryCode(), { wrapper: wrapperFor("en") }).result.current
    ).toBe(OTHER_COUNTRY_CODE);
  });

  it("is undefined in the server render", () => {
    mockBrowserTimezone("Europe/Paris");
    function Probe() {
      const code = useDefaultCountryCode();
      const timezone = useBrowserTimezone();
      return <span>{`${String(code)}|${String(timezone)}`}</span>;
    }
    const html = renderToString(
      <EagerI18nProvider initialLocale="fr">
        <Probe />
      </EagerI18nProvider>
    );
    expect(html).toContain("undefined|undefined");
  });
});

describe("useBrowserTimezone", () => {
  it("reports the browser's zone on the client", () => {
    mockBrowserTimezone("Europe/Paris");
    const { result } = renderHook(() => useBrowserTimezone());
    expect(result.current).toBe("Europe/Paris");
  });
});
