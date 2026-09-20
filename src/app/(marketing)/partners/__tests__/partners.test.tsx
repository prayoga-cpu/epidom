import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import {
  SUPPORT_EMAIL_ADDRESSES,
  SUPPORT_EMAIL_DISPLAY,
  WHATSAPP_NUMBERS,
  supportMailto,
  whatsappHref,
} from "@/lib/constants/contact";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

const mocks = vi.hoisted(() => ({ trackConversion: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackConversion: mocks.trackConversion }));

import { PartnersClient } from "../client";

const DICTS = { en, fr, id } as const;

function renderPage(locale: Locale, ui: ReactElement = <PartnersClient />) {
  return render(<EagerI18nProvider initialLocale={locale}>{ui}</EagerI18nProvider>);
}

const anchors = (root: HTMLElement) => Array.from(root.querySelectorAll("a"));
const whatsappLinks = (root: HTMLElement) =>
  anchors(root).filter((a) => a.href.startsWith("https://wa.me/"));
const mailtoLinks = (root: HTMLElement) =>
  anchors(root).filter((a) => a.getAttribute("href")?.startsWith("mailto:"));

/** Click without jsdom trying (and logging that it can't) to navigate. */
function click(el: Element) {
  el.addEventListener("click", (e) => e.preventDefault(), { once: true });
  fireEvent.click(el);
}

describe("PartnersClient — supplier application path", () => {
  it("offers one prefilled WhatsApp link to the France number on the French page", () => {
    const { container } = renderPage("fr");
    const links = whatsappLinks(container);

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(
      whatsappHref(WHATSAPP_NUMBERS.fr.number, fr.partners.supplier.msgGeneric)
    );
    expect(links[0].getAttribute("href")).toContain("text=Bonjour%2C%20je%20suis%20fournisseur");
    expect(links[0].textContent).toBe(fr.partners.supplier.whatsappCta);
    // A deep link out of the site: new tab, and no window.opener handed over.
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("offers one prefilled WhatsApp link to the Indonesia number on the Indonesian page", () => {
    const { container } = renderPage("id");
    const links = whatsappLinks(container);

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(
      whatsappHref(WHATSAPP_NUMBERS.id.number, id.partners.supplier.msgGeneric)
    );
    expect(links[0].textContent).toBe(id.partners.supplier.whatsappCta);
  });

  it("offers both markets, France first, on the English page", () => {
    const { container } = renderPage("en");
    const links = whatsappLinks(container);

    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      whatsappHref(WHATSAPP_NUMBERS.fr.number, en.partners.supplier.msgGeneric),
      whatsappHref(WHATSAPP_NUMBERS.id.number, en.partners.supplier.msgGeneric),
    ]);
    expect(links[0].textContent).toBe(`${en.partners.supplier.whatsappCta} (France)`);
    expect(links[1].textContent).toBe(`${en.partners.supplier.whatsappCta} (Indonesia)`);
  });

  it.each(["en", "fr", "id"] as const)(
    "puts the picked category into the message (%s) and toggles back off",
    (locale) => {
      const dict = DICTS[locale].partners.supplier;
      const { container, getByRole } = renderPage(locale);
      // The `text` query value of every WhatsApp link currently on the page.
      const sentTexts = () =>
        whatsappLinks(container).map((a) => a.getAttribute("href")?.split("?text=")[1]);

      const chip = (label: string) =>
        Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label)!;

      const coffee = chip(dict.catCoffee);
      expect(coffee.getAttribute("aria-pressed")).toBe("false");

      click(coffee);
      expect(coffee.getAttribute("aria-pressed")).toBe("true");
      expect(sentTexts()).toEqual(sentTexts().map(() => encodeURIComponent(dict.msgCoffee)));
      expect(container.textContent).toContain(dict.msgCoffee);

      // Switching category replaces, never stacks.
      click(chip(dict.catBakery));
      expect(coffee.getAttribute("aria-pressed")).toBe("false");
      expect(sentTexts()).toEqual(sentTexts().map(() => encodeURIComponent(dict.msgBakery)));

      // Tapping the picked chip again clears it: back to the generic message.
      click(chip(dict.catBakery));
      expect(sentTexts()).toEqual(sentTexts().map(() => encodeURIComponent(dict.msgGeneric)));

      // The chip row is a labelled group, not a bare pile of buttons.
      expect(getByRole("group", { name: dict.pickLabel })).toBeTruthy();
    }
  );

  it.each(["en", "fr", "id"] as const)(
    "addresses the secondary mailto to the support inbox with a %s subject",
    (locale) => {
      const dict = DICTS[locale].partners;
      const { container } = renderPage(locale);
      const hrefs = mailtoLinks(container).map((a) => a.getAttribute("href"));

      expect(hrefs).toEqual([
        supportMailto(dict.supplier.emailSubject),
        supportMailto(dict.types.emailSubject),
      ]);
      for (const href of hrefs) {
        for (const address of SUPPORT_EMAIL_ADDRESSES) expect(href).toContain(address);
        expect(href).toContain("?subject=");
      }
    }
  );

  it("encodes the subject so accents and spaces survive in the mailto", () => {
    const { container } = renderPage("fr");
    const [supplierMailto] = mailtoLinks(container);
    expect(supplierMailto.getAttribute("href")).toContain(
      `?subject=${encodeURIComponent("Partenariat fournisseur")}`
    );
  });

  it("shows the support addresses as text, from the shared constant", () => {
    const { container } = renderPage("fr");
    expect(container.textContent).toContain(SUPPORT_EMAIL_DISPLAY);
    expect(container.textContent).not.toContain("{emails}");
  });

  it("tracks a WhatsApp click with the supplier category, and email clicks separately", () => {
    const { container } = renderPage("fr");
    const frDict = fr.partners.supplier;
    const coffee = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === frDict.catCoffee
    )!;
    click(coffee);

    click(whatsappLinks(container)[0]);
    expect(mocks.trackConversion).toHaveBeenLastCalledWith(
      "contact_whatsapp",
      expect.objectContaining({ event_label: "partners_supplier", supplier_category: "coffee" })
    );

    const [supplierMailto, otherMailto] = mailtoLinks(container);
    click(supplierMailto);
    expect(mocks.trackConversion).toHaveBeenLastCalledWith("contact_email", {
      event_label: "partners_supplier",
    });
    click(otherMailto);
    expect(mocks.trackConversion).toHaveBeenLastCalledWith("contact_email", {
      event_label: "partners_other",
    });
  });

  it("reports no category when none was picked", () => {
    const { container } = renderPage("id");
    click(whatsappLinks(container)[0]);
    expect(mocks.trackConversion).toHaveBeenLastCalledWith(
      "contact_whatsapp",
      expect.objectContaining({ supplier_category: "unspecified" })
    );
  });

  it("keeps every tappable control at least 44px tall", () => {
    const { container } = renderPage("en");
    for (const chip of Array.from(container.querySelectorAll("button"))) {
      expect(chip.className).toContain("min-h-11");
    }
    for (const link of [...whatsappLinks(container), ...mailtoLinks(container)]) {
      expect(link.className).toContain("min-h-12");
    }
  });
});

describe("PartnersClient — page content", () => {
  it.each(["en", "fr", "id"] as const)("renders the %s page without a missing key", (locale) => {
    const dict = DICTS[locale].partners;
    const { container } = renderPage(locale);
    const text = container.textContent ?? "";

    expect(container.querySelector("h1")?.textContent).toBe(dict.title);
    expect(text).toContain(dict.supplier.title);
    expect(text).toContain(dict.types.title);
    expect(text).toContain(dict.integrations.title);
    for (const line of [
      dict.types.integration,
      dict.types.reseller,
      dict.types.whiteLabel,
      dict.types.referral,
      dict.types.consultants,
      dict.integrations.stripe,
      dict.integrations.xendit,
      dict.integrations.whatsapp,
    ]) {
      expect(text).toContain(line);
    }
    expect(text).not.toMatch(/\bpartners\.[a-zA-Z]/);
  });

  it("is really translated: the French and Indonesian pages differ from English", () => {
    const enText = renderPage("en").container.textContent;
    const frText = renderPage("fr").container.textContent;
    const idText = renderPage("id").container.textContent;
    expect(frText).not.toBe(enText);
    expect(idText).not.toBe(enText);
    expect(frText).not.toBe(idText);
  });

  it("does not promise commission rates or terms the old page did not", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      const text = renderPage(locale).container.textContent ?? "";
      // The old copy said "recurring commission" and "a free period", nothing numeric.
      expect(text).not.toMatch(/\d+\s?%/);
      expect(text).not.toMatch(/Rp\s?\d|€\s?\d|\d\s?€/);
    }
  });
});
