import { describe, it, expect } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import {
  LOCALE_PRICE_CURRENCY,
  PLAN_PRICE_IDR,
  PLAN_PRICING,
  formatPlanPrice,
} from "../plan-pricing";

const LOCALES = { en, fr, id } as const;

// Loosely typed on purpose: the dictionaries are plain nested objects and this
// test only reads leaf strings by key.
type Dict = Record<string, Record<string, Record<string, string>>>;
const dict = (l: keyof typeof LOCALES) => LOCALES[l] as unknown as Dict;

describe("formatPlanPrice", () => {
  it("reproduces today's display strings exactly", () => {
    expect(formatPlanPrice("POS", "USD", "monthly")).toBe("$14.99");
    expect(formatPlanPrice("POS", "USD", "yearly")).toBe("$12.49");
    expect(formatPlanPrice("OPERATIONS", "USD", "monthly")).toBe("$29.99");
    expect(formatPlanPrice("OPERATIONS", "USD", "yearly")).toBe("$24.99");

    expect(formatPlanPrice("POS", "EUR", "monthly")).toBe("13,99 €");
    expect(formatPlanPrice("POS", "EUR", "yearly")).toBe("11,49 €");
    expect(formatPlanPrice("OPERATIONS", "EUR", "monthly")).toBe("27,99 €");
    expect(formatPlanPrice("OPERATIONS", "EUR", "yearly")).toBe("23,49 €");

    expect(formatPlanPrice("POS", "IDR", "monthly")).toBe("Rp 229k");
    expect(formatPlanPrice("POS", "IDR", "yearly")).toBe("Rp 189k");
    expect(formatPlanPrice("OPERATIONS", "IDR", "monthly")).toBe("Rp 459k");
    expect(formatPlanPrice("OPERATIONS", "IDR", "yearly")).toBe("Rp 379k");
  });

  it("charges less per month on the yearly plan, in every currency", () => {
    for (const plan of ["POS", "OPERATIONS"] as const) {
      for (const cur of ["IDR", "EUR", "USD"] as const) {
        expect(PLAN_PRICING[plan][cur].yearly).toBeLessThan(PLAN_PRICING[plan][cur].monthly);
      }
    }
  });
});

describe("PLAN_PRICE_IDR", () => {
  it("is the monthly IDR price the billing dashboard converts from", () => {
    // Unchanged from the two private copies it replaced.
    expect(PLAN_PRICE_IDR).toEqual({ POS: 229000, OPERATIONS: 459000 });
  });
});

describe("locale price strings match plan-pricing", () => {
  for (const locale of ["en", "fr", "id"] as const) {
    const currency = LOCALE_PRICE_CURRENCY[locale];

    it(`/pricing cards in ${locale} quote ${currency} exactly`, () => {
      const page = dict(locale).redesign.pricingPage;
      expect(page.t2price_mo).toBe(formatPlanPrice("POS", currency, "monthly"));
      expect(page.t2price_yr).toBe(formatPlanPrice("POS", currency, "yearly"));
      expect(page.t3price_mo).toBe(formatPlanPrice("OPERATIONS", currency, "monthly"));
      expect(page.t3price_yr).toBe(formatPlanPrice("OPERATIONS", currency, "yearly"));
    });

    it(`the home teaser in ${locale} quotes the monthly price`, () => {
      const teaser = dict(locale).redesign.pricingTeaser;
      expect(teaser.t2price).toBe(formatPlanPrice("POS", currency, "monthly"));
      expect(teaser.t3price).toBe(formatPlanPrice("OPERATIONS", currency, "monthly"));
    });
  }
});
