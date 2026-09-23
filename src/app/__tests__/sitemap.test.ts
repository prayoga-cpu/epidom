import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MetadataRoute } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALES, getLocalizedPath } from "@/lib/i18n-routing";
import { PAGES } from "@/features/marketing/seo/page-metadata";
import { getAllBlogPostParams, getBlogPosts } from "@/features/marketing/blog/content";
import { getAllDocsParams, getDocsGuides } from "@/features/marketing/docs/content";
import { klikitComparison } from "@/features/marketing/compare/data/klikit";
import { majooComparison } from "@/features/marketing/compare/data/majoo";
import { mokaComparison } from "@/features/marketing/compare/data/moka";
import { sumupPosProComparison } from "@/features/marketing/compare/data/sumup-pos-pro";
import { sundayComparison } from "@/features/marketing/compare/data/sunday";
import { zeltyComparison } from "@/features/marketing/compare/data/zelty";

// The DB-backed storefront list is the only thing the sitemap fetches at
// request time; everything else is static content.
let storefronts: () => Promise<Array<{ slug: string; updatedAt: Date }>>;
vi.mock("@/lib/services", () => ({
  storefrontService: { getPublishedSlugsForSitemap: () => storefronts() },
}));

import sitemap from "../sitemap";

type Entry = MetadataRoute.Sitemap[number];

const BASE = "https://epidom.fr";
const urlOf = (path: string, locale: Locale) => `${BASE}${getLocalizedPath(path, locale)}`;
const isoShaped = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

// A sentinel "now" far from any real content date: if an entry's lastModified
// is the request time, it serialises to this year and the test catches it.
const FAKE_NOW = new Date("2031-03-04T05:06:07.000Z");

const STOREFRONT_UPDATED = new Date("2026-08-01T10:00:00.000Z");

let entries: MetadataRoute.Sitemap;
const byUrl = (url: string): Entry | undefined => entries.find((e) => e.url === url);
const serialised = (e: Entry) =>
  e.lastModified instanceof Date ? e.lastModified.toISOString() : e.lastModified;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FAKE_NOW);
  storefronts = async () => [{ slug: "cafe-a", updatedAt: STOREFRONT_UPDATED }];
  entries = await sitemap();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sitemap lastModified", () => {
  it("never stamps an entry with the request time", () => {
    for (const e of entries) {
      expect(String(serialised(e) ?? "")).not.toContain("2031");
    }
  });

  it("leaves static routes without a lastModified rather than claiming one", () => {
    for (const path of [
      "/",
      "/pricing",
      "/about",
      "/contact",
      "/blog",
      "/docs",
      "/compare",
      "/compare/delivery-commission",
    ]) {
      for (const locale of ["fr", "id", "en"] as Locale[]) {
        const e = byUrl(urlOf(path, locale));
        expect(e, `${locale} ${path} should be in the sitemap`).toBeDefined();
        expect(e!.lastModified, `${locale} ${path}`).toBeUndefined();
      }
    }
  });

  it("gives every blog entry its own post's date", () => {
    const params = getAllBlogPostParams();
    expect(params.length).toBeGreaterThan(0);
    for (const { locale, slug } of params) {
      const post = getBlogPosts(locale).find((p) => p.slug === slug)!;
      const e = byUrl(urlOf(`/blog/${slug}`, locale));
      expect(e, `${locale}/${slug}`).toBeDefined();
      expect(e!.lastModified).toBe(post.date);
    }
  });

  it("gives every docs entry its own guide's date", () => {
    const params = getAllDocsParams();
    expect(params.length).toBeGreaterThan(0);
    for (const { locale, slug } of params) {
      const guide = getDocsGuides(locale).find((g) => g.slug === slug)!;
      const e = byUrl(urlOf(`/docs/${slug}`, locale));
      expect(e, `${locale}/${slug}`).toBeDefined();
      expect(e!.lastModified).toBe(guide.date);
    }
  });

  it("only ever emits valid ISO dates for blog and docs articles", () => {
    const articleEntries = entries.filter((e) => /\/(blog|docs)\/[^/]+$/.test(e.url));
    expect(articleEntries.length).toBeGreaterThan(0);
    for (const e of articleEntries) {
      expect(isoShaped(e.lastModified), e.url).toBe(true);
    }
  });

  it("leaves competitor comparison entries without a date (the data has none)", () => {
    const compare = entries.filter((e) =>
      /\/compare\/(moka|majoo|klikit|sunday|sumup-pos-pro|zelty)$/.test(e.url)
    );
    expect(compare.length).toBeGreaterThan(0);
    for (const e of compare) expect(e.lastModified, e.url).toBeUndefined();
  });

  it("keeps the storefront's own updatedAt", () => {
    const e = byUrl(`${BASE}/@cafe-a`);
    expect(e?.lastModified).toBe(STOREFRONT_UPDATED);
  });
});

describe("sitemap coverage", () => {
  it("does not list /payments, in any locale, or anything beneath it", () => {
    expect(entries.filter((e) => /\/payments(\/|$)/.test(e.url))).toEqual([]);
  });

  it("lists every static route once per locale, fr unprefixed", () => {
    expect(byUrl(`${BASE}/pricing`)).toBeDefined();
    expect(byUrl(`${BASE}/id/pricing`)).toBeDefined();
    expect(byUrl(`${BASE}/en/pricing`)).toBeDefined();
    expect(byUrl(`${BASE}/`)).toBeDefined();
  });

  it("has no duplicate URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("still returns the static entries when the database is unavailable", async () => {
    storefronts = async () => {
      throw new Error("db down");
    };
    const withoutDb = await sitemap();
    expect(withoutDb.find((e) => e.url.includes("/@"))).toBeUndefined();
    expect(withoutDb.find((e) => e.url === `${BASE}/pricing`)).toBeDefined();
  });
});

describe("sitemap vs the marketing PAGES table", () => {
  // PAGES paths that are deliberately absent from the sitemap, and why. Adding a
  // page to PAGES without listing it in sitemap.ts fails the test below until it
  // is either listed there or given a reason here.
  const NOT_IN_SITEMAP: Record<string, string> = {
    // A status board the team edits by hand: nothing to rank for. Still crawlable
    // (robots.txt allows it) and linked from the footer; same call as the legal
    // pages, which are also left out. See the comment above STATIC_ROUTES.
    "/status": "hand-updated status board, no search value",
  };

  const pagePaths = Object.values(PAGES).map((page) => page.path);

  it("lists every PAGES path in all three locales, unless it is on the exclusion list", () => {
    for (const path of pagePaths) {
      if (path in NOT_IN_SITEMAP) continue;
      for (const locale of LOCALES) {
        const entry = byUrl(urlOf(path, locale));
        expect(entry, `${locale} ${path} should be in the sitemap`).toBeDefined();
      }
    }
  });

  it("really leaves the excluded paths out, in every locale", () => {
    for (const path of Object.keys(NOT_IN_SITEMAP)) {
      for (const locale of LOCALES) {
        expect(byUrl(urlOf(path, locale)), `${locale} ${path}`).toBeUndefined();
      }
    }
  });

  it("only excludes paths that are in PAGES, so a stale exclusion cannot linger", () => {
    for (const path of Object.keys(NOT_IN_SITEMAP)) {
      expect(pagePaths, path).toContain(path);
    }
  });
});

describe("sitemap hreflang", () => {
  it("gives every static route alternates for all three locales, x-default on fr", () => {
    for (const locale of ["fr", "id", "en"] as Locale[]) {
      const languages = byUrl(urlOf("/pricing", locale))!.alternates?.languages;
      expect(languages).toEqual({
        fr: `${BASE}/pricing`,
        id: `${BASE}/id/pricing`,
        en: `${BASE}/en/pricing`,
        "x-default": `${BASE}/pricing`,
      });
    }
  });

  it("lists a competitor comparison only in the locales it is authored in", () => {
    // sunday: fr + en (French market), moka: id + en (Indonesian market)
    expect(byUrl(`${BASE}/compare/sunday`)).toBeDefined();
    expect(byUrl(`${BASE}/en/compare/sunday`)).toBeDefined();
    expect(byUrl(`${BASE}/id/compare/sunday`)).toBeUndefined();

    expect(byUrl(`${BASE}/id/compare/moka`)).toBeDefined();
    expect(byUrl(`${BASE}/en/compare/moka`)).toBeDefined();
    expect(byUrl(`${BASE}/compare/moka`)).toBeUndefined();
  });

  it("gives competitor entries hreflang for only their authored locales", () => {
    expect(byUrl(`${BASE}/compare/sunday`)!.alternates?.languages).toEqual({
      fr: `${BASE}/compare/sunday`,
      en: `${BASE}/en/compare/sunday`,
      "x-default": `${BASE}/compare/sunday`,
    });
    expect(byUrl(`${BASE}/id/compare/moka`)!.alternates?.languages).toEqual({
      id: `${BASE}/id/compare/moka`,
      en: `${BASE}/en/compare/moka`,
      "x-default": `${BASE}/en/compare/moka`,
    });
  });

  it("derives the listed locales from the comparison data for every competitor", () => {
    const maps = [
      mokaComparison,
      majooComparison,
      klikitComparison,
      sundayComparison,
      sumupPosProComparison,
      zeltyComparison,
    ];
    for (const map of maps) {
      const authored = (Object.keys(map) as Locale[]).filter((l) => map[l]);
      const slug = map[authored[0]]!.slug;
      for (const locale of ["fr", "id", "en"] as Locale[]) {
        const listed = byUrl(urlOf(`/compare/${slug}`, locale)) !== undefined;
        expect(listed, `${locale} ${slug}`).toBe(authored.includes(locale));
      }
    }
  });

  it("gives blog and docs entries no cross-locale alternates (content is not translated 1:1)", () => {
    for (const e of entries.filter((e) => /\/(blog|docs)\/[^/]+$/.test(e.url))) {
      expect(e.alternates, e.url).toBeUndefined();
    }
  });
});
