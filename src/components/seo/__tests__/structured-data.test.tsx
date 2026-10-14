import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_PRICE_CURRENCY, PLAN_PRICING } from "@/lib/constants/plan-pricing";
import {
  BreadcrumbStructuredData,
  OrganizationStructuredData,
  ProductStructuredData,
  WebsiteStructuredData,
} from "../structured-data";

/** The JSON-LD object a component put in its <script type="application/ld+json">. */
function jsonLdOf(ui: ReactElement): Record<string, unknown> {
  const { container } = render(ui);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "");
}

describe("site-wide JSON-LD only states what the site can back up", () => {
  it("WebSite declares no SearchAction: there is no /search page", () => {
    const data = jsonLdOf(<WebsiteStructuredData locale="fr" />);
    expect(data["@type"]).toBe("WebSite");
    expect(data).not.toHaveProperty("potentialAction");
    expect(JSON.stringify(data)).not.toMatch(/search_term_string|\/search/);
  });

  it("no site-wide entity carries a founding date", () => {
    for (const ui of [
      <WebsiteStructuredData key="w" locale="fr" />,
      <OrganizationStructuredData key="o" locale="fr" />,
      <ProductStructuredData key="p" locale="fr" />,
    ]) {
      expect(jsonLdOf(ui)).not.toHaveProperty("foundingDate");
    }
  });

  it("Organization keeps its real details", () => {
    const data = jsonLdOf(<OrganizationStructuredData locale="fr" />);
    expect(data["@type"]).toBe("Organization");
    expect(data.url).toBe("https://epidom.fr");
    expect(data.parentOrganization).toMatchObject({ name: "Prionation" });
  });
});

const LOCALES: Locale[] = ["fr", "id", "en"];

describe("JSON-LD speaks the page's language and only uses properties its type has", () => {
  it.each(LOCALES)("WebSite in %s: language set, no Organization-only fields", (locale) => {
    const data = jsonLdOf(<WebsiteStructuredData locale={locale} />);
    expect(data.inLanguage).toBe({ fr: "fr-FR", id: "id-ID", en: "en" }[locale]);
    for (const field of ["logo", "contactPoint", "sameAs"]) expect(data).not.toHaveProperty(field);
  });

  it("describes Epidom in each language, never the English text on a French page", () => {
    const fr = jsonLdOf(<WebsiteStructuredData locale="fr" />).description as string;
    const id = jsonLdOf(<WebsiteStructuredData locale="id" />).description as string;
    const en = jsonLdOf(<WebsiteStructuredData locale="en" />).description as string;
    expect(new Set([fr, id, en]).size).toBe(3);
    expect(fr).toMatch(/caisse/i);
    expect(id).toMatch(/kasir/i);
    expect(fr).not.toMatch(/warung/i);
  });

  it("SoftwareApplication carries no logo, contact point or sameAs", () => {
    const data = jsonLdOf(<ProductStructuredData locale="en" />);
    expect(data["@type"]).toBe("SoftwareApplication");
    for (const field of ["logo", "contactPoint", "sameAs"]) expect(data).not.toHaveProperty(field);
  });

  it.each(LOCALES)(
    "%s: offers the three self-serve plans at the pricing table's monthly price, in the page's currency",
    (locale) => {
      const currency = LOCALE_PRICE_CURRENCY[locale];
      const offers = jsonLdOf(<ProductStructuredData locale={locale} />).offers as Array<{
        name: string;
        price: string;
        priceCurrency: string;
      }>;
      expect(offers.map((o) => [o.name, o.price, o.priceCurrency])).toEqual([
        ["Free", "0", currency],
        ["POS", String(PLAN_PRICING.POS[currency].monthly), currency],
        ["Operations", String(PLAN_PRICING.OPERATIONS[currency].monthly), currency],
      ]);
    }
  );

  it("never puts online ordering on the free plan (it is a POS feature)", () => {
    for (const locale of LOCALES) {
      const offers = jsonLdOf(<ProductStructuredData locale={locale} />).offers as Array<{
        name: string;
        description: string;
      }>;
      expect(offers[0].description).not.toMatch(/order|commande|pesan/i);
    }
  });

  it("Organization keeps the support contact point and logo", () => {
    const data = jsonLdOf(<OrganizationStructuredData locale="id" />);
    expect(data).toHaveProperty("logo");
    expect(data).toHaveProperty("contactPoint");
  });
});

describe("BreadcrumbList", () => {
  it("numbers the items from 1 and keeps their URLs", () => {
    const data = jsonLdOf(
      <BreadcrumbStructuredData
        items={[
          { name: "Accueil", url: "https://epidom.fr/" },
          { name: "Blog", url: "https://epidom.fr/blog" },
        ]}
      />
    );
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://epidom.fr/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://epidom.fr/blog" },
    ]);
  });
});
