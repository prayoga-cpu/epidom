// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SALES_PAGES } from "@/lib/sales-pages";
import { translateSalesPage } from "../lib/translate-sales-page";
import { SALES_PAGE_TRANSLATIONS } from "../translations";

const DIR = join(process.cwd(), "public", "sales-pages");

const COPIES = SALES_PAGES.flatMap((page) => (["en", "id", "th"] as const).map((locale) => [page, locale] as const));

describe("sales page translations", () => {
  it("has a table for every sales page, and only for those", () => {
    expect(Object.keys(SALES_PAGE_TRANSLATIONS).sort()).toEqual([...SALES_PAGES].sort());
  });

  it.each(COPIES)("%s (%s) covers the whole French page", (page, locale) => {
    const table = SALES_PAGE_TRANSLATIONS[page][locale];
    expect(table.locale).toBe(locale);

    const { problems } = translateSalesPage(readFileSync(join(DIR, `${page}.html`), "utf8"), table);
    expect(problems).toEqual([]);
  });

  // The copies are committed so they are served as plain files. After editing
  // a French page or a table, run: tsx scripts/build-sales-pages.ts
  it.each(COPIES)("public/sales-pages/%s.%s.html is up to date", (page, locale) => {
    const { html } = translateSalesPage(
      readFileSync(join(DIR, `${page}.html`), "utf8"),
      SALES_PAGE_TRANSLATIONS[page][locale]
    );
    expect(readFileSync(join(DIR, `${page}.${locale}.html`), "utf8")).toBe(html);
  });

  // Thai is never letter-spaced, and the designs' fonts have no Thai letters:
  // the Thai copy alone ends its <head> with a <style> that undoes the tracking
  // and names system fonts that have them (../translations/thai-style.ts).
  it.each(SALES_PAGES)("%s: only the Thai copy adds its own CSS", (page) => {
    const copy = (locale: "en" | "id" | "th") => readFileSync(join(DIR, `${page}.${locale}.html`), "utf8");
    const french = readFileSync(join(DIR, `${page}.html`), "utf8");
    const styles = (html: string) => html.match(/<style\b/g)?.length ?? 0;

    expect(copy("th")).toContain('<html lang="th">');
    expect(copy("th")).toMatch(/<style data-lang="th">\n:lang\(th\)[^{]*\{letter-spacing:0!important\}/);
    expect(copy("th")).toMatch(/"Noto Sans Thai","Leelawadee UI","Thonburi"/);
    expect(copy("th")).toMatch(/<\/style>\n<\/head>/);
    expect(styles(copy("th"))).toBe(styles(french) + 1);
    for (const locale of ["en", "id"] as const) {
      expect(copy(locale)).not.toContain("data-lang=");
      expect(styles(copy(locale))).toBe(styles(french));
    }
  });

  it.each(SALES_PAGES)("%s (th) is written in Thai, with the English copy's prices", (page) => {
    const text = (locale: "en" | "th") =>
      readFileSync(join(DIR, `${page}.${locale}.html`), "utf8")
        .replace(/<(style|script)\b[\s\S]*?<\/\1>/g, "")
        .replace(/<[^>]+>/g, " ");
    const prices = (s: string) => s.match(/\$\d[\d.,]*/g) ?? [];

    expect(text("th")).toMatch(/[\u0E00-\u0E7F]/);
    // No Thai digits, and no French left behind.
    expect(text("th")).not.toMatch(/[\u0E50-\u0E59]/);
    expect(text("th")).not.toMatch(/[àâçéèêëîïôùûœ]/i);
    expect(prices(text("th"))).toEqual(prices(text("en")));
  });
});
