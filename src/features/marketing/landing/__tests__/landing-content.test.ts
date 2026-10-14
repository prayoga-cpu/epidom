import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { LANDING_PAGES } from "../content";
import { LANDING_GROUPS, LANDING_LABELS, LANDING_SLUGS, landingLocaleFor } from "../registry";
import { buildLandingMetadata, landingHreflang } from "../metadata";
import type { LandingGroup } from "../registry";
import type { LandingPage } from "../types";

const ROUTES = resolve(process.cwd(), "src/app/(marketing)");

/** Every string a visitor (or a search snippet) reads on a page. */
function texts(page: LandingPage): string[] {
  return [
    page.metaTitle,
    page.metaDescription,
    page.eyebrow,
    page.h1,
    page.lede,
    ...page.blocks.flatMap((b) =>
      b.type === "list"
        ? b.items
        : b.type === "steps"
          ? b.items.flatMap((s) => [s.title, s.text])
          : "text" in b
            ? [b.text]
            : []
    ),
    ...page.faqs.flatMap((f) => [f.q, f.a]),
    page.cta.title,
    page.cta.text,
    page.cta.button,
  ];
}

describe("landing registry ↔ content ↔ routes", () => {
  it("lists exactly the pages the content defines, with the same language and group", () => {
    expect(LANDING_PAGES.map((p) => p.slug).sort()).toEqual([...LANDING_SLUGS.keys()].sort());
    for (const page of LANDING_PAGES) {
      expect(LANDING_SLUGS.get(page.slug), page.slug).toEqual({
        locale: page.locale,
        group: page.group,
      });
    }
  });

  it("gives every slug a route file that renders it, and a link label", () => {
    for (const slug of LANDING_SLUGS.keys()) {
      const file = resolve(ROUTES, slug, "page.tsx");
      expect(existsSync(file), file).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source).toContain(`landingMetadata("${slug}")`);
      expect(source).toContain(`<LandingRoute slug="${slug}" />`);
      expect(LANDING_LABELS[slug], slug).toBeTruthy();
    }
  });

  it("never reuses a slug across languages or collides with another marketing route", () => {
    const slugs = [...LANDING_SLUGS.keys()];
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const reserved of ["pricing", "about", "services", "blog", "docs", "compare", "contact"]) {
      expect(slugs).not.toContain(reserved);
    }
  });

  it("maps a path to its page's language, and nothing else", () => {
    expect(landingLocaleFor("/kalkulator-hpp")).toBe("id");
    expect(landingLocaleFor("/calcul-cout-de-revient")).toBe("fr");
    expect(landingLocaleFor("/")).toBeUndefined();
    expect(landingLocaleFor("/pricing")).toBeUndefined();
    expect(landingLocaleFor("/kalkulator-hpp/extra")).toBeUndefined();
  });
});

describe.each(LANDING_PAGES.map((p) => [p.slug, p] as const))("landing page %s", (_, page) => {
  it("has a title that fits search results and a description that does too", () => {
    expect(`${page.metaTitle} — EPIDOM`.length, page.metaTitle).toBeLessThanOrEqual(60);
    expect(page.metaDescription.length, page.metaDescription).toBeLessThanOrEqual(160);
    expect(page.metaDescription.length).toBeGreaterThanOrEqual(90);
  });

  it("has real substance: sections, a how-to, and questions answered", () => {
    expect(page.blocks.filter((b) => b.type === "h2").length).toBeGreaterThanOrEqual(4);
    expect(page.faqs.length).toBeGreaterThanOrEqual(3);
    const words = texts(page).join(" ").split(/\s+/).length;
    expect(words, `${page.slug}: ${words} words`).toBeGreaterThanOrEqual(550);
  });

  it("renders its tool exactly once when it has one, and never otherwise", () => {
    const tools = page.blocks.filter((b) => b.type === "tool").length;
    expect(tools).toBe(page.tool ? 1 : 0);
  });

  it("makes none of the claims the site must not make", () => {
    const all = texts(page).join("\n");
    expect(all).not.toMatch(/\b5[\s-]?min|en quelques minutes|dalam hitungan menit|in minutes\b/i);
    expect(all).not.toMatch(/NF\s?525|certifi[ée]|homologu|conforme (à la )?loi/i);
    expect(all).not.toMatch(/\b\d+[.,]?\d*\s?(k|\+)\s?(clients|customers|pelanggan|merchants)/i);
    expect(all).not.toMatch(/★|\d[.,]\d\s?\/\s?5/);
  });

  it("quotes only the prices of its own currency", () => {
    const all = texts(page).join("\n");
    const foreign = {
      fr: [/\$\d/, /Rp\s?\d/],
      id: [/€/, /\$\d/],
      en: [/€/, /Rp\s?\d/],
    }[page.locale];
    for (const pattern of foreign) expect(all, `${page.slug} ${pattern}`).not.toMatch(pattern);
  });

  if (page.locale === "fr") {
    it("uses French typography (non-breaking space before : ; ? !) and no Indonesian words", () => {
      for (const text of texts(page)) {
        expect(text, text.slice(0, 80)).not.toMatch(/ [:;?!]/);
        expect(text).not.toMatch(/warung/i);
      }
    });
  }

  it("canonicalises to itself and links its siblings in the other languages", () => {
    const md = buildLandingMetadata(page);
    const languages = md.alternates?.languages as Record<string, string>;
    expect(md.alternates?.canonical).toBe(languages[page.locale]);
    expect(languages).toEqual(landingHreflang(page.group as LandingGroup));
    expect(languages["x-default"]).toBeTruthy();
  });
});

describe("hreflang groups", () => {
  it("point each language at its own slug", () => {
    const languages = landingHreflang("recipe-cost");
    expect(languages).toEqual({
      fr: "https://epidom.fr/calcul-cout-de-revient",
      id: "https://epidom.fr/id/kalkulator-hpp",
      en: "https://epidom.fr/en/recipe-cost-calculator",
      "x-default": "https://epidom.fr/calcul-cout-de-revient",
    });
  });

  it("fall back to English for x-default when a group has no French page", () => {
    expect(landingHreflang("cafe")["x-default"]).toBe("https://epidom.fr/en/cafe-pos-system");
    expect(Object.keys(LANDING_GROUPS.restaurant)).toEqual(["id"]);
    expect(landingHreflang("restaurant")["x-default"]).toBe(
      "https://epidom.fr/id/aplikasi-kasir-restoran"
    );
  });
});
