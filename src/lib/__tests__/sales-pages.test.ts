// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  SALES_PAGES,
  SALES_PAGE_COOKIE,
  SALES_PAGE_LOCALES,
  isSalesPage,
  isSalesPagePath,
  salesPageFromCookieHeader,
} from "@/lib/sales-pages";

const PUBLIC_DIR = join(process.cwd(), "public", "sales-pages");

const fileFor = (page: string, locale: string) =>
  join(PUBLIC_DIR, locale === "fr" ? `${page}.html` : `${page}.${locale}.html`);

const EVERY_COPY = SALES_PAGES.flatMap((page) =>
  SALES_PAGE_LOCALES.map((locale) => [page, locale] as const)
);

describe("salesPageFromCookieHeader", () => {
  it("finds the page and its language among other cookies", () => {
    expect(
      salesPageFromCookieHeader(`a=1; ${SALES_PAGE_COOKIE}=sales-page-3.en; b=2`)
    ).toEqual({ page: "sales-page-3", locale: "en" });
    expect(salesPageFromCookieHeader(`${SALES_PAGE_COOKIE}=sales-page-2.id`)).toEqual({
      page: "sales-page-2",
      locale: "id",
    });
  });

  it("reads a cookie from before the pages had languages as French", () => {
    expect(salesPageFromCookieHeader(`${SALES_PAGE_COOKIE}=sales-page-1`)).toEqual({
      page: "sales-page-1",
      locale: "fr",
    });
  });

  it.each([
    [null],
    [""],
    ["a=1; b=2"],
    [`${SALES_PAGE_COOKIE}=sales-page-9`],
    [`${SALES_PAGE_COOKIE}=sales-page-1.de`],
    [`${SALES_PAGE_COOKIE}=sales-page-1.en.x`],
    [`${SALES_PAGE_COOKIE}=`],
    [`x${SALES_PAGE_COOKIE}=sales-page-1`],
  ])("returns null for %j", (header) => {
    expect(salesPageFromCookieHeader(header)).toBeNull();
  });

  it("only accepts the listed pages", () => {
    expect(isSalesPage("sales-page-2")).toBe(true);
    expect(isSalesPage("sales-page-4")).toBe(false);
    expect(isSalesPage(2)).toBe(false);
  });
});

describe("isSalesPagePath", () => {
  it.each(["/sales-page-1", "/sales-page-3", "/sales-page-12"])("%s is a sales page URL", (path) => {
    expect(isSalesPagePath(path)).toBe(true);
  });

  it.each(["/sales-pages/tracker.js", "/sales-page-1/x", "/sales-page-", "/pricing", "/en/sales-page-1"])(
    "%s is not (the locale prefix is stripped before)",
    (path) => {
      expect(isSalesPagePath(path)).toBe(false);
    }
  );
});

describe("the sales page files", () => {
  it.each(EVERY_COPY)("%s (%s) exists in its language and loads the tracker and switcher", (page, locale) => {
    const file = fileFor(page, locale);
    expect(existsSync(file)).toBe(true);
    const html = readFileSync(file, "utf8");

    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(
      `<script src="/sales-pages/tracker.js" data-page="${page}" defer></script>`
    );
    expect(html).toContain('<script src="/sales-pages/lang-switch.js" defer></script>');
  });

  it.each(EVERY_COPY)("%s (%s) names its three languages for search engines", (page, locale) => {
    const html = readFileSync(fileFor(page, locale), "utf8");
    const origin = "https://epidom.fr";

    expect(html).toContain(`<link rel="alternate" hreflang="fr" href="${origin}/${page}">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${origin}/en/${page}">`);
    expect(html).toContain(`<link rel="alternate" hreflang="id" href="${origin}/id/${page}">`);
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${origin}/${page}">`);
  });

  it.each(EVERY_COPY)("%s (%s): every button goes to signup and is named for the report", (page, locale) => {
    const html = readFileSync(fileFor(page, locale), "utf8");
    const links = html.match(/<a\b[^>]*>/g) ?? [];

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toContain('href="/register"');
      expect(link).toMatch(/data-cta="[a-z0-9-]+"/);
      expect(link).not.toContain("target=");
    }
  });

  it.each(SALES_PAGES)("%s has the same buttons in every language", (page) => {
    const ctas = (locale: string) =>
      [...readFileSync(fileFor(page, locale), "utf8").matchAll(/data-cta="([a-z0-9-]+)"/g)].map(
        (m) => m[1]
      );
    expect(ctas("en")).toEqual(ctas("fr"));
    expect(ctas("id")).toEqual(ctas("fr"));
  });

  it("the tracker sets the cookie the auth hook reads", () => {
    const tracker = readFileSync(join(PUBLIC_DIR, "tracker.js"), "utf8");
    expect(tracker).toContain(`var COOKIE = "${SALES_PAGE_COOKIE}";`);
    expect(tracker).toContain('"/api/public/sales-pages/events"');
  });
});
