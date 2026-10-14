// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const ORIGIN = "http://localhost:3000";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

function request(path: string, userAgent: string, language = "en-US,en;q=0.9") {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: { "user-agent": userAgent, "accept-language": language },
  });
}

const isRedirect = (status: number) => status >= 300 && status < 400;

describe("proxy: unprefixed (French) marketing pages", () => {
  it("sends an English browser to /en, and no shared cache may keep that redirect", async () => {
    const res = await proxy(request("/pricing", CHROME));
    expect(isRedirect(res.status)).toBe(true);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/en/pricing");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("vary")).toMatch(/Accept-Language/);
    expect(res.headers.get("vary")).toMatch(/Cookie/);
  });

  it.each([
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    [
      "Search Console URL inspection",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)",
    ],
    ["GoogleOther", "Mozilla/5.0 (compatible; GoogleOther)"],
    [
      "PageSpeed Insights",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Chrome-Lighthouse",
    ],
    [
      "Bing preview",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BingPreview/1.0b",
    ],
  ])("serves %s the French page itself, whatever its language", async (_, userAgent) => {
    for (const path of ["/", "/pricing"]) {
      const res = await proxy(request(path, userAgent));
      expect(isRedirect(res.status), `${path}`).toBe(false);
    }
  });
});
