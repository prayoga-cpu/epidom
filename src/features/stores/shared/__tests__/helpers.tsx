import type * as React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

/**
 * The real I18nProvider with every dictionary resident, so a test reads the
 * copy a French or Indonesian owner actually sees.
 */
export function renderIn(locale: Locale, ui: React.ReactElement) {
  return render(<EagerI18nProvider initialLocale={locale}>{ui}</EagerI18nProvider>);
}

export const DICTS = { en, fr, id } as const;

/**
 * Per-test timeout for the render suites. The popover tests render a cmdk list
 * of every country or currency, and on a loaded machine the first render of a
 * file (cold imports of all three dictionaries) has taken over 20 s.
 */
export const RENDER_TEST_TIMEOUT = 60_000;

/** A `t` over one real dictionary, for code that takes `t` without React. */
export function translatorFor(locale: Locale): (key: string) => string {
  return (key: string) => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
        DICTS[locale]
      );
    return typeof value === "string" ? value : key;
  };
}

/** jsdom lacks what Radix Popover and cmdk call: ResizeObserver, scrollIntoView, pointer capture. */
export function installDomPolyfills() {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
}

/** Makes `Intl.DateTimeFormat().resolvedOptions().timeZone` report `timeZone`. */
export function mockBrowserTimezone(timeZone: string) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  return vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat
  ) {
    return { ...original.call(this), timeZone };
  });
}
