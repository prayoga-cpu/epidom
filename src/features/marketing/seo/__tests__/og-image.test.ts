import { describe, it, expect } from "vitest";
import { ogEntries, findOgEntry } from "../og-image";
import { ogImageUrl } from "../og-url";
import { LANDING_PAGES } from "@/features/marketing/landing/content";
import { buildLandingMetadata } from "@/features/marketing/landing/metadata";
import { getAllBlogPostParams } from "@/features/marketing/blog/content";
import { COMPETITOR_COMPARISONS } from "@/features/marketing/compare/registry";
import { buildCompareMetadata } from "@/features/marketing/compare/render-compare-page";
import { getAuthoredLocales } from "@/lib/seo";

describe("share images", () => {
  it("exist for every landing page, blog post and authored comparison", () => {
    const keys = new Set(ogEntries().map((e) => `${e.kind}/${e.locale}/${e.slug}`));
    for (const p of LANDING_PAGES)
      expect(keys.has(`landing/${p.locale}/${p.slug}`), p.slug).toBe(true);
    for (const { locale, slug } of getAllBlogPostParams())
      expect(keys.has(`blog/${locale}/${slug}`)).toBe(true);
    for (const map of COMPETITOR_COMPARISONS) {
      for (const locale of getAuthoredLocales(map)) {
        expect(keys.has(`compare/${locale}/${map[locale]!.slug}`)).toBe(true);
      }
    }
    expect(keys.size).toBe(ogEntries().length);
  });

  it("are what the pages' metadata point at", () => {
    const page = LANDING_PAGES.find((p) => p.slug === "kalkulator-hpp")!;
    const md = buildLandingMetadata(page);
    const og = md.openGraph as { images?: Array<{ url: string }> };
    expect(og.images?.[0].url).toBe(ogImageUrl("landing", "id", "kalkulator-hpp"));
    const tw = md.twitter as { images?: string[] };
    expect(tw.images?.[0]).toBe(ogImageUrl("landing", "id", "kalkulator-hpp"));

    const sunday = COMPETITOR_COMPARISONS.find((m) => m.fr?.slug === "sunday")!;
    const compareMd = buildCompareMetadata(sunday, [], "id");
    // An /id visit is served the English copy, so it shares the English image.
    expect((compareMd.openGraph as { images?: Array<{ url: string }> }).images?.[0].url).toBe(
      ogImageUrl("compare", "en", "sunday")
    );
  });

  it("finds an entry by its URL parts, and nothing else", () => {
    expect(findOgEntry("landing", "id", "kalkulator-hpp")?.title).toBeTruthy();
    expect(findOgEntry("landing", "fr", "kalkulator-hpp")).toBeUndefined();
    expect(findOgEntry("nope", "fr", "x")).toBeUndefined();
  });
});
