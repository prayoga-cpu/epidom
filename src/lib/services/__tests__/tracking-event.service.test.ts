// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trackingEvent: { create: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
    user: { count: vi.fn() },
    salesPageEvent: { count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  MAX_REPORT_PAGES,
  getPixelReport,
  recordTrackingEvent,
  summarizePixelEvents,
} from "../tracking-event.service";

const create = prisma.trackingEvent.create as unknown as ReturnType<typeof vi.fn>;

describe("recordTrackingEvent", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });

  it("stores a pixel event with its value and currency", async () => {
    await recordTrackingEvent({
      kind: "PIXEL",
      name: "StartTrial",
      path: "/checkout/success",
      source: "site",
      locale: "fr",
      content: "POS",
      value: 13.99,
      currency: "EUR",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        kind: "PIXEL",
        name: "StartTrial",
        path: "/checkout/success",
        source: "site",
        locale: "fr",
        content: "POS",
        value: 13.99,
        currency: "EUR",
      },
    });
  });

  it("drops a value that has no currency, and a currency with no value", async () => {
    await recordTrackingEvent({
      kind: "PIXEL",
      name: "InitiateCheckout",
      path: "/pricing",
      source: "site",
      value: 10,
    });
    await recordTrackingEvent({
      kind: "PIXEL",
      name: "InitiateCheckout",
      path: "/pricing",
      source: "site",
      currency: "USD",
    });

    for (const [arg] of create.mock.calls) {
      expect(arg.data.value).toBeUndefined();
      expect(arg.data.currency).toBeUndefined();
    }
  });

  it("stores a cookie-bar answer with what it allowed", async () => {
    await recordTrackingEvent({
      kind: "CONSENT",
      name: "CUSTOM",
      path: "/sales-page-1",
      source: "sales_page",
      locale: "fr",
      analytics: true,
      marketing: false,
    });

    expect(create.mock.calls[0][0].data).toEqual({
      kind: "CONSENT",
      name: "CUSTOM",
      path: "/sales-page-1",
      source: "sales_page",
      locale: "fr",
      analytics: true,
      marketing: false,
    });
  });
});

describe("summarizePixelEvents", () => {
  const empty = { pixel: [], values: [], consent: [], days: [], accountsCreated: 0 };

  it("lists every event in funnel order, with zero for the ones never sent", () => {
    const { totals } = summarizePixelEvents(empty);
    expect(totals.map((t) => t.name)).toEqual([
      "PageView",
      "ViewContent",
      "SignUpClick",
      "CompleteRegistration",
      "Contact",
      "Lead",
      "InitiateCheckout",
      "StartTrial",
      "Subscribe",
    ]);
    expect(totals.every((t) => t.count === 0 && t.values.length === 0)).toBe(true);
  });

  it("adds up counts per event and per page, values per currency", () => {
    const report = summarizePixelEvents({
      ...empty,
      pixel: [
        { name: "PageView", path: "/", source: "site", count: 40 },
        { name: "PageView", path: "/sales-page-1", source: "sales_page", count: 12 },
        { name: "ViewContent", path: "/sales-page-1", source: "sales_page", count: 12 },
        { name: "CompleteRegistration", path: "/register", source: "site", count: 3 },
        { name: "StartTrial", path: "/checkout/success", source: "site", count: 2 },
        { name: "Unknown", path: "/x", source: "site", count: 99 },
      ],
      values: [
        { name: "StartTrial", currency: "EUR", total: 27.98 },
        { name: "StartTrial", currency: "IDR", total: 229000 },
        { name: "StartTrial", currency: null, total: 5 },
      ],
      accountsCreated: 6,
    });

    const total = (name: string) => report.totals.find((t) => t.name === name)!;
    expect(total("PageView").count).toBe(52);
    expect(total("StartTrial").values).toEqual([
      { currency: "EUR", total: 27.98 },
      { currency: "IDR", total: 229000 },
    ]);
    expect(report.pages[0]).toEqual({ path: "/", source: "site", total: 40, counts: { PageView: 40 } });
    expect(report.pages[1]).toEqual({
      path: "/sales-page-1",
      source: "sales_page",
      total: 24,
      counts: { PageView: 12, ViewContent: 12 },
    });
    expect(report.pages.some((p) => p.path === "/x")).toBe(false);
    expect(report.coverage).toEqual({ accountsCreated: 6, completeRegistrations: 3, rate: 0.5 });
  });

  it("keeps the busiest pages only", () => {
    const pixel = Array.from({ length: MAX_REPORT_PAGES + 5 }, (_, i) => ({
      name: "PageView",
      path: `/p${i}`,
      source: "site",
      count: i + 1,
    }));
    const { pages } = summarizePixelEvents({ ...empty, pixel });
    expect(pages).toHaveLength(MAX_REPORT_PAGES);
    expect(pages[0].path).toBe(`/p${MAX_REPORT_PAGES + 4}`);
  });

  it("splits cookie-bar answers by source and counts who allowed the pixel", () => {
    const { consent } = summarizePixelEvents({
      ...empty,
      consent: [
        { name: "ACCEPT_ALL", source: "site", marketing: true, count: 6 },
        { name: "REJECT_ALL", source: "site", marketing: false, count: 3 },
        { name: "CUSTOM", source: "site", marketing: true, count: 1 },
        { name: "ACCEPT_ALL", source: "sales_page", marketing: true, count: 2 },
        { name: "CUSTOM", source: "sales_page", marketing: false, count: 2 },
        { name: "AUTO", source: "sales_page", marketing: true, count: 4 },
      ],
    });

    expect(consent.answers).toBe(18);
    expect(consent.marketingAllowed).toBe(13);
    expect(consent.auto).toBe(4);
    expect(consent.bySource.site).toEqual({
      answers: 10,
      acceptAll: 6,
      rejectAll: 3,
      custom: 1,
      auto: 0,
      marketingAllowed: 7,
      marketingRate: 0.7,
    });
    expect(consent.bySource.sales_page).toMatchObject({ answers: 8, auto: 4, marketingAllowed: 6 });
    expect(consent.bySource.sales_page.marketingRate).toBe(0.75);
  });

  it("orders days newest first and has no rate without accounts", () => {
    const report = summarizePixelEvents({
      ...empty,
      days: [
        { day: "2026-10-15", name: "PageView", count: 4 },
        { day: "2026-10-16", name: "PageView", count: 7 },
        { day: "2026-10-16", name: "Contact", count: 1 },
      ],
    });
    expect(report.days).toEqual([
      { day: "2026-10-16", counts: { PageView: 7, Contact: 1 } },
      { day: "2026-10-15", counts: { PageView: 4 } },
    ]);
    expect(report.coverage.rate).toBeNull();
  });
});

describe("getPixelReport: date range", () => {
  const p = prisma as unknown as {
    trackingEvent: { groupBy: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
    user: { count: ReturnType<typeof vi.fn> };
    salesPageEvent: { count: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    p.trackingEvent.groupBy.mockReset().mockResolvedValue([]);
    p.trackingEvent.findFirst.mockReset().mockResolvedValue(null);
    p.user.count.mockReset().mockResolvedValue(0);
    p.salesPageEvent.count.mockReset().mockResolvedValue(0);
    p.$queryRaw.mockReset().mockResolvedValue([]);
  });

  it("limits every count and the day-by-day query to the picked days (UTC, both included)", async () => {
    const report = await getPixelReport({ from: "2026-10-01", to: "2026-10-03" });

    const bounds = {
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-04T00:00:00.000Z"),
    };
    for (const call of p.trackingEvent.groupBy.mock.calls) {
      expect(call[0].where.createdAt).toEqual(bounds);
    }
    expect(p.user.count.mock.calls[0][0].where.createdAt).toEqual(bounds);
    expect(p.salesPageEvent.count.mock.calls[0][0].where.createdAt).toEqual(bounds);
    // The tagged template's values: the since and until bounds.
    expect(p.$queryRaw.mock.calls[0].slice(1)).toEqual([bounds.gte, bounds.lt]);
    expect(report).toMatchObject({
      range: "custom",
      custom: { from: "2026-10-01", to: "2026-10-03" },
      since: "2026-10-01T00:00:00.000Z",
      until: "2026-10-04T00:00:00.000Z",
    });
  });

  it("a preset counts back from now", async () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const report = await getPixelReport("7", now);

    expect(p.user.count.mock.calls[0][0].where.createdAt.gte).toEqual(new Date("2026-10-12T12:00:00Z"));
    expect(report).toMatchObject({ range: "7", custom: null, until: null });
  });
});
