"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Handshake, Loader2, LogOut, Share2 } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAN_LABELS, type PlanTier } from "@/lib/plans/entitlements";
import type { getMyPartnerDashboard } from "@/lib/services/partner.service";
import type { SalesPageRow } from "@/lib/services/sales-page.service";
import {
  CurrencyTotalsList,
  money,
  shortDate,
} from "@/features/admin/partners/components/partner-bits";
import {
  REFERRAL_CHANNELS,
  referralLink,
  salesPageLinks,
  whatsappShareLink,
  type ReferralLanding,
} from "../lib/links";

type Dashboard = Awaited<ReturnType<typeof getMyPartnerDashboard>>;

const LOCALE_TAGS: Record<string, string> = { fr: "fr-FR", en: "en-GB", id: "id-ID" };
const RANGES = ["7", "30", "90", "all"] as const;
const AD_LABELS: Record<string, string> = { meta: "Meta", google: "Google", tiktok: "TikTok" };

function useOrigin(): string {
  const [origin, setOrigin] = useState("https://epidom.fr");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const share = (part: number, whole: number) =>
  whole > 0 ? `${part} · ${((part / whole) * 100).toFixed(0)}%` : String(part);

function LinkRow({ url, shareText }: { url: string; shareText: string }) {
  const { t } = useI18n();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-muted/50 min-w-0 flex-1 basis-56 truncate rounded px-2 py-2 text-xs">
        {url}
      </code>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => toast.success(t("partnerPortal.copied")))
              .catch(() => toast.error(t("partnerPortal.error")))
          }
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {t("partnerPortal.copy")}
        </Button>
        <Button variant="outline" size="sm" className="min-h-10" asChild>
          <a href={whatsappShareLink(shareText, url)} target="_blank" rel="noopener noreferrer">
            {t("partnerPortal.whatsapp")}
          </a>
        </Button>
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-10"
            aria-label={t("partnerPortal.share")}
            onClick={() => navigator.share({ text: shareText, url }).catch(() => {})}
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
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

/** One owned sales page: the admin report's figures, translated, plus what is credited. */
function SalesPageCard({
  page,
  creditFrom,
  creditedSignups,
  report,
  origin,
  shareText,
  tag,
}: {
  page: string;
  creditFrom: string;
  creditedSignups: number;
  report: SalesPageRow | null;
  origin: string;
  shareText: string;
  tag: string;
}) {
  const { t } = useI18n();
  const r = report;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("partnerPortal.fromPage").replace("{n}", page.replace("sales-page-", ""))}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          {t("partnerPortal.credited")
            .replace("{n}", String(creditedSignups))
            .replace("{date}", shortDate(creditFrom, tag))}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">{t("partnerPortal.signupRate")}</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(r?.signupRate ?? null)}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">{t("partnerPortal.clickRate")}</p>
            <p className="text-foreground text-2xl font-bold tabular-nums">
              {percent(r?.clickRate ?? null)}
            </p>
          </div>
        </div>
        <div className="divide-border divide-y">
          <Stat label={t("partnerPortal.visitors")} value={r?.visitors ?? 0} />
          <Stat label={t("partnerPortal.views")} value={r?.views ?? 0} />
          <Stat
            label={t("partnerPortal.readHalf")}
            value={share(r?.scrolled50 ?? 0, r?.visitors ?? 0)}
          />
          <Stat
            label={t("partnerPortal.readEnd")}
            value={share(r?.scrolled90 ?? 0, r?.visitors ?? 0)}
          />
          <Stat
            label={t("partnerPortal.clickedButton")}
            value={share(r?.ctaVisitors ?? 0, r?.visitors ?? 0)}
          />
          <Stat label={t("partnerPortal.signups")} value={r?.signups ?? 0} />
          <Stat
            label={t("partnerPortal.signupsWithStore")}
            value={share(r?.signupsWithStore ?? 0, r?.signups ?? 0)}
          />
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("partnerPortal.pageLinks")}
          </p>
          {salesPageLinks(origin, page).map((l) => (
            <div key={l.locale} className="space-y-1">
              <p className="text-muted-foreground text-xs uppercase">{l.locale}</p>
              <LinkRow url={l.url} shareText={shareText} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MyReferrals({
  dashboard,
  readOnly = false,
  partnerId,
  choices = [],
  backHref = "/stores",
}: {
  dashboard: Dashboard;
  /** A viewer's look at someone else's page: nothing can be changed, nothing is earned. */
  readOnly?: boolean;
  /** The partner shown, kept in the range links when the account can see several. */
  partnerId?: string;
  choices?: { id: string; displayName: string }[];
  /** "Back to stores" when the account has a business; none for a partner-only account. */
  backHref?: string | null;
}) {
  const { t, locale } = useI18n();
  const pageHref = (range: string) =>
    `/admin/my-referrals?range=${range}${choices.length > 1 && partnerId ? `&partner=${partnerId}` : ""}`;
  const tag = LOCALE_TAGS[locale] ?? "en-GB";
  const origin = useOrigin();
  const p = dashboard.partner;
  const [landing, setLanding] = useState<ReferralLanding>(p.referralLanding);
  const [saving, setSaving] = useState(false);
  const shareText = t("partnerPortal.shareText");
  const months = p.commissionMonths;

  async function changeLanding(value: ReferralLanding) {
    const previous = landing;
    setLanding(value);
    setSaving(true);
    try {
      const res = await fetch("/api/partner/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralLanding: value }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("partnerPortal.saved"));
    } catch {
      setLanding(previous);
      toast.error(t("partnerPortal.error"));
    } finally {
      setSaving(false);
    }
  }

  const statusText = (status: string) => t(`partnerPortal.planStatus.${status}`);
  const ledgerStatus = (r: Dashboard["ledger"][number]) =>
    r.status === "PAID"
      ? t("partnerPortal.statusPaid")
      : r.status === "VOID"
        ? t("partnerPortal.statusVoid")
        : r.ready
          ? t("partnerPortal.ready")
          : t("partnerPortal.statusOnHold").replace("{date}", shortDate(r.payableAt, tag));

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {backHref && (
            <Button variant="ghost" size="sm" asChild className="min-h-10">
              <Link href={backHref}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t("partnerPortal.back")}
              </Link>
            </Button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
            <Handshake className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-foreground text-lg font-bold">
              {readOnly ? p.displayName : t("partnerPortal.title")}
            </h1>
            <p className="text-muted-foreground text-xs">{t("partnerPortal.subtitle")}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto min-h-10"
            onClick={async () => {
              await signOut();
              window.location.href = "/login";
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            {t("partnerPortal.signOut")}
          </Button>
        </div>

        {choices.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">{t("partnerPortal.pageOf")}</span>
            {choices.map((c) => (
              <Link
                key={c.id}
                href={`/admin/my-referrals?partner=${c.id}&range=${dashboard.range}`}
                className={`inline-flex min-h-10 items-center rounded-md border px-3 text-xs font-semibold ${
                  c.id === partnerId
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.displayName}
              </Link>
            ))}
          </div>
        )}

        {readOnly && (
          <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
            {t("partnerPortal.viewOnly").split("{name}").join(p.displayName)}
          </p>
        )}

        {p.status !== "ACTIVE" && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            {p.status === "PAUSED"
              ? t("partnerPortal.statusPaused")
              : t("partnerPortal.statusEnded")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("partnerPortal.dealTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                {t(months === 1 ? "partnerPortal.dealOneMonth" : "partnerPortal.deal")
                  .replace("{rate}", String(Number(p.commissionRate)))
                  .replace("{months}", String(months))}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("partnerPortal.dealYearly").replace("{months}", String(months))}
              </p>
              {p.referralCode && Number(p.customerDiscountPercent) > 0 && (
                <p className="text-muted-foreground text-xs">
                  {t("partnerPortal.dealDiscount").replace(
                    "{discount}",
                    String(Number(p.customerDiscountPercent))
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("partnerPortal.totalsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CurrencyTotalsList
                totals={dashboard.totals}
                locale={tag}
                empty={t("partnerPortal.noCommission")}
                labels={{
                  onHold: t("partnerPortal.onHold"),
                  ready: t("partnerPortal.ready"),
                  paid: t("partnerPortal.paid"),
                }}
              />
              <p className="text-muted-foreground text-[11px]">{t("partnerPortal.holdHelp")}</p>
            </CardContent>
          </Card>
        </div>

        {p.referralCode && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("partnerPortal.linkTitle")}</CardTitle>
              <p className="text-muted-foreground text-xs">{t("partnerPortal.linkHelp")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("partnerPortal.landingLabel")}
                </span>
                <Select value={landing} onValueChange={(v) => changeLanding(v as ReferralLanding)}>
                  <SelectTrigger className="min-h-10 w-48" disabled={saving || readOnly}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGISTER">{t("partnerPortal.landingRegister")}</SelectItem>
                    <SelectItem value="HOME">{t("partnerPortal.landingHome")}</SelectItem>
                  </SelectContent>
                </Select>
                {saving && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
              </div>
              <LinkRow url={referralLink(origin, p.referralCode, landing)} shareText={shareText} />
              <div className="space-y-2">
                <p className="text-foreground text-sm font-medium">
                  {t("partnerPortal.channelsTitle")}
                </p>
                <p className="text-muted-foreground text-xs">{t("partnerPortal.channelsHelp")}</p>
                {REFERRAL_CHANNELS.map((channel) => (
                  <div key={channel} className="space-y-1">
                    <p className="text-muted-foreground text-xs capitalize">{channel}</p>
                    <LinkRow
                      url={referralLink(origin, p.referralCode!, landing, channel)}
                      shareText={shareText}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!p.referralCode && dashboard.salesPages.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("partnerPortal.noLink")}</p>
        )}

        {dashboard.salesPages.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-foreground text-base font-bold">
                  {t("partnerPortal.reportTitle")}
                </h2>
                <p className="text-muted-foreground text-xs">{t("partnerPortal.reportHelp")}</p>
              </div>
              <div className="border-border bg-muted/40 ml-auto flex items-center overflow-x-auto rounded-lg border p-0.5">
                {RANGES.map((range) => (
                  <Link
                    key={range}
                    href={pageHref(range)}
                    className={`inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-bold whitespace-nowrap ${
                      range === dashboard.range
                        ? "bg-amber-500/20 text-amber-300"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`partnerPortal.range.${range}`)}
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {dashboard.salesPages.map((s) => (
                <SalesPageCard
                  key={s.page}
                  page={s.page}
                  creditFrom={s.creditFrom}
                  creditedSignups={s.creditedSignups}
                  report={s.report}
                  origin={origin}
                  shareText={shareText}
                  tag={tag}
                />
              ))}
            </div>
          </section>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("partnerPortal.ledgerTitle")}</CardTitle>
            <p className="text-muted-foreground text-xs">{t("partnerPortal.ledgerHelp")}</p>
          </CardHeader>
          <CardContent>
            {dashboard.ledger.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("partnerPortal.noCommission")}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">
                        {t("partnerPortal.colDate")}
                      </th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colCustomer")}</th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colPayment")}</th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colCounts")}</th>
                      <th className="px-2 py-2 text-right font-medium">
                        {t("partnerPortal.colCommission")}
                      </th>
                      <th className="px-4 py-2 font-medium sm:px-2">
                        {t("partnerPortal.colStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {dashboard.ledger.map((r) => (
                      <tr key={r.id} className={r.status === "VOID" ? "opacity-50" : undefined}>
                        <td className="px-4 py-2 whitespace-nowrap sm:px-2">
                          {shortDate(r.earnedAt, tag)}
                        </td>
                        <td className="px-2 py-2">
                          {r.customerLabel ??
                            (r.customerDeleted
                              ? t("partnerPortal.deletedAccount")
                              : t("partnerPortal.newSignup"))}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                          {money(r.invoiceAmount, r.currency, tag)}
                          {r.plan && (
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              · {PLAN_LABELS[r.plan as PlanTier] ?? r.plan}
                              {r.billingInterval === "YEARLY"
                                ? ` (${t("partnerPortal.yearly")})`
                                : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                          {r.kind === "INVOICE"
                            ? `${money(r.commissionableAmount, r.currency, tag)} × ${Number(r.rate)}%`
                            : t("partnerPortal.refund")}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                          {money(r.amount, r.currency, tag)}
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap sm:px-2">
                          {ledgerStatus(r)}
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
            <CardTitle className="text-base">
              {t("partnerPortal.customersTitle")} ({dashboard.customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.customers.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("partnerPortal.noCustomers")}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">
                        {t("partnerPortal.colSignedUp")}
                      </th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colCustomer")}</th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colFrom")}</th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colAd")}</th>
                      <th className="px-2 py-2 font-medium">{t("partnerPortal.colPlan")}</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-2">
                        {t("partnerPortal.colEarned")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {dashboard.customers.map((c) => (
                      <tr key={c.userId}>
                        <td className="px-4 py-2 whitespace-nowrap sm:px-2">
                          {shortDate(c.signedUpAt, tag)}
                        </td>
                        <td className="px-2 py-2">{c.label ?? t("partnerPortal.newSignup")}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {c.source === "REFERRAL_LINK"
                            ? t("partnerPortal.fromLink")
                            : t("partnerPortal.fromPage").replace(
                                "{n}",
                                (c.salesPage ?? "").replace("sales-page-", "")
                              )}
                        </td>
                        <td className="px-2 py-2">
                          {[
                            c.adClick ? (AD_LABELS[c.adClick] ?? c.adClick) : null,
                            c.utmSource,
                            c.utmCampaign,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {PLAN_LABELS[c.plan as PlanTier] ?? c.plan}{" "}
                          <span className="text-muted-foreground text-xs">
                            · {statusText(c.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums sm:px-2">
                          {c.earned.length === 0
                            ? "—"
                            : c.earned.map((e) => money(e.amount, e.currency, tag)).join(" · ")}
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
            <CardTitle className="text-base">{t("partnerPortal.payoutsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.payouts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("partnerPortal.noPayouts")}</p>
            ) : (
              <div className="divide-border divide-y text-sm">
                {dashboard.payouts.map((po) => (
                  <div
                    key={po.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>{shortDate(po.paidAt, tag)}</span>
                    <span className="font-semibold tabular-nums">
                      {money(po.amount, po.currency, tag)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
