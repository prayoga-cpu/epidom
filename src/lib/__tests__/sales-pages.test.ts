// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  SALES_PAGES,
  SALES_PAGE_COOKIE,
  isSalesPage,
  salesPageFromCookieHeader,
} from "@/lib/sales-pages";

const PUBLIC_DIR = join(process.cwd(), "public", "sales-pages");

describe("salesPageFromCookieHeader", () => {
  it("finds the page among other cookies", () => {
    expect(
      salesPageFromCookieHeader(`a=1; ${SALES_PAGE_COOKIE}=sales-page-3; b=2`)
    ).toBe("sales-page-3");
    expect(salesPageFromCookieHeader(`${SALES_PAGE_COOKIE}=sales-page-1`)).toBe("sales-page-1");
  });

  it.each([
    [null],
    [""],
    ["a=1; b=2"],
    [`${SALES_PAGE_COOKIE}=sales-page-9`],
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

describe("the sales page files", () => {
  it.each(SALES_PAGES)("%s exists, loads the tracker under its own name", (page) => {
    const file = join(PUBLIC_DIR, `${page}.html`);
    expect(existsSync(file)).toBe(true);
    const html = readFileSync(file, "utf8");

    expect(html).toContain(
      `<script src="/sales-pages/tracker.js" data-page="${page}" defer></script>`
    );
  });

  it.each(SALES_PAGES)("%s: every button goes to signup and is named for the report", (page) => {
    const html = readFileSync(join(PUBLIC_DIR, `${page}.html`), "utf8");
    const links = html.match(/<a\b[^>]*>/g) ?? [];

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toContain('href="/register"');
      expect(link).toMatch(/data-cta="[a-z0-9-]+"/);
      expect(link).not.toContain("target=");
    }
  });

  it("the tracker sets the cookie the auth hook reads", () => {
    const tracker = readFileSync(join(PUBLIC_DIR, "tracker.js"), "utf8");
    expect(tracker).toContain(`var COOKIE = "${SALES_PAGE_COOKIE}";`);
    expect(tracker).toContain('"/api/public/sales-pages/events"');
  });
});
