import { describe, it, expect, vi } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, LOCALES } from "@/lib/i18n-routing";
import { OG_LOCALE } from "@/lib/seo";
import { getAllBlogPostParams, getBlogPost } from "@/features/marketing/blog/content";

// The locale header the proxy sets on a request; null = header absent.
let requestLocale: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => {
    const h = new Headers();
    if (requestLocale) h.set(LOCALE_HEADER, requestLocale);
    return h;
  },
}));

// Only the metadata is under test, not the article markup.
vi.mock("@/features/marketing/blog/components/blog-post-view", () => ({
  BlogPostView: () => null,
}));

import { generateMetadata } from "@/app/(marketing)/blog/[slug]/page";

const BASE = "https://epidom.fr";
const urlOf = (locale: Locale, slug: string) =>
  `${BASE}${locale === "fr" ? "" : `/${locale}`}/blog/${slug}`;

async function metadataFor(locale: Locale, slug: string) {
  requestLocale = locale;
  const md = await generateMetadata({ params: Promise.resolve({ slug }) });
  return {
    md,
    canonical: md.alternates?.canonical as string,
    languages: md.alternates?.languages as Record<string, string>,
  };
}

const PARAMS = getAllBlogPostParams();

describe("blog article hreflang", () => {
  it("a French article claims only itself: no /id or /en alternate that would 404", async () => {
    const { slug } = PARAMS.find((p) => p.locale === "fr")!;
    // The reason an alternate would 404: the slug is French-only.
    expect(getBlogPost("id", slug)).toBeUndefined();
    expect(getBlogPost("en", slug)).toBeUndefined();

    const { canonical, languages } = await metadataFor("fr", slug);
    expect(canonical).toBe(urlOf("fr", slug));
    expect(languages).toEqual({ fr: urlOf("fr", slug), "x-default": urlOf("fr", slug) });
    expect(Object.keys(languages)).not.toContain("id");
    expect(Object.keys(languages)).not.toContain("en");
    expect(JSON.stringify(languages)).not.toMatch(/\/id\/|\/en\//);
  });

  it.each(PARAMS)(
    "$locale/$slug: canonical is its own URL and every alternate resolves to a real article",
    async ({ locale, slug }) => {
      const { canonical, languages } = await metadataFor(locale, slug);
      expect(canonical).toBe(urlOf(locale, slug));

      // Every URL the page advertises is the page itself.
      for (const url of Object.values(languages)) expect(url).toBe(canonical);
      expect(languages[locale]).toBe(canonical);
      for (const other of LOCALES.filter((l) => l !== locale)) {
        expect(Object.keys(languages), `${other} alternate`).not.toContain(other);
        expect(getBlogPost(other, slug), `${slug} exists in ${other}`).toBeUndefined();
      }
    }
  );
});

describe("blog article social card", () => {
  it.each(PARAMS)(
    "$locale/$slug: og:locale follows the article's language and the share image is kept",
    async ({ locale, slug }) => {
      const post = getBlogPost(locale, slug)!;
      const { md, canonical } = await metadataFor(locale, slug);
      const og = md.openGraph as {
        locale?: string;
        url?: string;
        title?: string;
        description?: string;
        images?: unknown[];
      };
      const tw = md.twitter as { title?: string; description?: string; images?: unknown[] };

      expect(og.locale).toBe(OG_LOCALE[locale]);
      expect(og.url).toBe(canonical);
      expect(og.title).toBe(post.title);
      expect(og.description).toBe(post.description);
      expect(og.images?.length).toBeGreaterThan(0);

      // Twitter carries the article's own text, not the English site default.
      expect(tw.title).toBe(post.title);
      expect(tw.description).toBe(post.description);
      expect(tw.images?.length).toBeGreaterThan(0);
    }
  );

  it("keeps the browser title as `<title> — EPIDOM`", async () => {
    const { slug } = PARAMS.find((p) => p.locale === "en")!;
    const { md } = await metadataFor("en", slug);
    expect((md.title as { default: string }).default).toBe(
      `${getBlogPost("en", slug)!.title} — EPIDOM`
    );
  });
});

describe("blog article that does not exist in the requested locale", () => {
  it("returns the not-found title and no alternates", async () => {
    // an English slug asked for on the French site is a 404 (no cross-locale fallback)
    const { slug } = PARAMS.find((p) => p.locale === "en")!;
    requestLocale = "fr";
    const md = await generateMetadata({ params: Promise.resolve({ slug }) });
    expect(md.title).toBe("Not found | Epidom");
    expect(md.alternates).toBeUndefined();
  });
});
