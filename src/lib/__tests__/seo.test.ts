import { describe, it, expect } from "vitest";
import {
  buildAuthoredHreflang,
  buildLocaleAlternates,
  generateMetadata,
  generateStructuredData,
  getAuthoredLocales,
  resolveServedLocale,
} from "../seo";
import { SUPPORT_EMAIL_PRIMARY } from "../constants/contact";

const languagesOf = (md: ReturnType<typeof generateMetadata>) =>
  md.alternates?.languages as Record<string, string> | undefined;

describe("getAuthoredLocales", () => {
  it("keeps only locales that have content, in the map's own key order", () => {
    expect(getAuthoredLocales({ id: "x", en: "y" })).toEqual(["id", "en"]);
    expect(getAuthoredLocales({ en: "y", fr: "x" })).toEqual(["en", "fr"]);
  });

  it("ignores explicitly undefined entries", () => {
    expect(getAuthoredLocales({ fr: undefined, en: { a: 1 } })).toEqual(["en"]);
  });
});

describe("resolveServedLocale", () => {
  it("serves the visitor's own locale when it is authored", () => {
    expect(resolveServedLocale(["fr", "en"], "fr")).toBe("fr");
    expect(resolveServedLocale(["id", "en"], "id")).toBe("id");
  });

  it("falls back to English when the visitor's locale is not authored", () => {
    expect(resolveServedLocale(["fr", "en"], "id")).toBe("en");
    expect(resolveServedLocale(["id", "en"], "fr")).toBe("en");
  });

  it("falls back to the first authored locale when there is no English either", () => {
    expect(resolveServedLocale(["id", "fr"], "en")).toBe("id");
    expect(resolveServedLocale(["fr"], "id")).toBe("fr");
  });
});

describe("buildAuthoredHreflang", () => {
  it("lists only the authored locales, with x-default on fr when fr is authored", () => {
    expect(buildAuthoredHreflang("/compare/sunday", ["fr", "en"])).toEqual({
      fr: "https://epidom.fr/compare/sunday",
      en: "https://epidom.fr/en/compare/sunday",
      "x-default": "https://epidom.fr/compare/sunday",
    });
  });

  it("puts x-default on en when fr is not authored", () => {
    expect(buildAuthoredHreflang("/compare/moka", ["id", "en"])).toEqual({
      id: "https://epidom.fr/id/compare/moka",
      en: "https://epidom.fr/en/compare/moka",
      "x-default": "https://epidom.fr/en/compare/moka",
    });
  });

  it("puts x-default on the first authored locale when only id is authored", () => {
    expect(buildAuthoredHreflang("/compare/x", ["id"])).toEqual({
      id: "https://epidom.fr/id/compare/x",
      "x-default": "https://epidom.fr/id/compare/x",
    });
  });

  it("never invents a locale that was not authored", () => {
    const languages = buildAuthoredHreflang("/compare/sunday", ["fr", "en"]);
    expect(Object.keys(languages)).not.toContain("id");
  });
});

describe("buildLocaleAlternates", () => {
  it("canonicalizes an authored locale to its own URL", () => {
    const alt = buildLocaleAlternates({
      basePath: "/compare/sunday",
      authoredLocales: ["fr", "en"],
      requestedLocale: "fr",
    });
    expect(alt.servedLocale).toBe("fr");
    expect(alt.canonical).toBe("https://epidom.fr/compare/sunday");
  });

  it("canonicalizes a fallback visit to the URL of the locale actually served", () => {
    const alt = buildLocaleAlternates({
      basePath: "/compare/sunday",
      authoredLocales: ["fr", "en"],
      requestedLocale: "id",
    });
    expect(alt.servedLocale).toBe("en");
    expect(alt.canonical).toBe("https://epidom.fr/en/compare/sunday");
    // and hreflang still lists only what is authored
    expect(Object.keys(alt.languages).sort()).toEqual(["en", "fr", "x-default"]);
  });

  it("canonicalizes the unprefixed fr URL of an id+en page to the English copy it serves", () => {
    const alt = buildLocaleAlternates({
      basePath: "/compare/moka",
      authoredLocales: ["id", "en"],
      requestedLocale: "fr",
    });
    expect(alt.canonical).toBe("https://epidom.fr/en/compare/moka");
  });
});

describe("generateMetadata hreflang", () => {
  it("passes explicit alternates.languages through untouched", () => {
    const languages = {
      fr: "https://epidom.fr/compare/sunday",
      "x-default": "https://epidom.fr/compare/sunday",
    };
    const md = generateMetadata({
      canonical: "https://epidom.fr/en/compare/sunday",
      alternates: { languages },
    });
    expect(md.alternates?.canonical).toBe("https://epidom.fr/en/compare/sunday");
    expect(languagesOf(md)).toEqual(languages);
  });

  it("still lists all three locales, x-default on fr, for an unprefixed canonical", () => {
    const md = generateMetadata({ canonical: "https://epidom.fr/pricing" });
    expect(languagesOf(md)).toEqual({
      fr: "https://epidom.fr/pricing",
      id: "https://epidom.fr/id/pricing",
      en: "https://epidom.fr/en/pricing",
      "x-default": "https://epidom.fr/pricing",
    });
  });

  it("handles the home page canonical", () => {
    const md = generateMetadata({ canonical: "https://epidom.fr" });
    expect(languagesOf(md)).toMatchObject({
      fr: "https://epidom.fr/",
      id: "https://epidom.fr/id",
      en: "https://epidom.fr/en",
    });
  });

  it("claims only the page itself for a locale-prefixed canonical, never a re-prefixed URL", () => {
    const md = generateMetadata({ canonical: "https://epidom.fr/id/blog/some-post" });
    const languages = languagesOf(md)!;
    expect(languages).toEqual({ id: "https://epidom.fr/id/blog/some-post" });
    expect(JSON.stringify(languages)).not.toMatch(/\/id\/id\/|\/en\/id\//);
  });

  it("does the same for the en prefix", () => {
    const md = generateMetadata({ canonical: "https://epidom.fr/en/build-with-us" });
    expect(languagesOf(md)).toEqual({ en: "https://epidom.fr/en/build-with-us" });
  });
});

describe("generateStructuredData", () => {
  it("takes the JSON-LD contact email from the shared support constant", () => {
    const org = generateStructuredData("organization");
    expect(org.contactPoint).toEqual({
      "@type": "ContactPoint",
      contactType: "customer service",
      email: SUPPORT_EMAIL_PRIMARY,
    });
  });

  it("carries the same contact point on every structured-data type", () => {
    for (const type of ["website", "organization", "product", "service"] as const) {
      expect(generateStructuredData(type).contactPoint.email).toBe(SUPPORT_EMAIL_PRIMARY);
    }
  });

  it("still lets a caller override fields through `data`", () => {
    // Overrides a field the helper itself sets (this used to override foundingDate,
    // which the helper no longer emits, so it no longer proved anything).
    expect(generateStructuredData("organization", { name: "Epidom SAS" }).name).toBe("Epidom SAS");
  });

  it("asserts no founding date: nothing in the repo supports a year", () => {
    for (const type of ["website", "organization", "product", "service"] as const) {
      expect(generateStructuredData(type)).not.toHaveProperty("foundingDate");
    }
    expect(JSON.stringify(generateStructuredData("organization"))).not.toMatch(/2024/);
  });
});

describe("generateMetadata twitter card", () => {
  const twitterOf = (md: ReturnType<typeof generateMetadata>) =>
    md.twitter as { title?: string; description?: string; site?: string; images?: unknown[] };

  it("takes the page's Open Graph text when only openGraph is set, not the English site default", () => {
    const md = generateMetadata({
      title: "Politique de confidentialité — EPIDOM",
      description: "Comment Epidom collecte vos données.",
      openGraph: {
        title: "Politique de confidentialité",
        description: "Comment Epidom collecte vos données.",
      },
    });
    expect(twitterOf(md).title).toBe("Politique de confidentialité");
    expect(twitterOf(md).description).toBe("Comment Epidom collecte vos données.");
    expect(JSON.stringify(md.twitter)).not.toMatch(/Storefront, Online Ordering/);
    // the site-wide card settings still come along
    expect(twitterOf(md).site).toBe("@epidom");
    expect(twitterOf(md).images?.length).toBeGreaterThan(0);
  });

  it("lets an explicit twitter title and description win over Open Graph", () => {
    const md = generateMetadata({
      openGraph: { title: "OG T", description: "OG D" },
      twitter: { title: "TW T", description: "TW D" },
    });
    expect(twitterOf(md).title).toBe("TW T");
    expect(twitterOf(md).description).toBe("TW D");
  });

  it("follows the Open Graph text even when only one of the two is overridden", () => {
    const md = generateMetadata({
      openGraph: { title: "OG T", description: "OG D" },
      twitter: { title: "TW T" },
    });
    expect(twitterOf(md).title).toBe("TW T");
    expect(twitterOf(md).description).toBe("OG D");
  });

  it("mirrors the resolved Open Graph text, which itself falls back to the page title and description", () => {
    const md = generateMetadata({
      title: "Page",
      description: "About the page.",
      openGraph: { url: "https://epidom.fr/x" },
    });
    expect((md.openGraph as { title?: string }).title).toBe("Page");
    expect(twitterOf(md).title).toBe("Page");
    expect(twitterOf(md).description).toBe("About the page.");
  });

  it("keeps the site-wide card for a page that sets nothing", () => {
    const md = generateMetadata({});
    expect(twitterOf(md).title).toBe((md.openGraph as { title?: string }).title);
    expect(twitterOf(md).title).toMatch(/Epidom/);
  });
});
