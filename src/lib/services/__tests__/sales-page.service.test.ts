import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPageEvent: { create: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    signupAttribution: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getSalesPageReport,
  recordSalesPageSignup,
  signupPlanStatus,
  summarizeCampaigns,
  summarizeSalesPages,
  type SalesPageEventGroup,
  type TrackedSignupRow,
} from "../sales-page.service";

const create = prisma.salesPageEvent.create as unknown as ReturnType<typeof vi.fn>;
const groupBy = prisma.salesPageEvent.groupBy as unknown as ReturnType<typeof vi.fn>;
const findMany = prisma.salesPageEvent.findMany as unknown as ReturnType<typeof vi.fn>;
const attributionFindMany = prisma.signupAttribution.findMany as unknown as ReturnType<
  typeof vi.fn
>;
const attributionCount = prisma.signupAttribution.count as unknown as ReturnType<typeof vi.fn>;

const g = (
  page: string,
  type: SalesPageEventGroup["type"],
  visitorHash: string | null,
  count = 1,
  cta: string | null = null
): SalesPageEventGroup => ({ page, type, cta, visitorHash, count });

describe("recordSalesPageSignup", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });

  it("credits the account to the page and language in the cookie", async () => {
    const visit = await recordSalesPageSignup(
      "user_1",
      "better-auth.session_token=abc; epidom_sales_page=sales-page-2.id; other=1"
    );

    expect(visit).toEqual({ page: "sales-page-2", locale: "id" });
    expect(create).toHaveBeenCalledWith({
      data: { page: "sales-page-2", locale: "id", type: "SIGNUP", userId: "user_1" },
    });
  });

  it("reads a cookie set before the pages had languages as French", async () => {
    expect(await recordSalesPageSignup("user_1", "epidom_sales_page=sales-page-1")).toEqual({
      page: "sales-page-1",
      locale: "fr",
    });
    expect(create.mock.calls[0][0].data.locale).toBe("fr");
  });

  it.each([
    ["no cookie header", undefined],
    ["no sales-page cookie", "better-auth.session_token=abc"],
    ["a page that does not exist", "epidom_sales_page=sales-page-9"],
    ["a language the pages don't have", "epidom_sales_page=sales-page-1.de"],
  ])("records nothing with %s", async (_label, header) => {
    expect(await recordSalesPageSignup("user_1", header)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("never throws, so a tracking failure cannot fail the signup", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordSalesPageSignup("user_1", "epidom_sales_page=sales-page-1")
    ).resolves.toBeNull();
    spy.mockRestore();
  });
});

describe("summarizeSalesPages", () => {
  it("counts each visitor once per page and turns signups into a rate", () => {
    const { pages } = summarizeSalesPages(
      [
        g("sales-page-1", "VIEW", "a", 3), // one visitor reloading
        g("sales-page-1", "VIEW", "b"),
        g("sales-page-1", "VIEW", "c"),
        g("sales-page-1", "VIEW", "d"),
        g("sales-page-1", "SCROLL_50", "a"),
        g("sales-page-1", "SCROLL_50", "b"),
        g("sales-page-1", "SCROLL_90", "a"),
        g("sales-page-1", "CTA_CLICK", "a", 2, "hero"),
        g("sales-page-1", "CTA_CLICK", "a", 1, "final"),
        g("sales-page-1", "CTA_CLICK", "b", 1, "final"),
        g("sales-page-2", "VIEW", "a"),
      ],
      [
        { page: "sales-page-1", hasStore: true },
        { page: "sales-page-1", hasStore: false },
      ]
    );

    const one = pages.find((p) => p.page === "sales-page-1")!;
    expect(one).toMatchObject({
      views: 6,
      visitors: 4,
      scrolled50: 2,
      scrolled90: 1,
      ctaClicks: 4,
      ctaVisitors: 2,
      signups: 2,
      signupsWithStore: 1,
      clickRate: 0.5,
      signupRate: 0.5,
    });
    expect(one.ctas).toEqual([
      { cta: "final", clicks: 2, visitors: 2 },
      { cta: "hero", clicks: 2, visitors: 1 },
    ]);

    // Every page is listed, in order, even with no traffic.
    expect(pages.map((p) => p.page)).toEqual([
      "sales-page-1",
      "sales-page-2",
      "sales-page-3",
      "sales-page-4",
    ]);
    expect(pages[2]).toMatchObject({ visitors: 0, clickRate: null, signupRate: null });
    expect(pages[3]).toMatchObject({ visitors: 0, clickRate: null, signupRate: null });
  });

  it("names the leader by signup rate", () => {
    const { leader } = summarizeSalesPages(
      [
        g("sales-page-1", "VIEW", "a"),
        g("sales-page-1", "VIEW", "b"),
        g("sales-page-2", "VIEW", "c"),
        g("sales-page-2", "VIEW", "d"),
        g("sales-page-1", "CTA_CLICK", "a", 1, "hero"),
        g("sales-page-1", "CTA_CLICK", "b", 1, "hero"),
      ],
      [{ page: "sales-page-2", hasStore: false }]
    );

    // Page 1 gets more clicks, page 2 the signup: signups win.
    expect(leader).toEqual({ page: "sales-page-2", metric: "signupRate" });
  });

  it("falls back to click rate before the first signup, and calls a tie no lead", () => {
    const clicks = [
      g("sales-page-1", "VIEW", "a"),
      g("sales-page-3", "VIEW", "b"),
      g("sales-page-3", "CTA_CLICK", "b", 1, "calculator"),
    ];
    expect(summarizeSalesPages(clicks, []).leader).toEqual({
      page: "sales-page-3",
      metric: "clickRate",
    });

    const tie = [...clicks, g("sales-page-1", "CTA_CLICK", "a", 1, "hero")];
    expect(summarizeSalesPages(tie, []).leader).toBeNull();
    expect(summarizeSalesPages([], []).leader).toBeNull();
  });
});

describe("getSalesPageReport", () => {
  beforeEach(() => {
    groupBy.mockReset();
    findMany.mockReset();
    attributionFindMany.mockReset();
    attributionFindMany.mockResolvedValue([]);
    attributionCount.mockReset();
    attributionCount.mockResolvedValue(0);
    groupBy.mockResolvedValue([
      {
        page: "sales-page-1",
        type: "VIEW",
        cta: null,
        visitorHash: "a",
        _count: { _all: 2 },
      },
    ]);
    findMany.mockResolvedValue([
      { page: "sales-page-1", user: { business: { _count: { stores: 1 } } } },
      { page: "sales-page-1", user: null }, // account deleted since
    ]);
  });

  it("limits both queries to the range and reads stores off the account", async () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const report = await getSalesPageReport("7", "all", now);

    const since = new Date("2026-09-30T12:00:00Z");
    expect(groupBy.mock.calls[0][0].where).toEqual({
      type: { not: "SIGNUP" },
      createdAt: { gte: since },
    });
    expect(findMany.mock.calls[0][0].where).toEqual({ type: "SIGNUP", createdAt: { gte: since } });
    expect(report.since).toBe(since.toISOString());
    expect(report.lang).toBe("all");
    expect(report.pages[0]).toMatchObject({ views: 2, visitors: 1, signups: 2, signupsWithStore: 1 });
  });

  it("limits both queries to one language when asked", async () => {
    const report = await getSalesPageReport("30", "en");

    expect(groupBy.mock.calls[0][0].where.locale).toBe("en");
    expect(findMany.mock.calls[0][0].where.locale).toBe("en");
    expect(report.lang).toBe("en");
  });

  it("has no lower bound for all time, and no language limit for all languages", async () => {
    const report = await getSalesPageReport("all", "all");

    expect(groupBy.mock.calls[0][0].where.createdAt).toBeUndefined();
    expect(groupBy.mock.calls[0][0].where.locale).toBeUndefined();
    expect(report.since).toBeNull();
  });

  it("limits every query to the picked days, both included (UTC)", async () => {
    const report = await getSalesPageReport({ from: "2026-10-01", to: "2026-10-15" }, "all");

    const bounds = {
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-16T00:00:00.000Z"),
    };
    expect(groupBy.mock.calls[0][0].where.createdAt).toEqual(bounds);
    expect(findMany.mock.calls[0][0].where.createdAt).toEqual(bounds);
    expect(attributionFindMany.mock.calls[0][0].where.createdAt).toEqual(bounds);
    expect(attributionCount.mock.calls[0][0].where.createdAt).toEqual(bounds);
    expect(report).toMatchObject({
      range: "custom",
      custom: { from: "2026-10-01", to: "2026-10-15" },
      since: "2026-10-01T00:00:00.000Z",
      until: "2026-10-16T00:00:00.000Z",
    });
  });

  it("a preset runs to now: no end bound", async () => {
    const report = await getSalesPageReport("30", "all");
    expect(report).toMatchObject({ range: "30", custom: null, until: null });
  });
});

describe("signupPlanStatus", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const sub = (over: Partial<Parameters<typeof signupPlanStatus>[0] & object> = {}) => ({
    plan: "POS",
    status: "ACTIVE",
    trialEndsAt: null as Date | null,
    stripeSubscriptionId: "sub_1" as string | null,
    ...over,
  });

  it("reads each subscription state", () => {
    expect(signupPlanStatus(null, now)).toBe("FREE");
    expect(signupPlanStatus(sub({ plan: "FREE" }), now)).toBe("FREE");
    expect(signupPlanStatus(sub({ status: "INCOMPLETE" }), now)).toBe("CHECKOUT");
    expect(signupPlanStatus(sub({ trialEndsAt: new Date("2026-10-30T00:00:00Z") }), now)).toBe(
      "TRIAL"
    );
    expect(signupPlanStatus(sub({ trialEndsAt: new Date("2026-10-01T00:00:00Z") }), now)).toBe(
      "ACTIVE"
    );
    expect(signupPlanStatus(sub(), now)).toBe("ACTIVE");
    expect(signupPlanStatus(sub({ status: "PAST_DUE" }), now)).toBe("PAST_DUE");
    expect(signupPlanStatus(sub({ status: "CANCELED" }), now)).toBe("CANCELED");
    // An admin-granted plan has no Stripe subscription: not a paying customer.
    expect(signupPlanStatus(sub({ stripeSubscriptionId: null }), now)).toBe("GRANTED");
  });
});

describe("summarizeCampaigns", () => {
  const row = (over: Partial<TrackedSignupRow>): TrackedSignupRow => ({
    createdAt: "2026-10-20T10:00:00.000Z",
    source: "SALES_PAGE",
    refCode: null,
    salesPage: "sales-page-2",
    salesPageLocale: "fr",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    adClick: null,
    plan: "FREE",
    status: "FREE",
    hasStore: false,
    ...over,
  });

  it("groups by source and campaign, counting trials and paying accounts", () => {
    const rows = [
      row({ utmSource: "facebook", utmCampaign: "oct", status: "ACTIVE", plan: "POS" }),
      row({ utmSource: "facebook", utmCampaign: "oct", status: "TRIAL", plan: "POS" }),
      row({ utmSource: "facebook", utmCampaign: "oct" }),
      row({ utmSource: "instagram", utmCampaign: "oct" }),
      row({}),
    ];
    expect(summarizeCampaigns(rows)).toEqual([
      { utmSource: "facebook", utmCampaign: "oct", signups: 3, trials: 1, paying: 1 },
      { utmSource: "instagram", utmCampaign: "oct", signups: 1, trials: 0, paying: 0 },
      { utmSource: null, utmCampaign: null, signups: 1, trials: 0, paying: 0 },
    ]);
  });
});

describe("getSalesPageReport: tracked sign-ups", () => {
  beforeEach(() => {
    groupBy.mockReset();
    groupBy.mockResolvedValue([]);
    findMany.mockReset();
    findMany.mockResolvedValue([]);
    attributionFindMany.mockReset();
    attributionCount.mockReset();
    attributionCount.mockResolvedValue(7);
    attributionFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-10-20T09:00:00Z"),
        source: "SALES_PAGE",
        refCode: null,
        salesPage: "sales-page-2",
        salesPageLocale: "en",
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "oct-launch",
        utmContent: "video-a",
        adClick: "meta",
        user: {
          subscription: {
            plan: "POS",
            status: "ACTIVE",
            trialEndsAt: new Date("2026-11-01T00:00:00Z"),
            stripeSubscriptionId: "sub_1",
          },
          business: { _count: { stores: 1 } },
        },
      },
    ]);
  });

  it("lists sign-ups with a source or ad tags, with the plan they are on now", async () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const report = await getSalesPageReport("30", "en", now);

    const where = attributionFindMany.mock.calls[0][0].where;
    expect(where.salesPageLocale).toBe("en");
    expect(where.createdAt).toEqual({ gte: new Date("2026-09-21T00:00:00Z") });
    expect(where.OR).toHaveLength(4);
    expect(attributionCount.mock.calls[0][0].where).toEqual({
      createdAt: { gte: new Date("2026-09-21T00:00:00Z") },
    });

    expect(report.tracked.totalSignups).toBe(7);
    expect(report.tracked.rows).toEqual([
      expect.objectContaining({
        salesPage: "sales-page-2",
        utmCampaign: "oct-launch",
        adClick: "meta",
        plan: "POS",
        status: "TRIAL",
        hasStore: true,
      }),
    ]);
    expect(report.tracked.campaigns).toEqual([
      { utmSource: "facebook", utmCampaign: "oct-launch", signups: 1, trials: 1, paying: 0 },
    ]);
  });
});

describe("getSalesPageReport: one partner's pages", () => {
  beforeEach(() => {
    groupBy.mockReset();
    groupBy.mockResolvedValue([]);
    findMany.mockReset();
    findMany.mockResolvedValue([]);
    attributionFindMany.mockReset();
    attributionFindMany.mockResolvedValue([]);
    attributionCount.mockReset();
    attributionCount.mockResolvedValue(0);
  });

  it("limits every query and the cards to those pages, and calls no leader", async () => {
    const report = await getSalesPageReport("all", "all", new Date(), ["sales-page-2"]);

    expect(groupBy.mock.calls[0][0].where.page).toEqual({ in: ["sales-page-2"] });
    expect(findMany.mock.calls[0][0].where.page).toEqual({ in: ["sales-page-2"] });
    expect(attributionFindMany.mock.calls[0][0].where.salesPage).toEqual({ in: ["sales-page-2"] });
    expect(attributionCount.mock.calls[0][0].where.salesPage).toEqual({ in: ["sales-page-2"] });
    expect(report.pages.map((p) => p.page)).toEqual(["sales-page-2"]);
    expect(report.leader).toBeNull();
  });
});
