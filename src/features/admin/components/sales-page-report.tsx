import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, Info, Megaphone, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  SalesPageReport,
  SalesPageRow,
  SignupPlanStatus,
  TrackedSignupRow,
  TrackedSignups,
} from "@/lib/services/sales-page.service";
import { PLAN_LABELS, type PlanTier } from "@/lib/plans/entitlements";
import type {
  SalesPageReportLang,
  SalesPageReportRange,
} from "@/lib/validation/sales-page.schemas";
import { customRangeQuery, type CustomDays } from "@/lib/report-range";
import { CustomRangePicker } from "@/components/reports/custom-range-picker";

const RANGES: { value: SalesPageReportRange; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

const LANGS: { value: SalesPageReportLang; label: string }[] = [
  { value: "all", label: "All languages" },
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
  { value: "id", label: "ID" },
];

const reportHref = (
  range: SalesPageReportRange | "custom",
  lang: SalesPageReportLang,
  custom: CustomDays | null = null
) =>
  range === "custom" && custom
    ? `/admin/sales-pages?${customRangeQuery(custom)}&lang=${lang}`
    : `/admin/sales-pages?range=${range}&lang=${lang}`;

/**
 * The page in the report's language, so "open" shows what the figures are
 * about. French asks for French (?lang=fr): plain /sales-page-N would send an
 * admin whose browser or saved language isn't French to /en or /id (the
 * proxy's language redirect). The page drops the parameter from the address
 * bar once open.
 */
const pageHref = (page: string, lang: SalesPageReportLang) =>
  lang === "en" || lang === "id" ? `/${lang}/${page}` : `/${page}?lang=fr`;

/** What the link says: the public URL, not the file. */
const pageUrlLabel = (page: string, lang: SalesPageReportLang) =>
  lang === "en" || lang === "id" ? `/${lang}/${page}` : `/${page}`;

function FilterTabs<T extends string>({
  options,
  active,
  href,
  trailing,
}: {
  options: { value: T; label: string }[];
  active: T | "custom";
  href: (value: T) => string;
  /** Shown after the tabs, inside the group (the custom range picker). */
  trailing?: ReactNode;
}) {
  return (
    <div className="border-border bg-muted/40 flex items-center overflow-x-auto rounded-lg border p-0.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          className={`inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
            o.value === active
              ? "bg-amber-500/20 text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </Link>
      ))}
      {trailing}
    </div>
  );
}

/** Below this many visitors on a page, one signup swings the rate too much to call. */
const EARLY_VISITORS = 100;

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);

const share = (part: number, whole: number) =>
  whole > 0 ? `${part} · ${((part / whole) * 100).toFixed(0)}%` : String(part);

const pageLabel = (page: string) => page.replace("sales-page-", "Sales page ");

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PageCard({
  row,
  leading,
  lang,
}: {
  row: SalesPageRow;
  leading: string | null;
  lang: SalesPageReportLang;
}) {
  const href = pageHref(row.page, lang);
  return (
    <Card className={leading ? "border-amber-500/50" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{pageLabel(row.page)}</CardTitle>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1 px-1 text-xs"
          >
            {pageUrlLabel(row.page, lang)}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {leading && (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Trophy className="h-3.5 w-3.5" />
            {leading}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Signup rate</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(row.signupRate)}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Button click rate</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(row.clickRate)}
            </p>
          </div>
        </div>

        <div className="divide-border divide-y">
          <Stat label="Visitors" value={row.visitors} />
          <Stat label="Page views" value={row.views} />
          <Stat label="Read half the page" value={share(row.scrolled50, row.visitors)} />
          <Stat label="Read to the end" value={share(row.scrolled90, row.visitors)} />
          <Stat label="Clicked a button" value={share(row.ctaVisitors, row.visitors)} />
          <Stat label="Signups" value={row.signups} />
          <Stat label="Signups who created a store" value={share(row.signupsWithStore, row.signups)} />
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            Clicks per button
          </p>
          {row.ctas.length === 0 ? (
            <p className="text-muted-foreground text-sm">No clicks yet.</p>
          ) : (
            <div className="divide-border divide-y">
              {row.ctas.map((c) => (
                <Stat
                  key={c.cta}
                  label={c.cta}
                  value={`${c.clicks} (${c.visitors} visitor${c.visitors === 1 ? "" : "s"})`}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_LABELS: Record<SignupPlanStatus, { label: string; className: string }> = {
  FREE: { label: "Free", className: "text-muted-foreground" },
  CHECKOUT: { label: "Checkout not finished", className: "text-amber-400" },
  TRIAL: { label: "Trial", className: "text-blue-400" },
  ACTIVE: { label: "Paying", className: "text-emerald-400" },
  PAST_DUE: { label: "Payment failed", className: "text-red-400" },
  CANCELED: { label: "Canceled", className: "text-muted-foreground" },
  GRANTED: { label: "Granted by admin", className: "text-muted-foreground" },
};

const AD_LABELS: Record<string, string> = { meta: "Meta ad", google: "Google ad", tiktok: "TikTok ad" };

const signupDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

function cameFrom(row: TrackedSignupRow): string {
  if (row.source === "REFERRAL_LINK") return `Referral link · ${row.refCode ?? "?"}`;
  if (row.source === "SALES_PAGE" && row.salesPage) {
    return `${pageLabel(row.salesPage)} · ${(row.salesPageLocale ?? "fr").toUpperCase()}`;
  }
  return "No page or link";
}

const tags = (...values: (string | null)[]) => values.filter(Boolean).join(" / ") || "—";

function TrackedSignupsSection({ tracked }: { tracked: TrackedSignups }) {
  const paying = tracked.rows.filter((r) => r.status === "ACTIVE").length;
  const trials = tracked.rows.filter((r) => r.status === "TRIAL").length;
  const fromAds = tracked.rows.filter((r) => r.adClick || r.utmSource).length;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tracked sign-ups</CardTitle>
        <p className="text-muted-foreground text-xs">
          Where each new account came from (sales page or referral link, plus the ad&apos;s
          campaign tags) and the plan it is on now. {tracked.rows.length} tracked of{" "}
          {tracked.totalSignups} sign-up{tracked.totalSignups === 1 ? "" : "s"} in this range ·{" "}
          {fromAds} with ad tags · {trials} on trial · {paying} paying.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {tracked.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tracked sign-ups in this range yet.</p>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                By campaign
              </p>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">utm_source</th>
                      <th className="px-2 py-2 font-medium">utm_campaign</th>
                      <th className="px-2 py-2 text-right font-medium">Sign-ups</th>
                      <th className="px-2 py-2 text-right font-medium">Trials</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-2">Paying</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {tracked.campaigns.map((c) => (
                      <tr key={`${c.utmSource}|${c.utmCampaign}`}>
                        <td className="px-4 py-2 sm:px-2">{c.utmSource ?? "No tags"}</td>
                        <td className="px-2 py-2">{c.utmCampaign ?? "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.signups}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.trials}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums sm:px-2">
                          {c.paying}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                Each sign-up
              </p>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">Date (UTC)</th>
                      <th className="px-2 py-2 font-medium">Came from</th>
                      <th className="px-2 py-2 font-medium">Ad</th>
                      <th className="px-2 py-2 font-medium">Source / medium</th>
                      <th className="px-2 py-2 font-medium">Campaign / content</th>
                      <th className="px-2 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium sm:px-2">Store</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {tracked.rows.map((row, i) => {
                      const status = STATUS_LABELS[row.status];
                      return (
                        <tr key={`${row.createdAt}-${i}`}>
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums sm:px-2">
                            {signupDate(row.createdAt)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{cameFrom(row)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.adClick ? (AD_LABELS[row.adClick] ?? row.adClick) : "—"}
                          </td>
                          <td className="px-2 py-2">{tags(row.utmSource, row.utmMedium)}</td>
                          <td className="px-2 py-2">{tags(row.utmCampaign, row.utmContent)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {PLAN_LABELS[row.plan as PlanTier] ?? row.plan}{" "}
                            <span className={`text-xs ${status.className}`}>· {status.label}</span>
                          </td>
                          <td className="px-4 py-2 sm:px-2">{row.hasStore ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tracked.rows.length >= tracked.limit && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Showing the latest {tracked.limit}. Pick a shorter range to see the rest.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesPageReportView({ report }: { report: SalesPageReport }) {
  const tooEarly = report.pages.some((p) => p.visitors < EARLY_VISITORS);
  const leadingLabel = (page: string) => {
    if (report.leader?.page !== page) return null;
    return report.leader.metric === "signupRate"
      ? "Leading on signups"
      : "Leading on button clicks (no signups yet)";
  };

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
              <Megaphone className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">Sales Pages</h1>
              <p className="text-muted-foreground text-xs">
                Which landing page turns visitors into signups
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FilterTabs
                options={LANGS}
                active={report.lang}
                href={(lang) => reportHref(report.range, lang, report.custom)}
              />
              <FilterTabs
                options={RANGES}
                active={report.range}
                href={(range) => reportHref(range, report.lang)}
                trailing={
                  <CustomRangePicker
                    value={report.custom}
                    label="Custom"
                    path="/admin/sales-pages"
                    keep={{ lang: report.lang }}
                  />
                }
              />
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">← Back</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {tooEarly && (
          <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertTitle>Too early to call a winner</AlertTitle>
            <AlertDescription className="text-blue-400/80">
              At least one page has fewer than {EARLY_VISITORS} visitors in this range. Send each
              page the same kind of traffic and wait for a few hundred visitors and a few dozen
              signups per page before deciding.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {report.pages.map((row) => (
            <PageCard
              key={row.page}
              row={row}
              leading={leadingLabel(row.page)}
              lang={report.lang}
            />
          ))}
        </div>

        <TrackedSignupsSection tracked={report.tracked} />

        <div className="text-muted-foreground space-y-1.5 text-xs">
          <p>
            <strong>Visitors</strong> are counted once per day per device, without cookies (an
            anonymous hash of IP and browser that changes daily), so one person on two days counts
            twice. Bots and link previews are not counted.
          </p>
          <p>
            <strong>Signups</strong> are accounts created (email or Google) by a browser whose last
            opened sales page, within 30 days, was this one. Signup rate = signups ÷ visitors.
          </p>
          <p>
            <strong>Tracked sign-ups</strong> start on 19 October 2026. &ldquo;Came from&rdquo; is
            the last sales page or referral link the browser opened in the 30 days before signing
            up; the account stays credited to it. Ad and campaign tags are those of the last visit
            that had utm_* tags or an ad click id. A language filter keeps only sales-page sign-ups
            in that language.
          </p>
          <p>
            Rates use the same date range for both sides, so a signup near the start of a range can
            belong to a visit just before it.
          </p>
          <p>
            <strong>Languages:</strong> each page exists in French (/sales-page-N), English
            (/en/…) and Indonesian (/id/…). A language filter counts the visits, clicks and signups
            made on that language&apos;s page; a visitor who switches language counts on both.
            Compare pages within one language when the traffic differs by language.
          </p>
        </div>
      </div>
    </div>
  );
}
