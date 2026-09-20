import { describe, expect, it } from "vitest";
import { OG_LOCALE, buildLocalizedMetadata, generateMetadata } from "../seo";

const base = { basePath: "/pricing", title: "T", description: "D" } as const;
const languagesOf = (md: ReturnType<typeof buildLocalizedMetadata>) =>
  md.alternates?.languages as Record<string, string>;

describe("buildLocalizedMetadata", () => {
  it("points the canonical, og:url and og:locale at the served locale", () => {
    const md = buildLocalizedMetadata({ ...base, locale: "id" });
    expect(md.alternates?.canonical).toBe("https://epidom.fr/id/pricing");
    expect(md.openGraph?.url).toBe("https://epidom.fr/id/pricing");
    expect((md.openGraph as { locale?: string }).locale).toBe(OG_LOCALE.id);
  });

  it("uses the unprefixed URL for fr and the root path for home", () => {
    expect(buildLocalizedMetadata({ ...base, locale: "fr" }).alternates?.canonical).toBe(
      "https://epidom.fr/pricing"
    );
    const home = buildLocalizedMetadata({ ...base, basePath: "/", locale: "en" });
    expect(home.alternates?.canonical).toBe("https://epidom.fr/en");
    expect(languagesOf(home)).toMatchObject({
      fr: "https://epidom.fr/",
      "x-default": "https://epidom.fr/",
    });
  });

  it("keeps the share image and site name while overriding the text", () => {
    const md = buildLocalizedMetadata({
      ...base,
      locale: "fr",
      ogTitle: "OG T",
      ogDescription: "OG D",
    });
    const og = md.openGraph as {
      title?: string;
      description?: string;
      images?: unknown[];
      siteName?: string;
    };
    expect(og.title).toBe("OG T");
    expect(og.description).toBe("OG D");
    expect(og.images?.length).toBeGreaterThan(0);
    expect(og.siteName).toBe("EPIDOM");
    const tw = md.twitter as {
      title?: string;
      description?: string;
      site?: string;
      images?: unknown[];
    };
    expect(tw.title).toBe("OG T");
    expect(tw.description).toBe("OG D");
    expect(tw.site).toBe("@epidom");
    expect(tw.images?.length).toBeGreaterThan(0);
  });

  it("falls back to the page title and description for social cards", () => {
    const md = buildLocalizedMetadata({ ...base, locale: "en" });
    expect(md.openGraph?.title).toBe("T");
    expect((md.twitter as { description?: string }).description).toBe("D");
  });

  it("canonicalises to the served copy when the page is not authored in the asked locale", () => {
    const md = buildLocalizedMetadata({ ...base, locale: "id", authoredLocales: ["fr", "en"] });
    expect(md.alternates?.canonical).toBe("https://epidom.fr/en/pricing");
    expect((md.openGraph as { locale?: string }).locale).toBe("en_US");
    expect(Object.keys(languagesOf(md)).sort()).toEqual(["en", "fr", "x-default"]);
  });

  it("passes keywords through", () => {
    expect(buildLocalizedMetadata({ ...base, locale: "fr", keywords: ["a", "b"] }).keywords).toBe(
      "a, b"
    );
  });
});

describe("site-wide defaults", () => {
  it("do not call the whole product free: only the storefront is", () => {
    const md = generateMetadata({});
    const text = JSON.stringify([md.description, md.openGraph, md.twitter]);
    expect(text).not.toMatch(/free storefront, online ordering|forever for F&B|No commission/i);
    expect(String(md.description)).toMatch(/storefront is free forever/);
  });
});
