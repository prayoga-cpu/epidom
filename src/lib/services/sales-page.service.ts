import { prisma } from "@/lib/prisma";
import {
  SALES_PAGES,
  salesPageFromCookieHeader,
  type SalesPage,
  type SalesPageLocale,
} from "@/lib/sales-pages";
import type {
  RecordSalesPageEventInput,
  SalesPageReportLang,
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
      locale: input.locale,
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
 * Credit a just-created account to the sales page (and language) its browser
 * last opened, from the cookie on the signup request (the email signup POST,
 * or Google's OAuth callback). Never throws: a tracking failure must not fail
 * a signup.
 */
export async function recordSalesPageSignup(
  userId: string,
  cookieHeader: string | null | undefined
): Promise<{ page: SalesPage; locale: SalesPageLocale } | null> {
  const visit = salesPageFromCookieHeader(cookieHeader);
  if (!visit) return null;
  try {
    await prisma.salesPageEvent.create({
      data: { page: visit.page, locale: visit.locale, type: "SIGNUP", userId },
    });
    return visit;
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
  /** The language the figures are limited to, or "all". */
  lang: SalesPageReportLang;
  since: string | null;
  pages: SalesPageRow[];
  /** Best signup rate, or best click rate while there are no signups yet. */
  leader: { page: SalesPage; metric: "signupRate" | "clickRate" } | null;
  /** Sign-ups with a known source or ad tags (SignupAttribution), newest first. */
  tracked: TrackedSignups;
}

/** Where a sign-up's account stands now, from its Subscription row. */
export type SignupPlanStatus =
  | "FREE"
  | "CHECKOUT" // started a paid checkout, hasn't paid
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "GRANTED"; // a paid plan given without a Stripe subscription (admin)

export interface TrackedSignupRow {
  createdAt: string;
  source: "REFERRAL_LINK" | "SALES_PAGE" | null;
  refCode: string | null;
  salesPage: string | null;
  salesPageLocale: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  adClick: string | null;
  plan: string;
  status: SignupPlanStatus;
  hasStore: boolean;
}

export interface TrackedCampaignRow {
  utmSource: string | null;
  utmCampaign: string | null;
  signups: number;
  trials: number;
  /** ACTIVE on a paid plan through Stripe. */
  paying: number;
}

export interface TrackedSignups {
  /** Every account created in the range (direct ones included), since tracking started. */
  totalSignups: number;
  rows: TrackedSignupRow[];
  /** The list stops at this many rows; the counts above it don't. */
  limit: number;
  campaigns: TrackedCampaignRow[];
}

/** Pure: where an account stands, from its subscription (null = never had one). */
export function signupPlanStatus(
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: Date | null;
    stripeSubscriptionId: string | null;
  } | null,
  now: Date = new Date()
): SignupPlanStatus {
  if (!subscription || subscription.plan === "FREE") return "FREE";
  switch (subscription.status) {
    case "INCOMPLETE":
      return "CHECKOUT";
    case "PAST_DUE":
      return "PAST_DUE";
    case "CANCELED":
      return "CANCELED";
    default:
      if (!subscription.stripeSubscriptionId) return "GRANTED";
      return subscription.trialEndsAt && subscription.trialEndsAt > now ? "TRIAL" : "ACTIVE";
  }
}

/** Pure: sign-ups grouped by ad source and campaign, most sign-ups first. */
export function summarizeCampaigns(rows: TrackedSignupRow[]): TrackedCampaignRow[] {
  const byKey = new Map<string, TrackedCampaignRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.utmSource, row.utmCampaign]);
    const entry = byKey.get(key) ?? {
      utmSource: row.utmSource,
      utmCampaign: row.utmCampaign,
      signups: 0,
      trials: 0,
      paying: 0,
    };
    entry.signups += 1;
    if (row.status === "TRIAL") entry.trials += 1;
    if (row.status === "ACTIVE") entry.paying += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.signups - a.signups || b.paying - a.paying);
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

/** Rows listed under "Tracked sign-ups"; the campaign summary covers the same rows. */
const TRACKED_SIGNUP_LIMIT = 500;

const RANGE_DAYS: Record<SalesPageReportRange, number | null> = {
  "7": 7,
  "30": 30,
  "90": 90,
  all: null,
};

/**
 * The comparison shown on /admin/sales-pages, for one language or all of
 * them. Events are grouped down to one row per page, type, button and
 * visitor-day, so the payload grows with visitors, not with clicks.
 */
export async function getSalesPageReport(
  range: SalesPageReportRange,
  lang: SalesPageReportLang = "all",
  now: Date = new Date(),
  /** Only these pages (a partner's own report); every page when left out. */
  onlyPages?: readonly string[]
): Promise<SalesPageReport> {
  const days = RANGE_DAYS[range];
  const since = days === null ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const createdAt = since ? { gte: since } : undefined;
  const locale = lang === "all" ? undefined : lang;
  const page = onlyPages ? { in: [...onlyPages] } : undefined;

  const [grouped, signupRows, attributionRows, totalSignups] = await Promise.all([
    prisma.salesPageEvent.groupBy({
      by: ["page", "type", "cta", "visitorHash"],
      where: { type: { not: "SIGNUP" }, createdAt, locale, page },
      _count: { _all: true },
    }),
    prisma.salesPageEvent.findMany({
      where: { type: "SIGNUP", createdAt, locale, page },
      select: {
        page: true,
        user: { select: { business: { select: { _count: { select: { stores: true } } } } } },
      },
    }),
    prisma.signupAttribution.findMany({
      where: {
        createdAt,
        ...(locale ? { salesPageLocale: locale } : {}),
        ...(page ? { salesPage: page } : {}),
        OR: [
          { source: { not: null } },
          { utmSource: { not: null } },
          { utmCampaign: { not: null } },
          { adClick: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TRACKED_SIGNUP_LIMIT,
      select: {
        createdAt: true,
        source: true,
        refCode: true,
        salesPage: true,
        salesPageLocale: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        adClick: true,
        user: {
          select: {
            subscription: {
              select: { plan: true, status: true, trialEndsAt: true, stripeSubscriptionId: true },
            },
            business: { select: { _count: { select: { stores: true } } } },
          },
        },
      },
    }),
    prisma.signupAttribution.count({
      where: { createdAt, ...(page ? { salesPage: page } : {}) },
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

  const rows: TrackedSignupRow[] = attributionRows.map((a) => ({
    createdAt: a.createdAt.toISOString(),
    source: a.source,
    refCode: a.refCode,
    salesPage: a.salesPage,
    salesPageLocale: a.salesPageLocale,
    utmSource: a.utmSource,
    utmMedium: a.utmMedium,
    utmCampaign: a.utmCampaign,
    utmContent: a.utmContent,
    adClick: a.adClick,
    plan: a.user.subscription?.plan ?? "FREE",
    status: signupPlanStatus(a.user.subscription, now),
    hasStore: (a.user.business?._count.stores ?? 0) > 0,
  }));

  const summary = summarizeSalesPages(groups, signups);
  const pages = onlyPages ? summary.pages.filter((p) => onlyPages.includes(p.page)) : summary.pages;

  return {
    range,
    lang,
    since: since?.toISOString() ?? null,
    pages,
    leader: onlyPages ? null : summary.leader,
    tracked: {
      totalSignups,
      rows,
      limit: TRACKED_SIGNUP_LIMIT,
      campaigns: summarizeCampaigns(rows),
    },
  };
}
