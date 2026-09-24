import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_PRICE_CURRENCY, formatPlanPrice } from "@/lib/constants/plan-pricing";
import { DEFAULT_LOCALE, LOCALES, LOCALE_HEADER, getLocalizedPath } from "@/lib/i18n-routing";
import { OG_LOCALE } from "@/lib/seo";
import { PAGES, buildPageMetadata, pageMetadata, type MarketingMetaPage } from "../page-metadata";

const mocks = vi.hoisted(() => ({ locale: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(mocks.locale ? { "x-epidom-locale": mocks.locale } : {}),
}));

const SITE = "https://epidom.fr";
const KEYS = Object.keys(PAGES) as MarketingMetaPage[];

/** Page file (under src/app/(marketing)/) that must export the metadata for each key. */
const PAGE_FILES: Record<MarketingMetaPage, string> = {
  home: "page.tsx",
  pricing: "pricing/page.tsx",
  about: "about/page.tsx",
  contact: "contact/page.tsx",
  services: "services/page.tsx",
  partners: "partners/page.tsx",
  careers: "careers/page.tsx",
  press: "press/page.tsx",
  changelog: "changelog/page.tsx",
  compare: "compare/page.tsx",
  "compare-delivery-commission": "compare/delivery-commission/page.tsx",
  "build-with-us": "build-with-us/page.tsx",
  blog: "blog/page.tsx",
  docs: "docs/page.tsx",
};

/** "Blog" is the word in all three languages. */
const SHARED_TITLE: Partial<Record<MarketingMetaPage, Locale[][]>> = {
  blog: [
    ["fr", "en"],
    ["fr", "id"],
    ["en", "id"],
  ],
};

const NBSP = String.fromCharCode(0xa0);
const nbspToSpace = (text: string) => text.split(NBSP).join(" ");
const titleOf = (md: ReturnType<typeof buildPageMetadata>) =>
  (md.title as { default: string }).default;
const canonicalOf = (md: ReturnType<typeof buildPageMetadata>) =>
  md.alternates?.canonical as string;
const languagesOf = (md: ReturnType<typeof buildPageMetadata>) =>
  md.alternates?.languages as Record<string, string>;

const CASES = KEYS.flatMap((page) => LOCALES.map((locale) => [page, locale] as const));

describe.each(CASES)("%s in %s", (page, locale) => {
  const md = buildPageMetadata(page, locale);
  const url = `${SITE}${getLocalizedPath(PAGES[page].path, locale)}`;

  it("canonicalises to the URL of the locale being served", () => {
    expect(canonicalOf(md)).toBe(url);
    expect(md.openGraph?.url).toBe(url);
  });

  it("advertises fr, id and en plus x-default on fr", () => {
    const languages = languagesOf(md);
    expect(Object.keys(languages).sort()).toEqual(["en", "fr", "id", "x-default"]);
    for (const l of LOCALES) {
      expect(languages[l]).toBe(`${SITE}${getLocalizedPath(PAGES[page].path, l)}`);
    }
    expect(languages["x-default"]).toBe(languages[DEFAULT_LOCALE]);
  });

  it("carries the locale in og:locale", () => {
    expect((md.openGraph as { locale?: string }).locale).toBe(OG_LOCALE[locale]);
  });

  it("has a title and description, and no unfilled placeholder", () => {
    expect(titleOf(md).trim()).not.toBe("");
    expect(String(md.description).trim()).not.toBe("");
    const all = JSON.stringify(md);
    expect(all).not.toMatch(/\{price\}/);
  });

  it("gives social cards the page's own text, not the English site default", () => {
    const og = md.openGraph as { title?: string; description?: string; images?: unknown };
    const tw = md.twitter as { title?: string; description?: string; card?: string };
    expect(tw.title).toBe(og.title);
    expect(tw.description).toBe(og.description);
    expect(tw.card).toBe("summary_large_image");
    expect(og.images).toBeTruthy();
  });

  it("does not bring back claims the site no longer makes", () => {
    const text = nbspToSpace(JSON.stringify(md));
    expect(text).not.toMatch(/500\+|20\+|5[- ]min|aggregateRating|★|\d\.\d\/5|all free/i);
  });

  if (locale === "fr") {
    it("puts a non-breaking space before : ; ? and !", () => {
      const text = [
        titleOf(md),
        md.description,
        (md.openGraph as { description?: string }).description,
      ]
        .filter(Boolean)
        .join("\n");
      expect(text).not.toMatch(/ [:;?!]/);
    });
  }
});

describe.each(KEYS)("%s copy across locales", (page) => {
  const copy = PAGES[page].copy;

  it("has a description that differs in every language", () => {
    const descriptions = LOCALES.map((l) => buildPageMetadata(page, l).description);
    expect(new Set(descriptions).size).toBe(LOCALES.length);
  });

  it("has a title that differs, bar words shared between languages", () => {
    const shared = SHARED_TITLE[page] ?? [];
    const allowed = (a: Locale, b: Locale) =>
      shared.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    for (const a of LOCALES) {
      for (const b of LOCALES) {
        if (a >= b || allowed(a, b)) continue;
        expect(copy[a].title, `${a} vs ${b}`).not.toBe(copy[b].title);
      }
    }
  });
});

describe("pricing description", () => {
  const otherPrices = (locale: Locale) =>
    LOCALES.filter((l) => l !== locale).flatMap((l) =>
      (["POS", "OPERATIONS"] as const).flatMap((plan) =>
        (["monthly", "yearly"] as const).map((interval) =>
          formatPlanPrice(plan, LOCALE_PRICE_CURRENCY[l], interval)
        )
      )
    );

  it.each(LOCALES)("quotes the %s price in the %s currency and no other", (locale) => {
    const md = buildPageMetadata("pricing", locale);
    const text = nbspToSpace(
      [md.description, (md.openGraph as { description?: string }).description].join("\n")
    );
    const own = formatPlanPrice("POS", LOCALE_PRICE_CURRENCY[locale], "monthly");
    expect(nbspToSpace(String(md.description))).toContain(own);
    for (const price of otherPrices(locale)) expect(text).not.toContain(price);
  });

  it("uses EUR for fr, USD for en and IDR for id", () => {
    expect(nbspToSpace(String(buildPageMetadata("pricing", "fr").description))).toContain(
      "13,99 €"
    );
    expect(nbspToSpace(String(buildPageMetadata("pricing", "en").description))).toContain("$14.99");
    expect(nbspToSpace(String(buildPageMetadata("pricing", "id").description))).toContain(
      "Rp 229k"
    );
  });

  it("does not quote a price on any other page", () => {
    for (const page of KEYS.filter((k) => k !== "pricing")) {
      for (const locale of LOCALES) {
        expect(nbspToSpace(JSON.stringify(buildPageMetadata(page, locale)))).not.toMatch(
          /\$\d|\d,\d\d ?€|Rp ?\d/
        );
      }
    }
  });
});

describe("home description", () => {
  it.each(LOCALES)("does not call the cashier free in %s, and says it has a trial", (locale) => {
    const description = String(buildPageMetadata("home", locale).description);
    expect(description).not.toMatch(
      /all free|tout gratuit|semua gratis|free forever[^;.]*(pos|cashier)/i
    );
    // The storefront is free; the POS is described separately, as a trial.
    expect(description).toMatch(/14/);
  });
});

describe("about description", () => {
  // The About body says Epidom comes from the Prionation studio (Bali and Paris),
  // built with F&B operators, one link for menu, orders and payments. The team
  // roster ships empty (features/marketing/about/data/team.ts), so no snippet may
  // send anyone to "meet the team".
  const snippets = (locale: Locale) => {
    const md = buildPageMetadata("about", locale);
    return nbspToSpace(
      [md.description, (md.openGraph as { description?: string }).description].join("\n")
    );
  };

  it.each(LOCALES)(
    "%s: is drawn from the About page, not an origin story or a team roster",
    (locale) => {
      const text = snippets(locale);
      expect(text).toMatch(/Prionation/);
      expect(text).toMatch(/Bali/);
      expect(text).toMatch(/Paris/);
      expect(text).not.toMatch(
        /meet the team|d[ée]couvrez l'[ée]quipe|kenali tim|one caf[ée]|un caf[ée]|satu kafe|spreadsheet|tableur|real counter|vrai comptoir|meja kasir/i
      );
    }
  );

  it("id speaks to the reader as Anda, like the rest of the marketing copy", () => {
    expect(snippets("id")).toMatch(/\bAnda\b/);
    expect(snippets("id")).not.toMatch(/\bkamu\b/i);
  });
});

describe("partners description", () => {
  it("uses American spelling in English, like the rest of the site copy", () => {
    const text = String(buildPageMetadata("partners", "en").description);
    expect(text).toMatch(/white-label programs\./);
    expect(text).not.toMatch(/programmes/);
  });

  it("keeps the French word as it is spelled in French", () => {
    expect(String(buildPageMetadata("partners", "fr").description)).toMatch(/programmes/);
  });
});

describe("page files", () => {
  const appDir = resolve(process.cwd(), "src/app/(marketing)");

  it.each(KEYS)(
    "%s exports locale-aware generateMetadata, not a static metadata object",
    (page) => {
      const source = readFileSync(resolve(appDir, PAGE_FILES[page]), "utf8");
      expect(source).not.toMatch(/export\s+const\s+metadata\b/);
      expect(source).toContain(`export const generateMetadata = pageMetadata("${page}");`);
    }
  );
});

describe("pageMetadata()", () => {
  beforeEach(() => {
    mocks.locale = undefined;
  });

  it.each(LOCALES)("reads the request locale from the proxy header (%s)", async (locale) => {
    mocks.locale = locale;
    const md = await pageMetadata("pricing")();
    expect(canonicalOf(md)).toBe(`${SITE}${getLocalizedPath("/pricing", locale)}`);
  });

  it("falls back to fr when the header is missing", async () => {
    const md = await pageMetadata("about")();
    expect(canonicalOf(md)).toBe(`${SITE}/about`);
    expect((md.openGraph as { locale?: string }).locale).toBe("fr_FR");
  });

  it("falls back to fr when the header holds something else", async () => {
    mocks.locale = "de";
    const md = await pageMetadata("about")();
    expect(canonicalOf(md)).toBe(`${SITE}/about`);
  });

  it("uses the same header name the proxy sets", () => {
    expect(LOCALE_HEADER).toBe("x-epidom-locale");
  });
});
