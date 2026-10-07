// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SALES_PAGES } from "@/lib/sales-pages";
import { translateSalesPage } from "../lib/translate-sales-page";
import { SALES_PAGE_TRANSLATIONS } from "../translations";

const DIR = join(process.cwd(), "public", "sales-pages");

const COPIES = SALES_PAGES.flatMap((page) => (["en", "id"] as const).map((locale) => [page, locale] as const));

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
});
