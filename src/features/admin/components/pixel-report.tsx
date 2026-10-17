import Link from "next/link";
import { AlertTriangle, Info, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  MAX_REPORT_PAGES,
  type ConsentSourceSummary,
  type PixelCounts,
  type PixelReport,
} from "@/lib/services/tracking-event.service";
import type { PixelReportRange } from "@/lib/validation/tracking-event.schemas";
import type { PixelEventName } from "@/lib/tracking-events";

const RANGES: { value: PixelReportRange; label: string }[] = [
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** What each Meta event means here, in the funnel's order. */
const EVENT_INFO: Record<PixelEventName, { label: string; where: string }> = {
  PageView: { label: "Page views", where: "First page of each visit, every page" },
  ViewContent: { label: "Sales page views", where: "/sales-page-N, on load" },
  SignUpClick: { label: "Sign-up clicks", where: "Sales page buttons (custom event)" },
  CompleteRegistration: { label: "Sign-ups", where: "/register, Google sign-up" },
  Contact: { label: "WhatsApp contacts", where: "Contact page, home, pricing, billing" },
  Lead: { label: "Free plan picked", where: "/pricing, signed in" },
  InitiateCheckout: { label: "Checkouts started", where: "Pricing, setup wizard, billing" },
  StartTrial: { label: "Trials started", where: "/checkout/success" },
  Subscribe: { label: "Paid subscriptions", where: "/checkout/success" },
};

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

const SOURCE_LABEL = { site: "Site", sales_page: "Sales page" } as const;

const reportHref = (range: PixelReportRange) => `/admin/pixel?range=${range}`;

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(0)}%`);

const share = (part: number, whole: number) =>
  whole > 0 ? `${part} · ${((part / whole) * 100).toFixed(0)}%` : String(part);

function formatValue(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(total);
  } catch {
    return `${total} ${currency}`;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function RangeTabs({ active }: { active: PixelReportRange }) {
  return (
    <div className="border-border bg-muted/40 flex items-center overflow-x-auto rounded-lg border p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={reportHref(r.value)}
          className={`inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
            r.value === active
              ? "bg-amber-500/20 text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </Link>
      ))}
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
  return (
    <div className="divide-border divide-y">
      <Stat label="Answers" value={summary.answers} />
      <Stat label="Accept all" value={share(summary.acceptAll, summary.answers)} />
      <Stat label="Reject all" value={share(summary.rejectAll, summary.answers)} />
      <Stat label="Customised" value={share(summary.custom, summary.answers)} />
      <Stat label="Allowed the pixel" value={share(summary.marketingAllowed, summary.answers)} />
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
  return (
    <>
      {TABLE_EVENTS.map((name) => (
        <th
          key={name}
          scope="col"
          className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold whitespace-nowrap"
        >
          {EVENT_INFO[name].label}
        </th>
      ))}
    </>
  );
}

export function PixelReportView({ report, pixelId }: { report: PixelReport; pixelId: string }) {
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
              <h1 className="text-foreground text-lg font-bold">Meta Pixel</h1>
              <p className="text-muted-foreground text-xs">
                What the site sends to Meta · pixel {pixelId}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <RangeTabs active={report.range} />
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">← Back</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {report.lastPixelEventAt === null ? (
          <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertTitle>No pixel event recorded yet</AlertTitle>
            <AlertDescription className="text-amber-400/80">
              Nothing has been sent since this log started. Open the site in a private window,
              accept the cookies and reload this page. Preview deployments (dev.epidom.fr) never
              send anything, on purpose.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertTitle>
              {totalEvents} events in this range · last one {formatDateTime(report.lastPixelEventAt)}
            </AlertTitle>
            <AlertDescription className="text-blue-400/80">
              A copy kept by the site of every event it sends, so the team can check tracking
              without access to Meta. Meta&apos;s Events Manager stays the reference for what Meta
              received: an ad blocker can stop one request and not the other.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {report.totals.map((t) => (
            <Card key={t.name}>
              <CardContent className="space-y-1 p-4">
                <p className="text-muted-foreground text-xs font-semibold">
                  {EVENT_INFO[t.name].label}
                </p>
                <p className="text-foreground text-2xl font-bold tabular-nums">{t.count}</p>
                {t.values.map((v) => (
                  <p key={v.currency} className="text-foreground text-xs font-semibold tabular-nums">
                    {formatValue(v.total, v.currency)}
                  </p>
                ))}
                <p className="text-muted-foreground font-mono text-[11px]">{t.name}</p>
                <p className="text-muted-foreground text-[11px] leading-snug">
                  {EVENT_INFO[t.name].where}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sign-ups Meta can see</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {percent(coverage.rate)}
              </p>
              <div className="divide-border divide-y">
                <Stat label="Sign-ups sent to Meta" value={coverage.completeRegistrations} />
                <Stat label="Accounts created" value={coverage.accountsCreated} />
              </div>
              <p className="text-muted-foreground text-xs">
                Below 100% is expected: only visitors who allowed marketing cookies are sent, and
                accounts created another way (staff logins, invitations) count here too.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cookie bar · site</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsentRows summary={consent.bySource.site} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cookie bar · sales pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ConsentRows summary={consent.bySource.sales_page} />
              <p className="text-muted-foreground text-xs">
                {report.salesPageViews} sales page views in this range (all visitors, counted
                without cookies); answers ÷ views is roughly how many visitors answer the bar.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pages</CardTitle>
            <p className="text-muted-foreground text-xs">
              Where each event was sent from. Ids are collapsed (/store/:id/…, /@:store); at most
              the {MAX_REPORT_PAGES} busiest pages are listed.
            </p>
          </CardHeader>
          <CardContent>
            {report.pages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events in this range.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold"
                      >
                        Page
                      </th>
                      <EventHeaders />
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold"
                      >
                        Total
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
                            {SOURCE_LABEL[row.source]}
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
            <CardTitle className="text-base">By day (UTC)</CardTitle>
          </CardHeader>
          <CardContent>
            {report.days.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events in this range.</p>
            ) : (
              <div className="-mx-4 max-h-[480px] overflow-auto sm:mx-0">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-card sticky top-0">
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold"
                      >
                        Day
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
            <strong>Page views</strong> count the first page of each visit (a full page load).
            Meta&apos;s own script also counts later pages opened inside the app, so Events
            Manager shows more page views than this.
          </p>
          <p>
            <strong>Values</strong> are the plan&apos;s first charge in the currency the page
            quoted (a month, or the whole year for a yearly plan); for a trial, what the first
            charge after the trial will be.
          </p>
          <p>
            Nothing here identifies a visitor: no account, IP or cookie is stored with an event.
          </p>
        </div>
      </div>
    </div>
  );
}
