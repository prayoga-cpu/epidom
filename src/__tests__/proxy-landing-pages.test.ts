// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const ORIGIN = "http://localhost:3000";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const request = (path: string, userAgent = CHROME, language = "en-US,en;q=0.9") =>
  new NextRequest(`${ORIGIN}${path}`, {
    headers: { "user-agent": userAgent, "accept-language": language },
  });

const locationOf = (res: Response) => new URL(res.headers.get("location") as string).pathname;

describe("proxy: search landing pages live in one language", () => {
  it("serves a French page to an English browser instead of sending it to a missing /en copy", async () => {
    const res = await proxy(request("/calcul-cout-de-revient"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBeLessThan(300);
  });

  it.each([
    ["/en/calcul-cout-de-revient", "/calcul-cout-de-revient"],
    ["/id/calcul-cout-de-revient", "/calcul-cout-de-revient"],
    ["/kalkulator-hpp", "/id/kalkulator-hpp"],
    ["/en/kalkulator-hpp", "/id/kalkulator-hpp"],
    ["/recipe-cost-calculator", "/en/recipe-cost-calculator"],
  ])("sends %s to the page's own URL for good (308)", async (path, target) => {
    for (const ua of [CHROME, GOOGLEBOT]) {
      const res = await proxy(request(path, ua));
      expect(res.status, `${path} ${ua.slice(0, 20)}`).toBe(308);
      expect(locationOf(res)).toBe(target);
    }
  });

  it("serves the prefixed page itself, whatever the browser's language", async () => {
    for (const language of ["fr-FR", "en-US", "id-ID"]) {
      const res = await proxy(request("/id/kalkulator-hpp", CHROME, language));
      expect(res.headers.get("location"), language).toBeNull();
      expect(res.status).toBeLessThan(300);
    }
  });

  it("needs no session: a landing page is public", async () => {
    const res = await proxy(request("/en/kitchen-display-system"));
    expect(res.headers.get("location") ?? "").not.toContain("/login");
  });
});
