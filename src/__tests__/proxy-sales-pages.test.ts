// @vitest-environment node
import { describe, it, expect } from "vitest";
import { config } from "@/proxy";
import nextConfig from "../../next.config";

// The sales pages are for anonymous visitors from ads: any path the proxy
// handles and doesn't list as public is sent to /login. They stay out of it by
// being excluded from the matcher, the same way offline.html and sw.js are.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher: the sales pages are never behind the login", () => {
  it.each([
    "/sales-page-1",
    "/sales-page-2",
    "/sales-page-3",
    "/sales-pages/sales-page-1.html",
    "/sales-pages/tracker.js",
  ])("skips %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(["/stores", "/register", "/", "/pricing"])("still handles %s (control)", (path) => {
    expect(matcher.test(path)).toBe(true);
  });
});

describe("next.config rewrite: slug to static file", () => {
  it("serves /sales-page-N from public/sales-pages/sales-page-N.html", async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toContainEqual({
      source: "/:page(sales-page-\\d+)",
      destination: "/sales-pages/:page.html",
    });
  });
});
