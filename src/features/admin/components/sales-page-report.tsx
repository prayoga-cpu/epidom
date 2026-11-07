"use client";

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
import { LeadsSection, type SalesLead, type NewsletterSub } from "./leads-section";
import { useI18n } from "@/components/lang/i18n-provider";

type Translate = (key: string) => string;

const RANGES: SalesPageReportRange[] = ["7", "30", "90", "all"];


const LANGS: SalesPageReportLang[] = ["all", "fr", "en", "id"];


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

const pageLabel = (page: string, t: Translate) =>
  t("adminPages.salesPages.pageLabel").replace("{n}", page.replace("sales-page-", ""));

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
  const { t } = useI18n();
  const C = (key: string) => t(`adminPages.salesPages.card.${key}`);
  const href = pageHref(row.page, lang);
  return (
    <Card className={leading ? "border-amber-500/50" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{pageLabel(row.page, t)}</CardTitle>
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
            <p className="text-muted-foreground text-xs">{C("signupRate")}</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(row.signupRate)}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">{C("clickRate")}</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(row.clickRate)}
            </p>
          </div>
        </div>

        <div className="divide-border divide-y">
          <Stat label={C("visitors")} value={row.visitors} />
          <Stat label={C("views")} value={row.views} />
          <Stat label={C("half")} value={share(row.scrolled50, row.visitors)} />
          <Stat label={C("end")} value={share(row.scrolled90, row.visitors)} />
          <Stat label={C("clicked")} value={share(row.ctaVisitors, row.visitors)} />
          <Stat label={C("signups")} value={row.signups} />
          <Stat label={C("withStore")} value={share(row.signupsWithStore, row.signups)} />
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            {C("clicksPerButton")}
          </p>
          {row.ctas.length === 0 ? (
            <p className="text-muted-foreground text-sm">{C("noClicks")}</p>
          ) : (
            <div className="divide-border divide-y">
              {row.ctas.map((c) => (
                <Stat
                  key={c.cta}
                  label={c.cta}
                  value={C(c.visitors === 1 ? "clickValueOne" : "clickValueMany")
                    .replace("{clicks}", String(c.clicks))
                    .replace("{visitors}", String(c.visitors))}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Colour per plan status; the label is adminPages.salesPages.statuses.<status>. */
const STATUS_CLASS: Record<SignupPlanStatus, string> = {
  FREE: "text-muted-foreground",
  CHECKOUT: "text-amber-400",
  TRIAL: "text-blue-400",
  ACTIVE: "text-emerald-400",
  PAST_DUE: "text-red-400",
  CANCELED: "text-muted-foreground",
  GRANTED: "text-muted-foreground",
};

const AD_KEYS = new Set(["meta", "google", "tiktok"]);

const signupDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

function cameFrom(row: TrackedSignupRow, t: Translate): string {
  if (row.source === "REFERRAL_LINK")
    return t("adminPages.salesPages.cameFrom.referralLink").replace("{code}", row.refCode ?? "?");
  if (row.source === "REFERRAL_CODE")
    return t("adminPages.salesPages.cameFrom.typedCode").replace("{code}", row.refCode ?? "?");
  if (row.source === "SALES_PAGE" && row.salesPage) {
    return `${pageLabel(row.salesPage, t)} · ${(row.salesPageLocale ?? "fr").toUpperCase()}`;
  }
  return t("adminPages.salesPages.cameFrom.none");
}

const tags = (...values: (string | null)[]) => values.filter(Boolean).join(" / ") || "—";

function TrackedSignupsSection({ tracked }: { tracked: TrackedSignups }) {
  const { t, intlLocale } = useI18n();
  const R = (key: string) => t(`adminPages.salesPages.tracked.${key}`);
  const paying = tracked.rows.filter((r) => r.status === "ACTIVE").length;
  const trials = tracked.rows.filter((r) => r.status === "TRIAL").length;
  const fromAds = tracked.rows.filter((r) => r.adClick || r.utmSource).length;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{R("title")}</CardTitle>
        <p className="text-muted-foreground text-xs">
          {R("desc")
            .replace("{tracked}", String(tracked.rows.length))
            .replace("{total}", String(tracked.totalSignups))
            .replace("{ads}", String(fromAds))
            .replace("{trials}", String(trials))
            .replace("{paying}", String(paying))}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {tracked.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{R("none")}</p>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                {R("byCampaign")}
              </p>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">utm_source</th>
                      <th className="px-2 py-2 font-medium">utm_campaign</th>
                      <th className="px-2 py-2 text-right font-medium">{R("head.signups")}</th>
                      <th className="px-2 py-2 text-right font-medium">{R("head.trials")}</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-2">{R("head.paying")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {tracked.campaigns.map((c) => (
                      <tr key={`${c.utmSource}|${c.utmCampaign}`}>
                        <td className="px-4 py-2 sm:px-2">{c.utmSource ?? R("noTags")}</td>
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
                {R("eachSignup")}
              </p>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">{R("head.date")}</th>
                      <th className="px-2 py-2 font-medium">{R("head.cameFrom")}</th>
                      <th className="px-2 py-2 font-medium">{R("head.ad")}</th>
                      <th className="px-2 py-2 font-medium">{R("head.sourceMedium")}</th>
                      <th className="px-2 py-2 font-medium">{R("head.campaignContent")}</th>
                      <th className="px-2 py-2 font-medium">{R("head.plan")}</th>
                      <th className="px-4 py-2 font-medium sm:px-2">{R("head.store")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {tracked.rows.map((row, i) => {
                      return (
                        <tr key={`${row.createdAt}-${i}`}>
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums sm:px-2">
                            {signupDate(row.createdAt, intlLocale)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{cameFrom(row, t)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.adClick
                              ? AD_KEYS.has(row.adClick)
                                ? t(`adminPages.salesPages.ads.${row.adClick}`)
                                : row.adClick
                              : "—"}
                          </td>
                          <td className="px-2 py-2">{tags(row.utmSource, row.utmMedium)}</td>
                          <td className="px-2 py-2">{tags(row.utmCampaign, row.utmContent)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {PLAN_LABELS[row.plan as PlanTier] ?? row.plan}{" "}
                            <span className={`text-xs ${STATUS_CLASS[row.status]}`}>
                              · {t(`adminPages.salesPages.statuses.${row.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-2 sm:px-2">
                            {row.hasStore ? t("adminPages.common.yes") : t("adminPages.common.no")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tracked.rows.length >= tracked.limit && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {R("showingLatest").replace("{limit}", String(tracked.limit))}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesPageReportView({
  report,
  salesLeads,
  subscribers,
}: {
  report: SalesPageReport;
  salesLeads?: SalesLead[];
  subscribers?: NewsletterSub[];
}) {
  const { t } = useI18n();
  const rangeOptions = RANGES.map((value) => ({ value, label: t(`adminPages.salesPages.ranges.r${value}`) }));
  const langOptions = LANGS.map((value) => ({
    value,
    label: value === "all" ? t("adminPages.salesPages.allLanguages") : value.toUpperCase(),
  }));
  const tooEarly = report.pages.some((p) => p.visitors < EARLY_VISITORS);
  const leadingLabel = (page: string) => {
    if (report.leader?.page !== page) return null;
    return report.leader.metric === "signupRate"
      ? t("adminPages.salesPages.leading.signups")
      : t("adminPages.salesPages.leading.clicks");
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
              <h1 className="text-foreground text-lg font-bold">{t("adminPages.salesPages.title")}</h1>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.salesPages.subtitle")}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FilterTabs
                options={langOptions}
                active={report.lang}
                href={(lang) => reportHref(report.range, lang, report.custom)}
              />
              <FilterTabs
                options={rangeOptions}
                active={report.range}
                href={(range) => reportHref(range, report.lang)}
                trailing={
                  <CustomRangePicker
                    value={report.custom}
                    label={t("adminPages.salesPages.custom")}
                    path="/admin/sales-pages"
                    keep={{ lang: report.lang }}
                  />
                }
              />
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">{t("adminPages.salesPages.back")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {tooEarly && (
          <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertTitle>{t("adminPages.salesPages.early.title")}</AlertTitle>
            <AlertDescription className="text-blue-400/80">
              {t("adminPages.salesPages.early.body").replace("{n}", String(EARLY_VISITORS))}
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

        {(salesLeads || subscribers) && (
          <LeadsSection salesLeads={salesLeads ?? []} subscribers={subscribers ?? []} />
        )}

        <div className="text-muted-foreground space-y-1.5 text-xs">
          <p>
            <strong>{t("adminPages.salesPages.notes.visitorsLabel")}</strong> {t("adminPages.salesPages.notes.visitors")}
          </p>
          <p>
            <strong>{t("adminPages.salesPages.notes.signupsLabel")}</strong> {t("adminPages.salesPages.notes.signups")}
          </p>
          <p>
            <strong>{t("adminPages.salesPages.notes.trackedLabel")}</strong> {t("adminPages.salesPages.notes.tracked")}
          </p>
          <p>
            {t("adminPages.salesPages.notes.rates")}
          </p>
          <p>
            <strong>{t("adminPages.salesPages.notes.languagesLabel")}</strong> {t("adminPages.salesPages.notes.languages")}
          </p>
        </div>
      </div>
    </div>
  );
}
