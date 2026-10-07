// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy, { config } from "@/proxy";
import nextConfig from "../../next.config";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { LOCALE_PREF_COOKIE } from "@/lib/i18n-routing";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";

const ORIGIN = "http://localhost:3000";
const [SESSION_COOKIE] = sessionCookieNames(undefined);
const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1";

function request(
  pathAndQuery: string,
  { cookies, language, userAgent = BROWSER }: { cookies?: Record<string, string>; language?: string; userAgent?: string } = {}
) {
  const headers = new Headers({ "user-agent": userAgent });
  if (language) headers.set("accept-language", language);
  if (cookies) {
    headers.set(
      "cookie",
      Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
  }
  return new NextRequest(`${ORIGIN}${pathAndQuery}`, { headers });
}

const isRedirect = (status: number) => status >= 300 && status < 400;

// The page files are for anonymous visitors from ads: any path the proxy
// handles and doesn't treat as public is sent to /login. They stay out of it
// by being excluded from the matcher, like offline.html and sw.js are.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it.each([
    "/sales-pages/sales-page-1.html",
    "/sales-pages/sales-page-1.en.html",
    "/sales-pages/sales-page-3.id.html",
    "/sales-pages/tracker.js",
    "/sales-pages/lang-switch.js",
  ])("skips the page file %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(["/sales-page-1", "/en/sales-page-2", "/id/sales-page-3", "/stores", "/register", "/"])(
    "handles %s (the sales page URLs for their language redirect)",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    }
  );
});

describe("proxy: /sales-page-N", () => {
  it.each([
    ["a French browser", "fr-FR,fr;q=0.9"],
    ["no Accept-Language", undefined],
  ])("serves the French page to %s, without a session", async (_label, language) => {
    const res = await proxy(request("/sales-page-1", { language }));

    expect(isRedirect(res.status)).toBe(false);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each([
    ["en-US,en;q=0.9", "/en/sales-page-1"],
    ["id-ID,id;q=0.9", "/id/sales-page-1"],
  ])("sends a %s browser to its language, keeping the ad's tags", async (language, path) => {
    const res = await proxy(request("/sales-page-1?utm_source=meta&utm_campaign=x", { language }));

    expect(isRedirect(res.status)).toBe(true);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe(path);
    expect(location.search).toBe("?utm_source=meta&utm_campaign=x");
    // Depends on the visitor's cookie and language: never cached.
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("follows the language picked in the switcher over the browser's", async () => {
    const res = await proxy(
      request("/sales-page-2", { language: "fr-FR", cookies: { [LOCALE_PREF_COOKIE]: "id" } })
    );

    expect(new URL(res.headers.get("location") as string).pathname).toBe("/id/sales-page-2");
  });

  it("keeps a visitor who picked French on French, whatever the browser says", async () => {
    const res = await proxy(
      request("/sales-page-2", { language: "en-US", cookies: { [LOCALE_PREF_COOKIE]: "fr" } })
    );

    expect(isRedirect(res.status)).toBe(false);
  });

  it("never redirects a crawler", async () => {
    const res = await proxy(
      request("/sales-page-3", { language: "en-US", userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" })
    );

    expect(isRedirect(res.status)).toBe(false);
  });

  it.each(["/en/sales-page-1", "/id/sales-page-3"])(
    "serves %s as it is, without a session and whatever the saved language",
    async (path) => {
      const res = await proxy(request(path, { cookies: { [LOCALE_PREF_COOKIE]: "fr" } }));

      expect(isRedirect(res.status)).toBe(false);
      expect(res.headers.get("location")).toBeNull();
    }
  );

  it("does not send a signed-in visitor back to their last app page", async () => {
    const res = await proxy(
      request("/sales-page-1", {
        language: "fr-FR",
        cookies: {
          [SESSION_COOKIE]: "t",
          [REMEMBER_PREF_COOKIE]: "true",
          [LAST_VISITED_COOKIE]: encodeURIComponent("/store/abc/pos"),
        },
      })
    );

    expect(isRedirect(res.status)).toBe(false);
  });
});

describe("next.config rewrites: URL to page file", () => {
  it("serves each language from its file", async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual(
      expect.arrayContaining([
        { source: "/:page(sales-page-\\d+)", destination: "/sales-pages/:page.html" },
        {
          source: "/:locale(en|id)/:page(sales-page-\\d+)",
          destination: "/sales-pages/:page.:locale.html",
        },
      ])
    );
  });
});
