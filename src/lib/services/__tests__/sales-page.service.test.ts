import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { salesPageEvent: { create: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  getSalesPageReport,
  recordSalesPageSignup,
  summarizeSalesPages,
  type SalesPageEventGroup,
} from "../sales-page.service";

const create = prisma.salesPageEvent.create as unknown as ReturnType<typeof vi.fn>;
const groupBy = prisma.salesPageEvent.groupBy as unknown as ReturnType<typeof vi.fn>;
const findMany = prisma.salesPageEvent.findMany as unknown as ReturnType<typeof vi.fn>;

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

  it("credits the account to the page in the cookie", async () => {
    const page = await recordSalesPageSignup(
      "user_1",
      "better-auth.session_token=abc; epidom_sales_page=sales-page-2; other=1"
    );

    expect(page).toBe("sales-page-2");
    expect(create).toHaveBeenCalledWith({
      data: { page: "sales-page-2", type: "SIGNUP", userId: "user_1" },
    });
  });

  it.each([
    ["no cookie header", undefined],
    ["no sales-page cookie", "better-auth.session_token=abc"],
    ["a page that does not exist", "epidom_sales_page=sales-page-9"],
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
    expect(pages.map((p) => p.page)).toEqual(["sales-page-1", "sales-page-2", "sales-page-3"]);
    expect(pages[2]).toMatchObject({ visitors: 0, clickRate: null, signupRate: null });
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
    const report = await getSalesPageReport("7", now);

    const since = new Date("2026-09-30T12:00:00Z");
    expect(groupBy.mock.calls[0][0].where).toEqual({
      type: { not: "SIGNUP" },
      createdAt: { gte: since },
    });
    expect(findMany.mock.calls[0][0].where).toEqual({ type: "SIGNUP", createdAt: { gte: since } });
    expect(report.since).toBe(since.toISOString());
    expect(report.pages[0]).toMatchObject({ views: 2, visitors: 1, signups: 2, signupsWithStore: 1 });
  });

  it("has no lower bound for all time", async () => {
    const report = await getSalesPageReport("all");

    expect(groupBy.mock.calls[0][0].where.createdAt).toBeUndefined();
    expect(report.since).toBeNull();
  });
});
