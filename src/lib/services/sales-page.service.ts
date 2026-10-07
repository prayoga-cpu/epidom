import { prisma } from "@/lib/prisma";
import { SALES_PAGES, salesPageFromCookieHeader, type SalesPage } from "@/lib/sales-pages";
import type {
  RecordSalesPageEventInput,
  SalesPageReportRange,
} from "@/lib/validation/sales-page.schemas";
import type { SalesPageEventType } from "@prisma/client";

/** Store one event from public/sales-pages/tracker.js. */
export async function recordSalesPageEvent(
  input: RecordSalesPageEventInput & { visitorHash: string }
): Promise<void> {
  await prisma.salesPageEvent.create({
    data: {
      page: input.page,
      type: input.type,
      cta: input.type === "CTA_CLICK" ? input.cta : undefined,
      visitorHash: input.visitorHash,
      referrer: input.referrer,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
    },
  });
}

/**
 * Credit a just-created account to the sales page its browser last opened,
 * from the cookie on the signup request (the email signup POST, or Google's
 * OAuth callback). Never throws: a tracking failure must not fail a signup.
 */
export async function recordSalesPageSignup(
  userId: string,
  cookieHeader: string | null | undefined
): Promise<SalesPage | null> {
  const page = salesPageFromCookieHeader(cookieHeader);
  if (!page) return null;
  try {
    await prisma.salesPageEvent.create({ data: { page, type: "SIGNUP", userId } });
    return page;
  } catch (err) {
    console.error("[sales-pages] failed to record signup:", err);
    return null;
  }
}

export interface SalesPageCtaRow {
  cta: string;
  clicks: number;
  visitors: number;
}

export interface SalesPageRow {
  page: SalesPage;
  views: number;
  /** Daily-unique visitors summed over the range (see hashVisitor). */
  visitors: number;
  ctaClicks: number;
  /** Visitors who clicked at least one button. */
  ctaVisitors: number;
  scrolled50: number;
  scrolled90: number;
  signups: number;
  /** Signups whose account has created a store since. */
  signupsWithStore: number;
  /** ctaVisitors / visitors, null with no visitors. */
  clickRate: number | null;
  /** signups / visitors, null with no visitors. */
  signupRate: number | null;
  ctas: SalesPageCtaRow[];
}

export interface SalesPageReport {
  range: SalesPageReportRange;
  since: string | null;
  pages: SalesPageRow[];
  /** Best signup rate, or best click rate while there are no signups yet. */
  leader: { page: SalesPage; metric: "signupRate" | "clickRate" } | null;
}

/** One row of the groupBy in getSalesPageReport. */
export interface SalesPageEventGroup {
  page: string;
  type: SalesPageEventType;
  cta: string | null;
  visitorHash: string | null;
  count: number;
}

/** One SIGNUP row with whether the account has a store now. */
export interface SalesPageSignupRow {
  page: string;
  hasStore: boolean;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/** Pure: turns the grouped events and signups into the per-page report. */
export function summarizeSalesPages(
  groups: SalesPageEventGroup[],
  signups: SalesPageSignupRow[]
): Pick<SalesPageReport, "pages" | "leader"> {
  const pages: SalesPageRow[] = SALES_PAGES.map((page) => {
    const own = groups.filter((g) => g.page === page);
    const distinct = (type: SalesPageEventType) =>
      new Set(own.filter((g) => g.type === type && g.visitorHash).map((g) => g.visitorHash)).size;
    const total = (type: SalesPageEventType) =>
      own.filter((g) => g.type === type).reduce((sum, g) => sum + g.count, 0);

    const ctaMap = new Map<string, { clicks: number; visitors: Set<string> }>();
    for (const g of own) {
      if (g.type !== "CTA_CLICK") continue;
      const key = g.cta ?? "unknown";
      const entry = ctaMap.get(key) ?? { clicks: 0, visitors: new Set<string>() };
      entry.clicks += g.count;
      if (g.visitorHash) entry.visitors.add(g.visitorHash);
      ctaMap.set(key, entry);
    }
    const ctas = [...ctaMap.entries()]
      .map(([cta, e]) => ({ cta, clicks: e.clicks, visitors: e.visitors.size }))
      .sort((a, b) => b.clicks - a.clicks || b.visitors - a.visitors);

    const visitors = distinct("VIEW");
    const ctaVisitors = distinct("CTA_CLICK");
    const ownSignups = signups.filter((s) => s.page === page);

    return {
      page,
      views: total("VIEW"),
      visitors,
      ctaClicks: total("CTA_CLICK"),
      ctaVisitors,
      scrolled50: distinct("SCROLL_50"),
      scrolled90: distinct("SCROLL_90"),
      signups: ownSignups.length,
      signupsWithStore: ownSignups.filter((s) => s.hasStore).length,
      clickRate: ratio(ctaVisitors, visitors),
      signupRate: ratio(ownSignups.length, visitors),
      ctas,
    };
  });

  const best = (metric: "signupRate" | "clickRate") => {
    const ranked = pages
      .filter((p) => (p[metric] ?? 0) > 0)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
    // A tie at the top is not a lead.
    if (ranked.length === 0 || (ranked[1] && ranked[1][metric] === ranked[0][metric])) return null;
    return { page: ranked[0].page, metric };
  };

  return { pages, leader: best("signupRate") ?? best("clickRate") };
}

const RANGE_DAYS: Record<SalesPageReportRange, number | null> = {
  "7": 7,
  "30": 30,
  "90": 90,
  all: null,
};

/**
 * The comparison shown on /admin/sales-pages. Events are grouped down to one
 * row per page, type, button and visitor-day, so the payload grows with
 * visitors, not with clicks.
 */
export async function getSalesPageReport(
  range: SalesPageReportRange,
  now: Date = new Date()
): Promise<SalesPageReport> {
  const days = RANGE_DAYS[range];
  const since = days === null ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const createdAt = since ? { gte: since } : undefined;

  const [grouped, signupRows] = await Promise.all([
    prisma.salesPageEvent.groupBy({
      by: ["page", "type", "cta", "visitorHash"],
      where: { type: { not: "SIGNUP" }, createdAt },
      _count: { _all: true },
    }),
    prisma.salesPageEvent.findMany({
      where: { type: "SIGNUP", createdAt },
      select: {
        page: true,
        user: { select: { business: { select: { _count: { select: { stores: true } } } } } },
      },
    }),
  ]);

  const groups: SalesPageEventGroup[] = grouped.map((g) => ({
    page: g.page,
    type: g.type,
    cta: g.cta,
    visitorHash: g.visitorHash,
    count: g._count._all,
  }));
  const signups: SalesPageSignupRow[] = signupRows.map((s) => ({
    page: s.page,
    hasStore: (s.user?.business?._count.stores ?? 0) > 0,
  }));

  return { range, since: since?.toISOString() ?? null, ...summarizeSalesPages(groups, signups) };
}
