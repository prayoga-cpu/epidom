"use client";

import Link from "next/link";
import { AlertTriangle, Info, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/components/lang/i18n-provider";
// Types only: the service itself is server code (Prisma).
import type {
  ConsentSourceSummary,
  PixelCounts,
  PixelReport,
} from "@/lib/services/tracking-event.service";
import type { PixelReportRange } from "@/lib/validation/tracking-event.schemas";
import type { CustomDays } from "@/lib/report-range";
import { CustomRangePicker } from "@/components/reports/custom-range-picker";
import type { PixelEventName } from "@/lib/tracking-events";

const RANGES: PixelReportRange[] = ["1", "7", "30", "90"];


/** What each Meta event means here, in the funnel's order. */

/** Columns of the per-page and per-day tables. */
const TABLE_EVENTS: PixelEventName[] = [
  "PageView",
  "ViewContent",
  "SignUpClick",
  "CompleteRegistration",
  "Contact",
  "InitiateCheckout",
  "StartTrial",
  "Subscribe",
];

const reportHref = (range: PixelReportRange) => `/admin/pixel?range=${range}`;

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(0)}%`);

const share = (part: number, whole: number) =>
  whole > 0 ? `${part} · ${((part / whole) * 100).toFixed(0)}%` : String(part);

function formatValue(total: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(total);
  } catch {
    return `${total} ${currency}`;
  }
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function RangeTabs({
  active,
  custom,
}: {
  active: PixelReportRange | "custom";
  custom: CustomDays | null;
}) {
  const { t } = useI18n();
  return (
    <div className="border-border bg-muted/40 flex items-center overflow-x-auto rounded-lg border p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={reportHref(r)}
          className={`inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
            r === active
              ? "bg-amber-500/20 text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`adminPages.pixel.ranges.r${r}`)}
        </Link>
      ))}
      <CustomRangePicker value={custom} label={t("adminPages.pixel.custom")} path="/admin/pixel" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ConsentRows({ summary }: { summary: ConsentSourceSummary }) {
  const { t } = useI18n();
  const C = (key: string) => t(`adminPages.pixel.consent.${key}`);
  return (
    <div className="divide-border divide-y">
      <Stat label={C("newVisitors")} value={summary.answers} />
      <Stat label={C("onByDefault")} value={share(summary.auto, summary.answers)} />
      <Stat label={C("acceptAll")} value={share(summary.acceptAll, summary.answers)} />
      <Stat label={C("rejectAll")} value={share(summary.rejectAll, summary.answers)} />
      <Stat label={C("customised")} value={share(summary.custom, summary.answers)} />
      <Stat label={C("pixelAllowed")} value={share(summary.marketingAllowed, summary.answers)} />
    </div>
  );
}

function CountCell({ counts, name }: { counts: PixelCounts; name: PixelEventName }) {
  const value = counts[name] ?? 0;
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums ${value ? "text-foreground" : "text-muted-foreground/50"}`}
    >
      {value || "·"}
    </td>
  );
}

function EventHeaders() {
  const { t } = useI18n();
  return (
    <>
      {TABLE_EVENTS.map((name) => (
        <th
          key={name}
          scope="col"
          className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold whitespace-nowrap"
        >
          {t(`adminPages.pixel.events.${name}.label`)}
        </th>
      ))}
    </>
  );
}

export function PixelReportView({
  report,
  pixelId,
  maxPages,
}: {
  report: PixelReport;
  pixelId: string;
  /** MAX_REPORT_PAGES, passed in: the service that defines it is server-only. */
  maxPages: number;
}) {
  const { t, intlLocale } = useI18n();
  const totalEvents = report.totals.reduce((sum, t) => sum + t.count, 0);
  const { consent, coverage } = report;

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
              <Radar className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">{t("adminPages.pixel.title")}</h1>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.pixel.subtitle").replace("{id}", pixelId)}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <RangeTabs active={report.range} custom={report.custom} />
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">{t("adminPages.pixel.back")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {report.lastPixelEventAt === null ? (
          <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertTitle>{t("adminPages.pixel.alerts.noneTitle")}</AlertTitle>
            <AlertDescription className="text-amber-400/80">
              {t("adminPages.pixel.alerts.noneBody")}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertTitle>
              {t("adminPages.pixel.alerts.someTitle")
                .replace("{count}", String(totalEvents))
                .replace("{when}", formatDateTime(report.lastPixelEventAt, intlLocale))}
            </AlertTitle>
            <AlertDescription className="text-blue-400/80">
              {t("adminPages.pixel.alerts.someBody")}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {report.totals.map((row) => (
            <Card key={row.name}>
              <CardContent className="space-y-1 p-4">
                <p className="text-muted-foreground text-xs font-semibold">
                  {t(`adminPages.pixel.events.${row.name}.label`)}
                </p>
                <p className="text-foreground text-2xl font-bold tabular-nums">{row.count}</p>
                {row.values.map((v) => (
                  <p key={v.currency} className="text-foreground text-xs font-semibold tabular-nums">
                    {formatValue(v.total, v.currency, intlLocale)}
                  </p>
                ))}
                <p className="text-muted-foreground font-mono text-[11px]">{row.name}</p>
                <p className="text-muted-foreground text-[11px] leading-snug">
                  {t(`adminPages.pixel.events.${row.name}.where`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("adminPages.pixel.coverage.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {percent(coverage.rate)}
              </p>
              <div className="divide-border divide-y">
                <Stat label={t("adminPages.pixel.coverage.sent")} value={coverage.completeRegistrations} />
                <Stat label={t("adminPages.pixel.coverage.created")} value={coverage.accountsCreated} />
              </div>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.pixel.coverage.note")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("adminPages.pixel.cookiesSite")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsentRows summary={consent.bySource.site} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("adminPages.pixel.cookiesSales")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ConsentRows summary={consent.bySource.sales_page} />
              <p className="text-muted-foreground text-xs">
                {t("adminPages.pixel.salesNote").replace("{views}", String(report.salesPageViews))}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("adminPages.pixel.pages.title")}</CardTitle>
            <p className="text-muted-foreground text-xs">
              {t("adminPages.pixel.pages.note").replace("{max}", String(maxPages))}
            </p>
          </CardHeader>
          <CardContent>
            {report.pages.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("adminPages.pixel.pages.none")}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold"
                      >
                        {t("adminPages.pixel.pages.page")}
                      </th>
                      <EventHeaders />
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold"
                      >
                        {t("adminPages.pixel.pages.total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {report.pages.map((row) => (
                      <tr key={`${row.source} ${row.path}`}>
                        <td className="px-3 py-2">
                          <span className="text-foreground font-mono text-xs break-all">
                            {row.path}
                          </span>
                          <span className="text-muted-foreground ml-2 text-[11px]">
                            {t(`adminPages.pixel.sources.${row.source}`)}
                          </span>
                        </td>
                        {TABLE_EVENTS.map((name) => (
                          <CountCell key={name} counts={row.counts} name={name} />
                        ))}
                        <td className="text-foreground px-3 py-2 text-right font-semibold tabular-nums">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("adminPages.pixel.byDay")}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.days.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("adminPages.pixel.pages.none")}</p>
            ) : (
              <div className="-mx-4 max-h-[480px] overflow-auto sm:mx-0">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-card sticky top-0">
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold"
                      >
                        {t("adminPages.pixel.day")}
                      </th>
                      <EventHeaders />
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {report.days.map((row) => (
                      <tr key={row.day}>
                        <td className="text-foreground px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {row.day}
                        </td>
                        {TABLE_EVENTS.map((name) => (
                          <CountCell key={name} counts={row.counts} name={name} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-muted-foreground space-y-1.5 text-xs">
          <p>
            <strong>{t("adminPages.pixel.notes.pageViewsLabel")}</strong> {t("adminPages.pixel.notes.pageViews")}
          </p>
          <p>
            <strong>{t("adminPages.pixel.notes.valuesLabel")}</strong> {t("adminPages.pixel.notes.values")}
          </p>
          <p>
            <strong>{t("adminPages.pixel.notes.cookiesLabel")}</strong> {t("adminPages.pixel.notes.cookies")}
          </p>
          <p>
            {t("adminPages.pixel.notes.privacy")}
          </p>
        </div>
      </div>
    </div>
  );
}
