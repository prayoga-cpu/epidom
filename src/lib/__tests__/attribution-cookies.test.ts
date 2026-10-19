import { describe, it, expect } from "vitest";
import {
  SOURCE_COOKIE,
  TOUCH_COOKIE,
  attributionFromCookieHeader,
  cookieFromHeader,
  normalizeRefCode,
  parseSource,
  parseTouch,
  sameTags,
  serializeSource,
  serializeTouch,
  touchFromRequest,
} from "@/lib/attribution/cookies";
import { sharedCookieDomainForHost } from "@/lib/auth/cookies";

const NOW = Date.UTC(2026, 9, 20, 8, 0, 0);
const AT = Math.floor(NOW / 1000);

describe("normalizeRefCode", () => {
  it("upper-cases and trims a valid code", () => {
    expect(normalizeRefCode(" bob ")).toBe("BOB");
    expect(normalizeRefCode("aaron_fr-2")).toBe("AARON_FR-2");
  });

  it.each([null, "", "ab", "a".repeat(33), "bob.smith", "bob smith", "<script>", "böb"])(
    "rejects %s",
    (raw) => {
      expect(normalizeRefCode(raw)).toBeNull();
    }
  );
});

describe("source cookie", () => {
  it("round-trips a referral link and a sales page", () => {
    const ref = { kind: "ref" as const, code: "BOB", at: AT };
    const page = {
      kind: "page" as const,
      page: "sales-page-2" as const,
      locale: "en" as const,
      at: AT,
    };
    expect(serializeSource(ref)).toBe(`ref.BOB.${AT}`);
    expect(serializeSource(page)).toBe(`page.sales-page-2.en.${AT}`);
    expect(parseSource(serializeSource(ref))).toEqual(ref);
    expect(parseSource(serializeSource(page))).toEqual(page);
  });

  it.each([
    "",
    "ref.BOB",
    "ref.x.123",
    "ref.BOB.abc",
    "page.sales-page-9.fr.123",
    "page.sales-page-2.de.123",
    "page.sales-page-2.123",
    "other.BOB.123",
  ])("ignores %j", (value) => {
    expect(parseSource(value)).toBeNull();
  });
});

describe("touch cookie", () => {
  const url = (q: string, path = "/sales-page-2") => new URL(`https://epidom.fr${path}?${q}`);

  it("is only made from a URL with campaign tags or an ad click id", () => {
    expect(touchFromRequest(url("lang=en"), null, NOW)).toBeNull();
    expect(touchFromRequest(url("utm_source=facebook"), null, NOW)).toEqual({
      utmSource: "facebook",
      landingPath: "/sales-page-2",
      at: AT,
    });
    expect(touchFromRequest(url("fbclid=IwAR123"), null, NOW)).toEqual({
      adClick: "meta",
      landingPath: "/sales-page-2",
      at: AT,
    });
    expect(touchFromRequest(url("gclid=x"), null, NOW)?.adClick).toBe("google");
    expect(touchFromRequest(url("ttclid=x"), null, NOW)?.adClick).toBe("tiktok");
  });

  it("keeps every utm tag, the landing path and an outside referrer, never the click id", () => {
    const touch = touchFromRequest(
      url(
        "utm_source=facebook&utm_medium=paid&utm_campaign=oct&utm_content=video-a&utm_term=pos&fbclid=SECRET"
      ),
      "https://l.facebook.com/",
      NOW
    );
    expect(touch).toEqual({
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "oct",
      utmContent: "video-a",
      utmTerm: "pos",
      adClick: "meta",
      landingPath: "/sales-page-2",
      referrerHost: "l.facebook.com",
      at: AT,
    });
    expect(serializeTouch(touch!)).not.toContain("SECRET");
  });

  it("does not count our own site (apex or www) as the referrer", () => {
    expect(
      touchFromRequest(url("utm_source=x", "/register"), "https://www.epidom.fr/sales-page-2", NOW)
        ?.referrerHost
    ).toBeUndefined();
  });

  it("caps long values and strips control characters", () => {
    const touch = touchFromRequest(url(`utm_campaign=${"a".repeat(500)}%0A`), null, NOW)!;
    expect(touch.utmCampaign).toHaveLength(200);
  });

  it("round-trips, and tells same tags from new ones", () => {
    const a = touchFromRequest(url("utm_source=facebook&utm_campaign=oct"), null, NOW)!;
    expect(parseTouch(serializeTouch(a))).toEqual(a);
    const forwarded = touchFromRequest(
      url("utm_source=facebook&utm_campaign=oct", "/register"),
      null,
      NOW + 60_000
    )!;
    expect(sameTags(a, forwarded)).toBe(true);
    const other = touchFromRequest(url("utm_source=facebook&utm_campaign=nov"), null, NOW)!;
    expect(sameTags(a, other)).toBe(false);
  });

  it.each(["", "null", "{", "[]", '{"s":"x"}', '{"at":"soon"}'])("ignores %j", (value) => {
    expect(parseTouch(value)).toBeNull();
  });
});

describe("cookieFromHeader", () => {
  it("finds and URI-decodes one cookie", () => {
    expect(cookieFromHeader("a=1; epidom_touch=%7B%22at%22%3A1%7D; b=2", "epidom_touch")).toBe(
      '{"at":1}'
    );
    expect(cookieFromHeader("a=1", "epidom_touch")).toBeNull();
    expect(cookieFromHeader(null, "a")).toBeNull();
    expect(cookieFromHeader("a=%E0%A4%A", "a")).toBe("%E0%A4%A");
  });
});

describe("attributionFromCookieHeader", () => {
  const touch = encodeURIComponent(
    serializeTouch({
      utmSource: "facebook",
      utmCampaign: "oct",
      adClick: "meta",
      landingPath: "/sales-page-2",
      referrerHost: "l.facebook.com",
      at: AT,
    })
  );

  it("credits the referral link when it was opened last", () => {
    const data = attributionFromCookieHeader(
      `${SOURCE_COOKIE}=ref.BOB.${AT}; epidom_sales_page=sales-page-2.fr; ${TOUCH_COOKIE}=${touch}`
    );
    expect(data).toMatchObject({
      source: "REFERRAL_LINK",
      refCode: "BOB",
      salesPage: null,
      salesPageLocale: null,
      sourceAt: new Date(AT * 1000),
      utmSource: "facebook",
      utmCampaign: "oct",
      adClick: "meta",
      landingPath: "/sales-page-2",
      referrerHost: "l.facebook.com",
      touchedAt: new Date(AT * 1000),
    });
  });

  it("credits the sales page when it was opened last", () => {
    const data = attributionFromCookieHeader(
      `${SOURCE_COOKIE}=page.sales-page-2.en.${AT}; epidom_sales_page=sales-page-3.fr`
    );
    expect(data).toMatchObject({
      source: "SALES_PAGE",
      refCode: null,
      salesPage: "sales-page-2",
      salesPageLocale: "en",
    });
  });

  it("falls back to the sales-page cookie of a browser from before the source cookie", () => {
    expect(attributionFromCookieHeader("epidom_sales_page=sales-page-4.id")).toMatchObject({
      source: "SALES_PAGE",
      salesPage: "sales-page-4",
      salesPageLocale: "id",
      sourceAt: null,
    });
  });

  it("records Meta's _fbc cookie when the visitor allowed it", () => {
    expect(attributionFromCookieHeader("_fbc=fb.1.1760000000000.IwAR123").fbc).toBe(
      "fb.1.1760000000000.IwAR123"
    );
  });

  it("is all empty for a direct sign-up or garbage", () => {
    for (const header of [null, "", "better-auth.session_token=x", `${SOURCE_COOKIE}=junk`]) {
      const data = attributionFromCookieHeader(header);
      expect(Object.values(data).every((v) => v === null)).toBe(true);
    }
  });
});

describe("sharedCookieDomainForHost", () => {
  it.each([
    ["epidom.fr", ".epidom.fr"],
    ["www.epidom.fr", ".epidom.fr"],
    ["dev.epidom.fr", undefined],
    ["localhost", undefined],
    ["127.0.0.1", undefined],
    ["epidom-git-x.vercel.app", undefined],
    [undefined, undefined],
  ])("%s → %s", (host, domain) => {
    expect(sharedCookieDomainForHost(host)).toBe(domain);
  });
});
