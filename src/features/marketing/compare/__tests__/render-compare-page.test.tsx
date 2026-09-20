import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER } from "@/lib/i18n-routing";

// The locale header the proxy sets on a request; null = header absent.
let requestLocale: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => {
    const h = new Headers();
    if (requestLocale) h.set(LOCALE_HEADER, requestLocale);
    return h;
  },
}));

// Only the data handed to the component matters here, not how it renders.
vi.mock("../components/competitor-comparison", () => ({
  CompetitorComparison: ({ data }: { data: { slug: string; eyebrow: string } }) => (
    <div data-testid="comparison">{`${data.slug}|${data.eyebrow}`}</div>
  ),
}));

import {
  buildCompareMetadata,
  CompareCompetitorPage,
  resolveCompareData,
} from "../render-compare-page";
import { klikitComparison } from "../data/klikit";
import { majooComparison } from "../data/majoo";
import { mokaComparison } from "../data/moka";
import { sumupPosProComparison } from "../data/sumup-pos-pro";
import { sundayComparison } from "../data/sunday";
import { zeltyComparison } from "../data/zelty";

const BASE = "https://epidom.fr";
const ALL: Locale[] = ["fr", "id", "en"];

async function metadataFor(map: typeof sundayComparison, locale: string | null) {
  requestLocale = locale;
  const md = await buildCompareMetadata(map, ["kw"]);
  return {
    md,
    canonical: md.alternates?.canonical as string,
    languages: md.alternates?.languages as Record<string, string>,
  };
}

describe("compare metadata for an authored locale", () => {
  it("canonicalizes a French competitor's fr page to itself", async () => {
    const { canonical, languages } = await metadataFor(sundayComparison, "fr");
    expect(canonical).toBe(`${BASE}/compare/sunday`);
    expect(languages).toEqual({
      fr: `${BASE}/compare/sunday`,
      en: `${BASE}/en/compare/sunday`,
      "x-default": `${BASE}/compare/sunday`,
    });
  });

  it("canonicalizes the English page of that competitor to itself", async () => {
    const { canonical, languages } = await metadataFor(sundayComparison, "en");
    expect(canonical).toBe(`${BASE}/en/compare/sunday`);
    expect(languages.en).toBe(`${BASE}/en/compare/sunday`);
  });

  it("canonicalizes an Indonesian competitor's id page to itself, x-default on en", async () => {
    const { canonical, languages } = await metadataFor(mokaComparison, "id");
    expect(canonical).toBe(`${BASE}/id/compare/moka`);
    expect(languages).toEqual({
      id: `${BASE}/id/compare/moka`,
      en: `${BASE}/en/compare/moka`,
      "x-default": `${BASE}/en/compare/moka`,
    });
  });

  it("uses the page's own copy for title, description and og:url", async () => {
    const { md, canonical } = await metadataFor(sundayComparison, "fr");
    expect((md.title as { default: string }).default).toBe(
      `${sundayComparison.fr!.eyebrow} — EPIDOM`
    );
    expect(md.description).toBe(sundayComparison.fr!.lede);
    expect(md.openGraph?.url).toBe(canonical);
  });
});

describe("compare metadata for a locale that falls back to English", () => {
  it("points /id/compare/sunday at the English page it actually serves, not at itself", async () => {
    const { canonical, languages } = await metadataFor(sundayComparison, "id");
    expect(canonical).toBe(`${BASE}/en/compare/sunday`);
    expect(canonical).not.toContain("/id/");
    // sunday is not authored in id, so no id alternate is advertised
    expect(languages).toEqual({
      fr: `${BASE}/compare/sunday`,
      en: `${BASE}/en/compare/sunday`,
      "x-default": `${BASE}/compare/sunday`,
    });
    expect(Object.keys(languages)).not.toContain("id");
  });

  it("points the unprefixed fr URL of an id+en competitor at the English page", async () => {
    const { canonical, languages } = await metadataFor(mokaComparison, "fr");
    expect(canonical).toBe(`${BASE}/en/compare/moka`);
    expect(Object.keys(languages).sort()).toEqual(["en", "id", "x-default"]);
  });

  it("takes title and description from the English copy that is shown", async () => {
    const { md } = await metadataFor(sundayComparison, "id");
    expect((md.title as { default: string }).default).toBe(
      `${sundayComparison.en!.eyebrow} — EPIDOM`
    );
    expect(md.description).toBe(sundayComparison.en!.lede);
  });

  it("keeps og:url equal to the canonical", async () => {
    const { md, canonical } = await metadataFor(sundayComparison, "id");
    expect(md.openGraph?.url).toBe(canonical);
  });

  it("treats a missing locale header as the default (fr)", async () => {
    const { canonical } = await metadataFor(sundayComparison, null);
    expect(canonical).toBe(`${BASE}/compare/sunday`);
  });
});

describe("every competitor, every locale", () => {
  const maps = [
    mokaComparison,
    majooComparison,
    klikitComparison,
    sundayComparison,
    sumupPosProComparison,
    zeltyComparison,
  ];

  it("canonicalizes to a locale that is authored, and lists hreflang for authored locales only", async () => {
    for (const map of maps) {
      const authored = (Object.keys(map) as Locale[]).filter((l) => map[l]);
      const slug = map[authored[0]]!.slug;
      const url = (l: Locale) => `${BASE}${l === "fr" ? "" : `/${l}`}/compare/${slug}`;

      for (const locale of ALL) {
        const { canonical, languages } = await metadataFor(map, locale);
        const tag = `${slug} @ ${locale}`;

        const canonicalLocale = ALL.find((l) => url(l) === canonical);
        expect(canonicalLocale, `${tag}: canonical ${canonical}`).toBeDefined();
        expect(authored, `${tag}: canonical locale must be authored`).toContain(canonicalLocale);
        if (authored.includes(locale)) expect(canonicalLocale, tag).toBe(locale);

        for (const l of ALL) {
          expect(Object.keys(languages).includes(l), `${tag}: hreflang ${l}`).toBe(
            authored.includes(l)
          );
        }
        expect(Object.values(languages), tag).toContain(canonical);
      }
    }
  });
});

describe("compare social card", () => {
  type OpenGraph = { locale?: string; images?: Array<{ url: string }>; title?: string };
  type Twitter = { title?: string; description?: string; images?: string[] };
  const ogOf = (md: { openGraph?: unknown }) => md.openGraph as OpenGraph;
  const twitterOf = (md: { twitter?: unknown }) => md.twitter as Twitter;

  it("sets og:locale to the locale of the copy the visitor actually gets", async () => {
    // sunday: fr + en authored
    expect(ogOf((await metadataFor(sundayComparison, "fr")).md).locale).toBe("fr_FR");
    expect(ogOf((await metadataFor(sundayComparison, "en")).md).locale).toBe("en_US");
    // id is not authored, so the page shows English: og:locale must say so too
    expect(ogOf((await metadataFor(sundayComparison, "id")).md).locale).toBe("en_US");
    // moka: id + en authored
    expect(ogOf((await metadataFor(mokaComparison, "id")).md).locale).toBe("id_ID");
    expect(ogOf((await metadataFor(mokaComparison, "fr")).md).locale).toBe("en_US");
  });

  it("keeps og:image, and the same card for Twitter", async () => {
    const { md } = await metadataFor(sundayComparison, "fr");
    const og = ogOf(md);
    expect(og.images?.length).toBeGreaterThan(0);
    expect(og.images?.[0].url).toMatch(/^https:\/\/epidom\.fr\//);

    const tw = twitterOf(md);
    expect(tw.images?.length).toBeGreaterThan(0);
    // the page's own text, not the English site default
    expect(tw.title).toBe(og.title);
    expect(tw.title).toBe(sundayComparison.fr!.eyebrow);
    expect(tw.description).toBe(sundayComparison.fr!.lede);
  });

  it("gives every competitor, in every locale, an og:locale that matches its canonical URL", async () => {
    const OG: Record<Locale, string> = { fr: "fr_FR", id: "id_ID", en: "en_US" };
    for (const map of [
      mokaComparison,
      majooComparison,
      klikitComparison,
      sundayComparison,
      sumupPosProComparison,
      zeltyComparison,
    ]) {
      const slug = map[(Object.keys(map) as Locale[]).find((l) => map[l])!]!.slug;
      const urlOf = (l: Locale) => `${BASE}${l === "fr" ? "" : `/${l}`}/compare/${slug}`;

      for (const locale of ALL) {
        const { md, canonical } = await metadataFor(map, locale);
        const served = ALL.find((l) => urlOf(l) === canonical)!;
        expect(ogOf(md).locale, `${slug} @ ${locale}`).toBe(OG[served]);
        expect(ogOf(md).images?.length, `${slug} @ ${locale}: og:image`).toBeGreaterThan(0);
      }
    }
  });
});

describe("content and fallback behaviour are unchanged", () => {
  it("still serves English copy to a visitor on a locale that was not authored", async () => {
    requestLocale = "id";
    const { locale, servedLocale, data } = await resolveCompareData(sundayComparison);
    expect(locale).toBe("id");
    expect(servedLocale).toBe("en");
    expect(data).toBe(sundayComparison.en);
  });

  it("serves the authored locale's own copy when there is one", async () => {
    requestLocale = "fr";
    const { data } = await resolveCompareData(sundayComparison);
    expect(data).toBe(sundayComparison.fr);
  });

  it("falls back to the first authored locale when English is missing too", async () => {
    requestLocale = "en";
    const onlyId = { id: mokaComparison.id };
    const { servedLocale, data } = await resolveCompareData(onlyId);
    expect(servedLocale).toBe("id");
    expect(data).toBe(mokaComparison.id);
  });

  it("renders the fallback copy on the page", async () => {
    requestLocale = "id";
    render(await CompareCompetitorPage({ dataMap: sundayComparison }));
    expect(screen.getByTestId("comparison").textContent).toBe(
      `sunday|${sundayComparison.en!.eyebrow}`
    );
  });
});
