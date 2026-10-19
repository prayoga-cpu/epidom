// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { SOURCE_COOKIE, TOUCH_COOKIE, parseSource, parseTouch } from "@/lib/attribution/cookies";
import { SALES_PAGE_COOKIE } from "@/lib/sales-pages";

const BROWSER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1";

function request(
  url: string,
  {
    cookie,
    lang = "fr-FR",
    ua = BROWSER,
    referer,
  }: { cookie?: string; lang?: string; ua?: string; referer?: string } = {}
) {
  const headers = new Headers({ "user-agent": ua, "accept-language": lang });
  if (cookie) headers.set("cookie", cookie);
  if (referer) headers.set("referer", referer);
  return new NextRequest(url, { headers });
}

/** Every Set-Cookie on a response, by name: { value, attributes }. */
function setCookies(res: Response): Map<string, { value: string; attrs: string }> {
  const out = new Map<string, { value: string; attrs: string }>();
  const lines =
    (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[^;,]+=)/);
  for (const line of lines) {
    const [pair, ...attrs] = line.trim().split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out.set(pair.slice(0, eq), {
      value: decodeURIComponent(pair.slice(eq + 1)),
      attrs: attrs.join(";"),
    });
  }
  return out;
}

describe("proxy: where a sign-up comes from", () => {
  it("a referral link on /register remembers the code, shared by apex and www", async () => {
    const res = await proxy(request("https://www.epidom.fr/register?ref=bob"));
    const source = setCookies(res).get(SOURCE_COOKIE);
    expect(parseSource(source?.value)).toMatchObject({ kind: "ref", code: "BOB" });
    expect(source?.attrs).toMatch(/Domain=\.epidom\.fr/i);
    expect(source?.attrs).toMatch(/Max-Age=2592000/i);
    expect(source?.attrs).not.toMatch(/HttpOnly/i);
  });

  it.each(["/", "/pricing", "/id", "/en"])("a referral link on %s counts", async (path) => {
    const res = await proxy(request(`https://epidom.fr${path}?ref=BOB`, { lang: "fr-FR" }));
    expect(res.status).toBeLessThan(300);
    expect(parseSource(setCookies(res).get(SOURCE_COOKIE)?.value)).toMatchObject({ code: "BOB" });
  });

  it("?ref= on a sales page can't take the sign-up from the page", async () => {
    const res = await proxy(request("https://epidom.fr/sales-page-2?ref=BOB"));
    expect(parseSource(setCookies(res).get(SOURCE_COOKIE)?.value)).toMatchObject({
      kind: "page",
      page: "sales-page-2",
      locale: "fr",
    });
  });

  it("?ref= elsewhere is ignored", async () => {
    const res = await proxy(request("https://epidom.fr/about?ref=BOB"));
    expect(setCookies(res).has(SOURCE_COOKIE)).toBe(false);
  });

  it("an invalid code is ignored", async () => {
    const res = await proxy(request("https://epidom.fr/register?ref=%3Cx%3E"));
    expect(setCookies(res).has(SOURCE_COOKIE)).toBe(false);
  });

  it("a sales page in another language records the page, its language and a server-side page cookie", async () => {
    const res = await proxy(
      request(
        "https://epidom.fr/id/sales-page-2?utm_source=facebook&utm_campaign=oct&fbclid=IwAR1",
        { lang: "id-ID", referer: "https://m.facebook.com/" }
      )
    );
    const cookies = setCookies(res);
    expect(parseSource(cookies.get(SOURCE_COOKIE)?.value)).toMatchObject({
      kind: "page",
      page: "sales-page-2",
      locale: "id",
    });
    expect(cookies.get(SALES_PAGE_COOKIE)?.value).toBe("sales-page-2.id");
    expect(cookies.get(SALES_PAGE_COOKIE)?.attrs).not.toMatch(/HttpOnly/i);
    const touch = parseTouch(cookies.get(TOUCH_COOKIE)?.value);
    expect(touch).toMatchObject({
      utmSource: "facebook",
      utmCampaign: "oct",
      adClick: "meta",
      landingPath: "/id/sales-page-2",
      referrerHost: "m.facebook.com",
    });
    expect(cookies.get(TOUCH_COOKIE)?.value).not.toContain("IwAR1");
  });

  it("the same sales page again sets nothing new", async () => {
    const first = setCookies(await proxy(request("https://epidom.fr/sales-page-2")));
    const cookie = [SOURCE_COOKIE, SALES_PAGE_COOKIE]
      .map((name) => `${name}=${encodeURIComponent(first.get(name)!.value)}`)
      .join("; ");
    const again = setCookies(await proxy(request("https://epidom.fr/sales-page-2", { cookie })));
    expect(again.has(SOURCE_COOKIE)).toBe(false);
    expect(again.has(SALES_PAGE_COOKIE)).toBe(false);
  });

  it("the sales page's tags forwarded to /register keep the original landing page", async () => {
    const landed = setCookies(
      await proxy(request("https://epidom.fr/sales-page-2?utm_source=facebook&utm_campaign=oct"))
    );
    const cookie = `${TOUCH_COOKIE}=${encodeURIComponent(landed.get(TOUCH_COOKIE)!.value)}`;
    const register = setCookies(
      await proxy(
        request("https://epidom.fr/register?utm_source=facebook&utm_campaign=oct", { cookie })
      )
    );
    expect(register.has(TOUCH_COOKIE)).toBe(false);

    const newCampaign = setCookies(
      await proxy(
        request("https://epidom.fr/register?utm_source=facebook&utm_campaign=nov", { cookie })
      )
    );
    expect(parseTouch(newCampaign.get(TOUCH_COOKIE)?.value)).toMatchObject({
      utmCampaign: "nov",
      landingPath: "/register",
    });
  });

  it("nothing on a redirect: the page it leads to keeps the query and sets them", async () => {
    const res = await proxy(
      request("https://epidom.fr/sales-page-2?utm_source=facebook", { lang: "id-ID" })
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toContain("utm_source=facebook");
  });

  it("nothing for bots", async () => {
    const res = await proxy(
      request("https://epidom.fr/register?ref=BOB&utm_source=x", {
        ua: "Googlebot/2.1 (+http://www.google.com/bot.html)",
      })
    );
    const cookies = setCookies(res);
    expect(cookies.has(SOURCE_COOKIE)).toBe(false);
    expect(cookies.has(TOUCH_COOKIE)).toBe(false);
  });

  it("host-only on a preview subdomain and on localhost", async () => {
    for (const origin of ["https://dev.epidom.fr", "http://localhost:3000"]) {
      const res = await proxy(request(`${origin}/register?ref=BOB`));
      expect(setCookies(res).get(SOURCE_COOKIE)?.attrs).not.toMatch(/Domain=/i);
    }
  });
});
