import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";
import { COMPARE_HUB_ENTRIES } from "../hub-data";

/**
 * Comparison pages are comparative advertising: in France a comparison must be
 * objective and verifiable. These pin the Epidom side to what the product is
 * (only the storefront is free; online ordering is a POS-plan feature; no
 * setup-time claims), across every data file, including new ones.
 */
const DATA_DIR = resolve(process.cwd(), "src/features/marketing/compare/data");
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".ts"));

async function load(file: string): Promise<Partial<Record<Locale, CompetitorComparisonData>>> {
  const mod = await import(`../data/${file.replace(/\.ts$/, "")}`);
  const exported = Object.values(mod).find((v) => v && typeof v === "object");
  return exported as Partial<Record<Locale, CompetitorComparisonData>>;
}

const textsOf = (d: CompetitorComparisonData) => [
  d.eyebrow,
  ...d.titleParts,
  d.lede,
  ...d.rows.flatMap((r) => [r.feature, r.epidom, r.competitor]),
  d.note,
  ...d.faqs.flatMap((f) => [f.q, f.a]),
  d.ctaTitle,
  d.ctaButton,
];

describe.each(files)("compare data %s", (file) => {
  it("states no setup time and never calls Epidom's online ordering free", async () => {
    const map = await load(file);
    for (const [locale, data] of Object.entries(map)) {
      const epidomSide = [
        data!.lede,
        ...data!.rows.map((r) => r.epidom),
        ...data!.faqs.map((f) => f.a),
      ].join("\n");
      expect(epidomSide, `${file} ${locale}`).not.toMatch(
        /~\s?5|5\s?min|en quelques minutes|in minutes/i
      );
      expect(epidomSide, `${file} ${locale}`).not.toMatch(
        /commande en ligne gratuite|commande en ligne (fait partie|incluse?) (du|dans le) forfait gratuit|free online ordering|online ordering (is )?free|storefront and online ordering free|pesan online gratis|storefront \+ pesan online\) memang dirancang gratis/i
      );
    }
  });

  it("has enough rows to be a comparison, with the same slug in every language", async () => {
    const map = await load(file);
    const datas = Object.values(map) as CompetitorComparisonData[];
    expect(datas.length).toBeGreaterThan(0);
    expect(new Set(datas.map((d) => d.slug)).size).toBe(1);
    for (const d of datas) expect(d.rows.length, `${file} ${d.slug}`).toBeGreaterThanOrEqual(4);
  });

  it("uses French typography in its French copy", async () => {
    const map = await load(file);
    if (!map.fr) return;
    for (const text of textsOf(map.fr)) expect(text, text.slice(0, 80)).not.toMatch(/ [:;?!]/);
  });
});

describe("compare hub", () => {
  it("lists every competitor page exactly once", async () => {
    const slugs = await Promise.all(files.map(async (f) => Object.values(await load(f))[0]!.slug));
    const hub = COMPARE_HUB_ENTRIES.map((e) => e.slug).filter((s) => s !== "delivery-commission");
    expect([...hub].sort()).toEqual([...slugs].sort());
  });
});
