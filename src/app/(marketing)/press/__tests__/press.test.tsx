import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { SUPPORT_EMAIL_DISPLAY, supportMailto } from "@/lib/constants/contact";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

const mocks = vi.hoisted(() => ({ trackConversion: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackConversion: mocks.trackConversion }));

import { PressClient } from "../client";

const DICTS = { en, fr, id } as const;

function renderPage(locale: Locale) {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <PressClient />
    </EagerI18nProvider>
  );
}

describe("PressClient", () => {
  it.each(["en", "fr", "id"] as const)(
    "renders the %s page with a media-inquiries mailto",
    (locale) => {
      const dict = DICTS[locale].press;
      const { container } = renderPage(locale);

      expect(container.querySelector("h1")?.textContent).toBe(dict.title);

      const mailtos = Array.from(container.querySelectorAll("a")).filter((a) =>
        a.getAttribute("href")?.startsWith("mailto:")
      );
      expect(mailtos).toHaveLength(1);
      expect(mailtos[0].textContent).toBe(dict.cta);
      expect(mailtos[0].getAttribute("href")).toBe(supportMailto(dict.emailSubject));

      const text = container.textContent ?? "";
      expect(text).toContain(dict.about.builtBy);
      expect(text).toContain(dict.about.markets);
      expect(text).toContain(dict.contact.reach.replace("{emails}", SUPPORT_EMAIL_DISPLAY));
      expect(text).not.toContain("{emails}");
      expect(text).not.toMatch(/\bpress\.[a-zA-Z]/);
    }
  );

  it("encodes the English subject in the mailto", () => {
    const { container } = renderPage("en");
    const cta = Array.from(container.querySelectorAll("a")).find((a) =>
      a.getAttribute("href")?.startsWith("mailto:")
    )!;
    expect(cta.getAttribute("href")).toBe(supportMailto("Media inquiry"));
    expect(cta.getAttribute("href")).toContain("?subject=Media%20inquiry");
  });

  it("does not claim a founding year the repository cannot back", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      const text = renderPage(locale).container.textContent ?? "";
      expect(text).not.toMatch(/founded|fondé|didirikan|2024/i);
    }
  });

  it("says assets are available on request and never links to a file", () => {
    const { container } = renderPage("en");
    expect(container.textContent).toContain(en.press.assets.logos);
    expect(container.textContent).toMatch(/available on request/);

    for (const a of Array.from(container.querySelectorAll("a"))) {
      const href = a.getAttribute("href") ?? "";
      expect(href).not.toMatch(/\.(svg|png|jpe?g|webp|zip|pdf)(\?|$)/i);
    }
  });

  it("tracks the click as a press email conversion", () => {
    const { container } = renderPage("fr");
    const cta = Array.from(container.querySelectorAll("a")).find((a) =>
      a.getAttribute("href")?.startsWith("mailto:")
    )!;
    cta.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(cta);
    expect(mocks.trackConversion).toHaveBeenCalledWith("contact_email", { event_label: "press" });
  });

  it("is really translated", () => {
    expect(renderPage("fr").container.textContent).not.toBe(renderPage("en").container.textContent);
    expect(renderPage("id").container.textContent).not.toBe(renderPage("en").container.textContent);
  });
});
