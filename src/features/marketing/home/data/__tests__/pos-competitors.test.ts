import { describe, expect, it } from "vitest";
import { COMPETITOR_COMPARISONS } from "@/features/marketing/compare/registry";
import { compareLocaleFor, monthlyPosFee, POS_COMPETITORS } from "../pos-competitors";

/** Every comparison page by slug, with the languages it is written in. */
const PAGES = new Map(
  COMPETITOR_COMPARISONS.map((byLocale) => {
    const any = Object.values(byLocale).find(Boolean)!;
    return [any.slug, byLocale] as const;
  })
);

/**
 * Every number written on a page, read both ways a price can be written:
 * "1,288,000" / "1.288.000" as a whole number, "1.75" / "1,75" as a decimal.
 */
function numbersOn(slug: string): Set<number> {
  const text = JSON.stringify(PAGES.get(slug));
  const found = new Set<number>();
  for (const token of text.match(/\d[\d.,]*\d|\d/g) ?? []) {
    found.add(Number(token.replace(/[.,]/g, "")));
    found.add(Number(token.replace(",", ".")));
  }
  return found;
}

describe("POS_COMPETITORS: the calculator's competitor prices", () => {
  it("each points at a comparison page that exists, in the languages it lists", () => {
    for (const c of POS_COMPETITORS) {
      const page = PAGES.get(c.compareSlug);
      expect(page, c.id).toBeDefined();
      expect(Object.keys(page!).sort(), c.id).toEqual([...c.compareLocales].sort());
    }
  });

  it("copies every published price from its comparison page, never a new figure", () => {
    for (const c of POS_COMPETITORS) {
      const numbers = numbersOn(c.compareSlug);
      if (c.price.kind === "monthly" || c.price.kind === "yearly") {
        expect(numbers.has(c.price.amount), `${c.id}: ${c.price.amount}`).toBe(true);
      } else if (c.price.kind === "cardFee") {
        expect(numbers.has(c.price.percent), `${c.id}: ${c.price.percent}%`).toBe(true);
      }
    }
  });

  it("has a currency exactly when it has a price", () => {
    for (const c of POS_COMPETITORS) {
      expect(c.currency === null, c.id).toBe(c.price.kind === "quote");
    }
  });

  it("leaves out what is not a till (a payment layer, an order aggregator)", () => {
    const slugs = POS_COMPETITORS.map((c) => c.compareSlug);
    expect(slugs).not.toContain("sunday");
    expect(slugs).not.toContain("klikit");
  });

  it("has unique ids", () => {
    const ids = POS_COMPETITORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("monthlyPosFee", () => {
  const byId = (id: string) => POS_COMPETITORS.find((c) => c.id === id)!;

  it("is the monthly price, the yearly price over twelve, zero without a subscription, null on quote", () => {
    expect(monthlyPosFee(byId("moka-premium"))).toBe(299_000);
    expect(monthlyPosFee(byId("qasir-pro"))).toBe(58_250);
    expect(monthlyPosFee(byId("olsera-basic"))).toBe(107_333);
    expect(monthlyPosFee(byId("zettle"))).toBe(0);
    expect(monthlyPosFee(byId("zelty"))).toBeNull();
  });
});

describe("compareLocaleFor", () => {
  it("keeps the visitor's language when the page is written in it, else English", () => {
    const moka = POS_COMPETITORS.find((c) => c.id === "moka-premium")!;
    expect(compareLocaleFor(moka, "id")).toBe("id");
    expect(compareLocaleFor(moka, "fr")).toBe("en");
  });
});
