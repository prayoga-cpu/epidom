import { describe, expect, it } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { getDocsGuide, getDocsGuides } from "@/features/marketing/docs/content";
import {
  HELP_GUIDE_IDS,
  HELP_GUIDE_SLUGS,
  PAGE_INTRO_GUIDES,
  POS_GUIDE_IDS,
  checklistHref,
  helpGuideIdFor,
  helpPageHref,
  localizedGuideSlug,
  tourHref,
} from "../help-guides";
import { orderHelpGuides, resolveHelpGuide } from "../help-guide-content";

const LOCALES: Locale[] = ["fr", "id", "en"];

const NEW_GUIDES = [
  "pos-system-and-operational",
  "stock-and-supplier-orders",
  "staff-schedules-and-shifts",
  "hardware-printers-and-scanner",
] as const;

describe("HELP_GUIDE_SLUGS ↔ the docs guides", () => {
  it.each(LOCALES)("%s: every mapped slug is a real guide", (locale) => {
    for (const id of HELP_GUIDE_IDS) {
      const slug = HELP_GUIDE_SLUGS[id][locale];
      expect(getDocsGuide(locale, slug), `${id} → ${locale}/${slug}`).toBeDefined();
    }
  });

  it.each(LOCALES)("%s: every guide has a row — a new guide can't be missed", (locale) => {
    const mapped = new Set<string>(HELP_GUIDE_IDS.map((id) => HELP_GUIDE_SLUGS[id][locale]));
    for (const guide of getDocsGuides(locale)) {
      expect(mapped.has(guide.slug), `${locale}/${guide.slug} has no HELP_GUIDE_SLUGS row`).toBe(
        true
      );
    }
  });

  it("the id is the English slug", () => {
    for (const id of HELP_GUIDE_IDS) expect(HELP_GUIDE_SLUGS[id].en).toBe(id);
  });
});

describe("the four in-app guides", () => {
  it.each(LOCALES)("%s: all four exist, in the right language", (locale) => {
    for (const id of NEW_GUIDES) {
      const guide = resolveHelpGuide(locale, id);
      expect(guide, `${id} in ${locale}`).toBeDefined();
      expect(guide!.locale).toBe(locale);
      expect(guide!.blocks.length).toBeGreaterThan(3);
    }
  });

  it.each(LOCALES)("%s: they reuse the categories the older guides already use", (locale) => {
    const newSlugs = new Set<string>(NEW_GUIDES.map((id) => HELP_GUIDE_SLUGS[id][locale]));
    const guides = getDocsGuides(locale);
    const existing = new Set(guides.filter((g) => !newSlugs.has(g.slug)).map((g) => g.category));
    for (const guide of guides.filter((g) => newSlugs.has(g.slug))) {
      expect(existing.has(guide.category), `${guide.slug}: "${guide.category}"`).toBe(true);
    }
  });

  it("promise no printer model by name", () => {
    for (const locale of LOCALES) {
      const guide = resolveHelpGuide(locale, "hardware-printers-and-scanner")!;
      const text = JSON.stringify(guide.blocks);
      expect(text).not.toMatch(/Xprinter|Epson|Star Micronics|Sunmi|TSC|Zebra/i);
    }
  });
});

describe("slug resolution", () => {
  it("finds a guide by its id or any language's slug", () => {
    expect(helpGuideIdFor("stock-and-supplier-orders")).toBe("stock-and-supplier-orders");
    expect(helpGuideIdFor("stock-et-commandes-fournisseurs")).toBe("stock-and-supplier-orders");
    expect(helpGuideIdFor("stok-dan-pesanan-pemasok")).toBe("stock-and-supplier-orders");
    expect(helpGuideIdFor("no-such-guide")).toBeNull();
  });

  it("maps a link made in one language to the viewer's", () => {
    expect(localizedGuideSlug("hardware-printers-and-scanner", "fr")).toBe(
      "materiel-imprimantes-et-scanner"
    );
    expect(resolveHelpGuide("id", "equipe-plannings-et-quarts")?.slug).toBe("staf-jadwal-dan-sif");
    // Unknown slugs pass through untouched (and resolve to nothing).
    expect(localizedGuideSlug("mystery", "en")).toBe("mystery");
    expect(resolveHelpGuide("en", "mystery")).toBeUndefined();
  });

  it("every page intro's guide is a known guide", () => {
    for (const id of Object.values(PAGE_INTRO_GUIDES)) {
      expect(HELP_GUIDE_IDS).toContain(id);
    }
  });
});

describe("orderHelpGuides", () => {
  it("Back Office: the curated order, nothing featured", () => {
    const { featured, rest } = orderHelpGuides("fr", "backoffice");
    expect(featured).toEqual([]);
    expect(rest).toEqual(getDocsGuides("fr"));
  });

  it.each(LOCALES)("%s POS Mode: the till's guides first, then the rest, none twice", (locale) => {
    const { featured, rest } = orderHelpGuides(locale, "pos");
    expect(featured.map((g) => g.slug)).toEqual(
      POS_GUIDE_IDS.map((id) => HELP_GUIDE_SLUGS[id][locale])
    );
    const all = [...featured, ...rest].map((g) => g.slug);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(getDocsGuides(locale).length);
  });
});

describe("links", () => {
  it("builds the Help page, tour and checklist links", () => {
    expect(helpPageHref("s1")).toBe("/store/s1/help");
    expect(helpPageHref("s1", "demarrage")).toBe("/store/s1/help?guide=demarrage");
    expect(tourHref("s1")).toBe("/store/s1/dashboard?tour=1");
    expect(checklistHref("s1")).toBe("/store/s1/dashboard?checklist=1");
  });
});
