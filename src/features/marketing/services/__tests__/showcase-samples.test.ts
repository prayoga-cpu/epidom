import { describe, it, expect } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { SHOWCASE_SAMPLES } from "../content/showcase-samples";

/**
 * The Services page mockups show each market its own currency, and every
 * figure in a mockup has to add up: a bill whose lines don't reach its total is
 * the kind of detail a restaurant owner notices first.
 */

const LOCALES: Locale[] = ["fr", "id", "en"];

/** "7,00 €", "−16 310 €" / "Rp 44.000", "−Rp 1,4 jt" / "$9.00", "−$17,710" → number */
function parseAmount(locale: Locale, raw: string): number {
  const negative = /^[−-]/.test(raw.trim());
  let s = raw.replace(/[−-]/g, "").trim();
  let value: number;
  if (locale === "fr") {
    value = Number(s.replace("€", "").replace(/\s/g, "").replace(",", "."));
  } else if (locale === "id") {
    s = s.replace("Rp", "").trim();
    value = s.endsWith("jt")
      ? Number(s.replace("jt", "").trim().replace(",", ".")) * 1_000_000
      : Number(s.replace(/\./g, ""));
  } else {
    value = Number(s.replace("$", "").replace(/,/g, ""));
  }
  if (Number.isNaN(value)) throw new Error(`unparseable amount "${raw}" (${locale})`);
  return negative ? -value : value;
}

const cents = (n: number) => Math.round(n * 100);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe.each(LOCALES)("%s showcase samples", (locale) => {
  const s = SHOWCASE_SAMPLES[locale];
  const amount = (raw: string) => parseAmount(locale, raw);

  it("uses only this market's currency", () => {
    const text = JSON.stringify(s);
    const currencies = { fr: "€", id: "Rp", en: "$" } as const;
    for (const [loc, symbol] of Object.entries(currencies)) {
      if (loc === locale) expect(text).toContain(symbol);
      else expect(text, `${locale} shows ${symbol}`).not.toContain(symbol);
    }
  });

  it("has a bill whose lines, coupon and total add up", () => {
    const subtotal = amount(s.till.subtotal[1]);
    expect(cents(sum(s.till.lines.map((l) => amount(l.price))))).toBe(cents(subtotal));
    expect(cents(subtotal + amount(s.till.coupon[1]))).toBe(cents(amount(s.till.total[1])));
    expect(s.till.charge).toContain(s.till.total[1]);
  });

  it("has an end-of-shift count that adds up and balances", () => {
    const expected = amount(s.shift.expected[1]);
    expect(cents(sum(s.shift.lines.map(([, v]) => amount(v))))).toBe(cents(expected));
    expect(cents(amount(s.shift.counted[1]) - expected)).toBe(cents(amount(s.shift.difference[1])));
  });

  it("has a recipe whose ingredients add up to its cost", () => {
    const cost = amount(s.recipe.cost);
    expect(cents(sum(s.recipe.ingredients.map((i) => amount(i.cost))))).toBe(cents(cost));
    // "Sells for X · margin Y%": the profit is price minus cost.
    const price = s.recipe.margin.match(/(Rp\s?[\d.]+|[\d.,]+\s?€|\$[\d.,]+)/)?.[0];
    expect(price).toBeDefined();
    expect(cents(amount(price!) - cost)).toBe(cents(amount(s.recipe.profit.replace("+", ""))));
  });

  it("has a finance summary whose net profit is revenue minus costs", () => {
    const [revenue, ...rest] = s.report.rows.map((r) => amount(r.value));
    const netProfit = rest.pop()!;
    expect(cents(revenue + sum(rest))).toBe(cents(netProfit));
  });
});
