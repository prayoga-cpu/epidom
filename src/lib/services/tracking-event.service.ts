import { prisma } from "@/lib/prisma";
import {
  PIXEL_EVENTS,
  TRACKING_SOURCES,
  type PixelEventName,
  type TrackingSource,
} from "@/lib/tracking-events";
import type {
  PixelReportRange,
  RecordTrackingEventInput,
} from "@/lib/validation/tracking-event.schemas";

/** Store one event from the site or a sales page (see src/lib/tracking-events.ts). */
export async function recordTrackingEvent(input: RecordTrackingEventInput): Promise<void> {
  if (input.kind === "PIXEL") {
    await prisma.trackingEvent.create({
      data: {
        kind: "PIXEL",
        name: input.name,
        path: input.path,
        source: input.source,
        locale: input.locale,
        content: input.content || undefined,
        // A value without its currency can't be added up with anything.
        value: input.currency ? input.value : undefined,
        currency: input.value !== undefined ? input.currency : undefined,
      },
    });
    return;
  }
  await prisma.trackingEvent.create({
    data: {
      kind: "CONSENT",
      name: input.name,
      path: input.path,
      source: input.source,
      locale: input.locale,
      marketing: input.marketing,
      analytics: input.analytics,
    },
  });
}

export type PixelCounts = Partial<Record<PixelEventName, number>>;

export interface PixelEventTotal {
  name: PixelEventName;
  count: number;
  /** Summed value per currency, for the events that carry one. */
  values: { currency: string; total: number }[];
}

export interface PixelPageRow {
  path: string;
  source: TrackingSource;
  total: number;
  counts: PixelCounts;
}

export interface PixelDayRow {
  /** YYYY-MM-DD, UTC. */
  day: string;
  counts: PixelCounts;
}

export interface ConsentSourceSummary {
  answers: number;
  acceptAll: number;
  rejectAll: number;
  custom: number;
  /** No bar: on by default because the visitor's country needs no consent. */
  auto: number;
  /** Answers that allowed marketing cookies (Accept all, Customize with marketing on, or automatic). */
  marketingAllowed: number;
  /** marketingAllowed / answers, null with no answers. */
  marketingRate: number | null;
}

export interface PixelReport {
  range: PixelReportRange;
  since: string;
  totals: PixelEventTotal[];
  consent: ConsentSourceSummary & { bySource: Record<TrackingSource, ConsentSourceSummary> };
  /** CompleteRegistration sent vs accounts created over the same range. */
  coverage: { accountsCreated: number; completeRegistrations: number; rate: number | null };
  /** Sales page views from the sales pages' own tracker, which needs no consent. */
  salesPageViews: number;
  pages: PixelPageRow[];
  days: PixelDayRow[];
  lastPixelEventAt: string | null;
}

/** One row of the PIXEL groupBy (name, path, source). */
export interface PixelGroup {
  name: string;
  path: string;
  source: string;
  count: number;
}

/** One row of the PIXEL value groupBy (name, currency). */
export interface PixelValueGroup {
  name: string;
  currency: string | null;
  total: number;
}

/** One row of the CONSENT groupBy (name, source, marketing). */
export interface ConsentGroup {
  name: string;
  source: string;
  marketing: boolean | null;
  count: number;
}

export interface PixelDayGroup {
  day: string;
  name: string;
  count: number;
}

const isPixelEvent = (name: string): name is PixelEventName =>
  (PIXEL_EVENTS as readonly string[]).includes(name);

const isSource = (source: string): source is TrackingSource =>
  (TRACKING_SOURCES as readonly string[]).includes(source);

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/** The most pages the report lists; the rest are the quietest. */
export const MAX_REPORT_PAGES = 40;

function summarizeConsent(groups: ConsentGroup[]): ConsentSourceSummary {
  const count = (pick: (g: ConsentGroup) => boolean) =>
    groups.filter(pick).reduce((sum, g) => sum + g.count, 0);
  const answers = count(() => true);
  const marketingAllowed = count((g) => g.marketing === true);
  return {
    answers,
    acceptAll: count((g) => g.name === "ACCEPT_ALL"),
    rejectAll: count((g) => g.name === "REJECT_ALL"),
    custom: count((g) => g.name === "CUSTOM"),
    auto: count((g) => g.name === "AUTO"),
    marketingAllowed,
    marketingRate: ratio(marketingAllowed, answers),
  };
}

/** Pure: turns the grouped rows into the report's figures. */
export function summarizePixelEvents(input: {
  pixel: PixelGroup[];
  values: PixelValueGroup[];
  consent: ConsentGroup[];
  days: PixelDayGroup[];
  accountsCreated: number;
}): Pick<PixelReport, "totals" | "consent" | "coverage" | "pages" | "days"> {
  const pixel = input.pixel.filter((g) => isPixelEvent(g.name));

  const totals: PixelEventTotal[] = PIXEL_EVENTS.map((name) => ({
    name,
    count: pixel.filter((g) => g.name === name).reduce((sum, g) => sum + g.count, 0),
    values: input.values
      .filter((v) => v.name === name && v.currency && v.total > 0)
      .map((v) => ({ currency: v.currency as string, total: Math.round(v.total * 100) / 100 }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  }));

  const pageMap = new Map<string, PixelPageRow>();
  for (const g of pixel) {
    const source = isSource(g.source) ? g.source : "site";
    const key = `${source} ${g.path}`;
    const row = pageMap.get(key) ?? { path: g.path, source, total: 0, counts: {} };
    const name = g.name as PixelEventName;
    row.counts[name] = (row.counts[name] ?? 0) + g.count;
    row.total += g.count;
    pageMap.set(key, row);
  }
  const pages = [...pageMap.values()]
    .sort((a, b) => b.total - a.total || a.path.localeCompare(b.path))
    .slice(0, MAX_REPORT_PAGES);

  const dayMap = new Map<string, PixelCounts>();
  for (const g of input.days) {
    if (!isPixelEvent(g.name)) continue;
    const counts = dayMap.get(g.day) ?? {};
    counts[g.name] = (counts[g.name] ?? 0) + g.count;
    dayMap.set(g.day, counts);
  }
  const days = [...dayMap.entries()]
    .map(([day, counts]) => ({ day, counts }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const bySource = Object.fromEntries(
    TRACKING_SOURCES.map((source) => [
      source,
      summarizeConsent(input.consent.filter((g) => g.source === source)),
    ])
  ) as Record<TrackingSource, ConsentSourceSummary>;

  const completeRegistrations = totals.find((t) => t.name === "CompleteRegistration")?.count ?? 0;

  return {
    totals,
    consent: { ...summarizeConsent(input.consent), bySource },
    coverage: {
      accountsCreated: input.accountsCreated,
      completeRegistrations,
      rate: ratio(completeRegistrations, input.accountsCreated),
    },
    pages,
    days,
  };
}

const RANGE_HOURS: Record<PixelReportRange, number> = {
  "1": 24,
  "7": 7 * 24,
  "30": 30 * 24,
  "90": 90 * 24,
};

/** The report on /admin/pixel. Grouped in the database, so the payload grows with pages and days, not events. */
export async function getPixelReport(
  range: PixelReportRange,
  now: Date = new Date()
): Promise<PixelReport> {
  const since = new Date(now.getTime() - RANGE_HOURS[range] * 60 * 60 * 1000);
  const createdAt = { gte: since };

  const [pixel, values, consent, days, accountsCreated, salesPageViews, last] = await Promise.all([
    prisma.trackingEvent.groupBy({
      by: ["name", "path", "source"],
      where: { kind: "PIXEL", createdAt },
      _count: { _all: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["name", "currency"],
      where: { kind: "PIXEL", createdAt, value: { not: null } },
      _sum: { value: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["name", "source", "marketing"],
      where: { kind: "CONSENT", createdAt },
      _count: { _all: true },
    }),
    // Only the table is snake_case: the columns are camelCase and need quotes.
    prisma.$queryRaw<{ day: string; name: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, "name", COUNT(*) AS count
      FROM "tracking_events"
      WHERE "kind" = 'PIXEL' AND "createdAt" >= ${since}
      GROUP BY 1, 2`,
    prisma.user.count({ where: { createdAt } }),
    prisma.salesPageEvent.count({ where: { type: "VIEW", createdAt } }),
    prisma.trackingEvent.findFirst({
      where: { kind: "PIXEL" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    range,
    since: since.toISOString(),
    salesPageViews,
    lastPixelEventAt: last?.createdAt.toISOString() ?? null,
    ...summarizePixelEvents({
      pixel: pixel.map((g) => ({
        name: g.name,
        path: g.path,
        source: g.source,
        count: g._count._all,
      })),
      values: values.map((g) => ({
        name: g.name,
        currency: g.currency,
        total: g._sum.value ? Number(g._sum.value) : 0,
      })),
      consent: consent.map((g) => ({
        name: g.name,
        source: g.source,
        marketing: g.marketing,
        count: g._count._all,
      })),
      days: days.map((g) => ({ day: g.day, name: g.name, count: Number(g.count) })),
      accountsCreated,
    }),
  };
}
