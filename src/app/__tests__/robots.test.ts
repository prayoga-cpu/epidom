import { describe, it, expect } from "vitest";
import robots from "../robots";

const config = robots();
const rule = (Array.isArray(config.rules) ? config.rules[0] : config.rules) as {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};
const disallow = ([] as string[]).concat(rule.disallow ?? []);

// robots.txt matching is prefix-based.
const blocked = (path: string) => disallow.some((d) => path.startsWith(d));

describe("robots.txt", () => {
  it("points crawlers at the sitemap on the canonical host", () => {
    expect(config.sitemap).toBe("https://epidom.fr/sitemap.xml");
  });

  it("applies to every crawler and allows the site by default", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("keeps the authenticated, API and transactional surfaces out of search", () => {
    for (const path of [
      "/api/stores",
      "/store/abc/pos",
      "/stores",
      "/admin",
      "/owner",
      "/onboarding",
      "/profile",
      "/checkout/success",
      "/r/order_123",
    ]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it("leaves every public page crawlable in all three locales", () => {
    for (const locale of ["", "/id", "/en"]) {
      for (const path of [
        "",
        "/pricing",
        "/about",
        "/blog",
        "/docs",
        "/compare",
        "/compare/sunday",
        "/contact",
      ]) {
        expect(blocked(`${locale}${path}` || "/"), `${locale}${path}`).toBe(false);
      }
    }
    expect(blocked("/@some-cafe")).toBe(false);
  });

  it("does not block /payments, so crawlers can follow its redirect to /pricing and drop the old URL", () => {
    expect(blocked("/payments")).toBe(false);
    expect(blocked("/id/payments")).toBe(false);
    expect(blocked("/en/payments")).toBe(false);
  });
});
