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

import { CareersClient } from "../client";

const DICTS = { en, fr, id } as const;

function renderPage(locale: Locale) {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <CareersClient />
    </EagerI18nProvider>
  );
}

const mailtoLinks = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("a")).filter((a) =>
    a.getAttribute("href")?.startsWith("mailto:")
  );

describe("CareersClient", () => {
  it.each(["en", "fr", "id"] as const)(
    "renders the %s page with a working mailto call to action",
    (locale) => {
      const dict = DICTS[locale].careers;
      const { container } = renderPage(locale);

      expect(container.querySelector("h1")?.textContent).toBe(dict.title);

      // The CTA the page used to lack: a real mailto to the support inbox, with
      // a subject already written in the visitor's language.
      const links = mailtoLinks(container);
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toBe(dict.cta);
      expect(links[0].getAttribute("href")).toBe(supportMailto(dict.emailSubject));

      const text = container.textContent ?? "";
      expect(text).toContain(dict.how.team);
      expect(text).toContain(dict.how.noRoles);
      expect(text).not.toMatch(/\bcareers\.[a-zA-Z]/);
    }
  );

  it("still shows the addresses as plain text, taken from the shared constant", () => {
    const { container } = renderPage("fr");
    expect(container.textContent).toContain(
      fr.careers.apply.send.replace("{emails}", SUPPORT_EMAIL_DISPLAY)
    );
    expect(container.textContent).not.toContain("{emails}");
  });

  it("encodes the prefilled subject", () => {
    const { container } = renderPage("fr");
    expect(mailtoLinks(container)[0].getAttribute("href")).toContain(
      `?subject=${encodeURIComponent("Rejoindre l'équipe Epidom")}`
    );
  });

  it("places the call to action in the actions slot, at least 48px tall", () => {
    const { container } = renderPage("en");
    const slot = container.querySelector('[data-slot="placeholder-actions"]');
    expect(slot).not.toBeNull();
    const cta = slot!.querySelector("a")!;
    expect(cta.className).toContain("min-h-12");
    expect(cta.getAttribute("target")).toBeNull();
  });

  it("tracks the click as a careers email conversion", () => {
    const { container } = renderPage("en");
    const cta = mailtoLinks(container)[0];
    cta.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(cta);
    expect(mocks.trackConversion).toHaveBeenCalledWith("contact_email", {
      event_label: "careers",
    });
  });

  it("sends the back link to the home page of the visitor's own locale", () => {
    const backHref = (locale: Locale) => {
      const { container, unmount } = renderPage(locale);
      const links = Array.from(container.querySelectorAll("a")).filter(
        (a) => !a.getAttribute("href")?.startsWith("mailto:")
      );
      const href = links[links.length - 1].getAttribute("href");
      unmount();
      return href;
    };
    expect(backHref("fr")).toBe("/");
    expect(backHref("id")).toBe("/id");
    expect(backHref("en")).toBe("/en");
  });
});
