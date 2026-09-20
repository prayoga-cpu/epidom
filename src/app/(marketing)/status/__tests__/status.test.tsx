import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { StatusClient } from "../client";

const DICTS = { en, fr, id } as const;

function renderPage(locale: Locale) {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <StatusClient />
    </EagerI18nProvider>
  );
}

describe("StatusClient", () => {
  it.each(["en", "fr", "id"] as const)("renders the %s page without a missing key", (locale) => {
    const dict = DICTS[locale].status;
    const { container } = renderPage(locale);
    const text = container.textContent ?? "";

    expect(container.querySelector("h1")?.textContent).toBe(dict.title);
    for (const line of [
      dict.body,
      dict.services.api,
      dict.services.storefront,
      dict.services.payments,
      dict.services.whatsapp,
      dict.report.title,
      dict.report.body,
    ]) {
      expect(text).toContain(line);
    }
    expect(text).not.toMatch(/\bstatus\.[a-zA-Z]/);
  });

  it("is really translated", () => {
    const enText = renderPage("en").container.textContent;
    expect(renderPage("fr").container.textContent).not.toBe(enText);
    expect(renderPage("id").container.textContent).not.toBe(enText);
  });

  it("adds no call to action: status pages are meant to be boring", () => {
    const { container } = renderPage("fr");
    // PlaceholderPage without `actions` renders exactly as it did before the slot existed.
    expect(container.querySelector('[data-slot="placeholder-actions"]')).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1); // only the back link
  });
});
