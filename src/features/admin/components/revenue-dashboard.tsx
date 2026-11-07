"use client";

import { useI18n } from "@/components/lang/i18n-provider";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Coins,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  Building,
  AlertCircle,
  Printer,
  ArrowUpDown,
  Radio,
  ReceiptText,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanRow {
  plan: string;
  name: string;
  count: number;
  monthlyEur: number;
}
interface MonthRow {
  key: string;
  label: string;
  grossEur: number;
  invoices: number;
}
interface PaymentRow {
  id: string;
  number: string | null;
  paidAt: string;
  customerName: string | null;
  customerEmail: string | null;
  description: string | null;
  amount: number;
  currency: string;
  eurAmount: number;
  country: string | null;
}
interface RevenueData {
  source: string;
  generatedAt: string;
  baseCurrency: string;
  displayCurrencies: string[];
  defaultCurrency: string;
  rates: Record<string, number>;
  ratesLive: boolean;
  nativeCurrencies: string[];
  split: { evan: number; darwin: number };
  mrr: { totalEur: number; plans: PlanRow[] };
  recap: { historyMonths: number; totalCollectedEur: number; months: MonthRow[] };
  payments: PaymentRow[];
  paymentLogCapped: boolean;
}

const FRACTION_DIGITS: Record<string, number> = { EUR: 2, USD: 2, IDR: 0, MGA: 0 };
const CURRENCY_LOCALE: Record<string, string | undefined> = {
  EUR: "fr-FR",
  USD: "en-US",
  IDR: "id-ID",
  MGA: "mg-MG",
};

function makeFmt(currency: string) {
  const code = currency.toUpperCase();
  const fd = FRACTION_DIGITS[code] ?? 2;
  const f = new Intl.NumberFormat(CURRENCY_LOCALE[code], {
    style: "currency",
    currency: code,
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  });
  return (n: number | null | undefined) => f.format(n ?? 0);
}

function fmtDate(iso: string, locale?: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** ISO-3166 alpha-2 country code → flag emoji (e.g. "ID" → 🇮🇩). */
function flagEmoji(cc: string | null): string {
  if (!cc || cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => A + c.charCodeAt(0) - 65));
}

/** Display a payment's billing region (the country that drove its currency/price). */
function regionLabel(cc: string | null): string {
  if (!cc) return "—";
  const flag = flagEmoji(cc);
  return flag ? `${flag} ${cc.toUpperCase()}` : cc.toUpperCase();
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export function RevenueDashboard() {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const { data, isLoading, error } = useQuery<{ data: RevenueData }>({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/revenue");
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.detail || json?.error || t("adminPages.revenue.fetchFailed"));
      }
      return json;
    },
  });

  const revenue = data?.data;
  const [currency, setCurrency] = useState<string>("");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    if (revenue && (!currency || !revenue.displayCurrencies.includes(currency))) {
      setCurrency(revenue.defaultCurrency);
    }
  }, [revenue, currency]);

  const selected = currency || revenue?.defaultCurrency || "idr";
  const rate = revenue?.rates[selected] ?? 1;
  const evanPct = revenue?.split.evan ?? 0.6;
  const darwinPct = revenue?.split.darwin ?? 0.4;

  const fmt = useMemo(() => makeFmt(selected), [selected]);
  const toDisplay = useMemo(() => (eur: number) => eur * rate, [rate]);

  const months = useMemo(() => {
    const list = revenue?.recap.months ?? [];
    return [...list].sort((a, b) =>
      sortDesc ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)
    );
  }, [revenue?.recap.months, sortDesc]);

  const totalCollected = toDisplay(revenue?.recap.totalCollectedEur ?? 0);
  const mrrTotal = toDisplay(revenue?.mrr.totalEur ?? 0);

  function handlePrint() {
    if (!revenue) return;
    const code = selected.toUpperCase();
    const generated = new Date(revenue.generatedAt).toLocaleString(intlLocale);
    const rates = t(revenue.ratesLive ? "adminPages.revenue.ratesLive" : "adminPages.revenue.ratesApprox");
    const h = (key: string) => escapeHtml(t(`adminPages.revenue.${key}`));
    const fmtNative = (p: PaymentRow) => makeFmt(p.currency)(p.amount);

    const monthRows = months
      .map((m) => {
        const g = toDisplay(m.grossEur);
        return `<tr><td>${escapeHtml(m.label)}</td><td class="r">${fmt(g)}</td><td class="r">${fmt(
          g * evanPct
        )}</td><td class="r">${fmt(g * darwinPct)}</td><td class="r">${m.invoices}</td></tr>`;
      })
      .join("");

    const paymentRows = revenue.payments
      .map(
        (p) =>
          `<tr><td>${escapeHtml(fmtDate(p.paidAt, intlLocale))}</td><td>${escapeHtml(
            p.customerName || p.customerEmail || "—"
          )}</td><td>${escapeHtml(p.country ? p.country.toUpperCase() : "—")}</td><td>${escapeHtml(
            p.description || "—"
          )}</td><td>${escapeHtml(p.number || "—")}</td><td class="r">${escapeHtml(
            fmtNative(p)
          )}</td><td class="r">${fmt(toDisplay(p.eurAmount))}</td></tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>${h("pdf.docTitle").replace("{currency}", code)}</title>
<style>
  *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#64748b;font-size:11px;margin:0 0 18px}
  .cards{display:flex;gap:12px;margin:16px 0 8px}
  .card{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
  .card .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  .card .val{font-size:18px;font-weight:700;margin-top:4px}
  h2{font-size:13px;margin:22px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:11px}
  th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#475569}
  td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td{font-weight:700;background:#f8fafc}
  @media print{body{margin:14mm}}
</style></head><body>
  <h1>${h("pdf.heading").replace("{currency}", code)}</h1>
  <p class="muted">${h("pdf.meta")
    .replace("{when}", escapeHtml(generated))
    .replace(/\{currency\}/g, code)
    .replace("{rates}", escapeHtml(rates))}</p>
  <div class="cards">
    <div class="card"><div class="lbl">${h("cards.currentMrr")}</div><div class="val">${fmt(mrrTotal)}</div></div>
    <div class="card"><div class="lbl">${h("cards.evan")}</div><div class="val">${fmt(mrrTotal * evanPct)}</div></div>
    <div class="card"><div class="lbl">${h("cards.darwin")}</div><div class="val">${fmt(mrrTotal * darwinPct)}</div></div>
  </div>
  <h2>${h("recap.pdfTitle").replace("{months}", String(revenue.recap.historyMonths))}</h2>
  <table><thead><tr><th>${h("recap.month")}</th><th class="r">${h("recap.collected")}</th><th class="r">${h("recap.evanCol")}</th><th class="r">${h("recap.darwinCol")}</th><th class="r">${h("recap.invoices")}</th></tr></thead>
  <tbody>${monthRows || `<tr><td colspan="5">${h("recap.noneShort")}</td></tr>`}</tbody>
  <tfoot><tr><td>${h("recap.total")}</td><td class="r">${fmt(totalCollected)}</td><td class="r">${fmt(
    totalCollected * evanPct
  )}</td><td class="r">${fmt(totalCollected * darwinPct)}</td><td class="r">${months.reduce(
    (s, m) => s + m.invoices,
    0
  )}</td></tr></tfoot></table>
  <h2>${h("log.title")} (${revenue.payments.length})</h2>
  <table><thead><tr><th>${h("log.date")}</th><th>${h("log.customer")}</th><th>${h("log.region")}</th><th>${h("log.planDesc")}</th><th>${h("log.invoice")}</th><th class="r">${h("log.charged")}</th><th class="r">≈ ${code}</th></tr></thead>
  <tbody>${paymentRows || `<tr><td colspan="7">${h("log.none")}</td></tr>`}</tbody></table>
</body></html>`;

    const w = window.open("", "_blank", "width=1000,height=1200");
    if (!w) {
      alert(t("adminPages.revenue.popupBlocked"));
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("adminPages.revenue.error")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("adminPages.revenue.loadFailed")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasMixedNative = (revenue?.nativeCurrencies.length ?? 0) > 1;

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      {/* Header */}
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">{t("adminPages.revenue.title")}</h1>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Radio className="h-3 w-3 text-emerald-400" />
                {t("adminPages.revenue.subtitle")}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Display-currency selector */}
              <div className="border-border bg-muted/40 flex items-center rounded-lg border p-0.5">
                {(revenue?.displayCurrencies ?? ["idr", "eur", "usd"]).map((c) => {
                  const active = c === selected;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      disabled={isLoading}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                        active
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading || !revenue}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                {t("adminPages.revenue.export")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
                {t("adminPages.revenue.back")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Info Alert */}
        <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-400">
          <ArrowRightLeft className="h-4 w-4 text-blue-400" />
          <AlertTitle>{t("adminPages.revenue.alertTitle")}</AlertTitle>
          <AlertDescription className="mt-1 text-blue-400/80">
            {t("adminPages.revenue.alertBody")
              .replace("{currency}", selected.toUpperCase())
              .replace("{rates}", t(revenue?.ratesLive ? "adminPages.revenue.ratesLive" : "adminPages.revenue.ratesApprox"))}
          </AlertDescription>
        </Alert>

        {/* Share cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium text-emerald-500/80">
                <Coins className="h-4 w-4" />{" "}
                {t("adminPages.revenue.cards.totalMrr").replace("{currency}", selected.toUpperCase())}
              </CardDescription>
              <CardTitle className="text-4xl text-emerald-400">
                {isLoading ? <Skeleton className="h-10 w-40" /> : fmt(mrrTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.revenue.cards.totalMrrNote").replace("{currency}", selected.toUpperCase())}
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Building className="h-4 w-4 text-blue-500" /> {t("adminPages.revenue.cards.evan")}
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-28" /> : fmt(mrrTotal * evanPct)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.revenue.cards.evanNote")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Wallet className="h-4 w-4 text-orange-500" /> {t("adminPages.revenue.cards.darwin")}
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-28" /> : fmt(mrrTotal * darwinPct)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                {t("adminPages.revenue.cards.darwinNote")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan breakdown */}
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            {t("adminPages.revenue.breakdown.title").replace("{currency}", selected.toUpperCase())}
          </h2>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : revenue && revenue.mrr.plans.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {revenue.mrr.plans.map((p) => (
                <Card key={p.plan}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          p.plan === "POS"
                            ? "bg-blue-500"
                            : p.plan === "OPERATIONS"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                      />
                      {t("adminPages.revenue.breakdown.planName").replace("{name}", p.name)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-2xl font-bold">
                        {p.count}
                        <span className="text-muted-foreground text-sm font-normal">
                          {t(p.count === 1 ? "adminPages.revenue.breakdown.activeOne" : "adminPages.revenue.breakdown.activeMany")}
                        </span>
                      </div>
                      <div className="text-lg font-medium text-emerald-400">
                        {fmt(toDisplay(p.monthlyEur))}{t("adminPages.revenue.breakdown.perMonth")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                {t("adminPages.revenue.breakdown.none")}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly recap */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("adminPages.revenue.recap.title")}{" "}
              {revenue ? (
                <span className="text-muted-foreground text-sm font-normal">
                  {t("adminPages.revenue.recap.lastMonths")
                    .replace("{months}", String(revenue.recap.historyMonths))
                    .replace("{currency}", selected.toUpperCase())}
                </span>
              ) : null}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDesc((v) => !v)}
              disabled={isLoading}
            >
              <ArrowUpDown className="mr-1.5 h-4 w-4" />
              {sortDesc ? t("adminPages.revenue.recap.newest") : t("adminPages.revenue.recap.oldest")}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : months.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.recap.month")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("adminPages.revenue.recap.collected")}</th>
                        <th className="px-4 py-3 text-right font-medium text-blue-400">
                          {t("adminPages.revenue.recap.evanCol")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-orange-400">
                          {t("adminPages.revenue.recap.darwinCol")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">{t("adminPages.revenue.recap.invoices")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => {
                        const g = toDisplay(m.grossEur);
                        return (
                          <tr key={m.key} className="border-border/60 border-b last:border-0">
                            <td className="text-foreground px-4 py-3 font-medium">{m.label}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">
                              {fmt(g)}
                            </td>
                            <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                              {fmt(g * evanPct)}
                            </td>
                            <td className="text-foreground px-4 py-3 text-right tabular-nums">
                              {fmt(g * darwinPct)}
                            </td>
                            <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                              {m.invoices}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {revenue && (
                      <tfoot>
                        <tr className="border-border bg-muted/30 border-t font-bold">
                          <td className="px-4 py-3">{t("adminPages.revenue.recap.total")}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">
                            {fmt(totalCollected)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {fmt(totalCollected * evanPct)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {fmt(totalCollected * darwinPct)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {months.reduce((s, m) => s + m.invoices, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <div className="text-muted-foreground py-10 text-center text-sm">
                  {t("adminPages.revenue.recap.none")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment log */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ReceiptText className="text-muted-foreground h-5 w-5" />
            {t("adminPages.revenue.log.title")}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({revenue?.payments.length ?? 0})
            </span>
          </h2>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : revenue && revenue.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.log.date")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.log.customer")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.log.region")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.log.planDesc")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("adminPages.revenue.log.invoice")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("adminPages.revenue.log.charged")}</th>
                        <th className="px-4 py-3 text-right font-medium">
                          ≈ {selected.toUpperCase()}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.payments.map((p) => (
                        <tr key={p.id} className="border-border/60 border-b last:border-0">
                          <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                            {fmtDate(p.paidAt, intlLocale)}
                          </td>
                          <td className="text-foreground px-4 py-3">
                            <div className="font-medium">
                              {p.customerName || p.customerEmail || "—"}
                            </div>
                            {p.customerName && p.customerEmail && (
                              <div className="text-muted-foreground text-xs">{p.customerEmail}</div>
                            )}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                            {regionLabel(p.country)}
                          </td>
                          <td className="text-muted-foreground px-4 py-3">
                            {p.description || "—"}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                            {p.number || "—"}
                          </td>
                          <td className="text-foreground px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                            {makeFmt(p.currency)(p.amount)}
                            <span className="text-muted-foreground ml-1 text-[10px] uppercase">
                              {p.currency}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">
                            {fmt(toDisplay(p.eurAmount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(revenue.paymentLogCapped || hasMixedNative) && (
                    <p className="text-muted-foreground border-border border-t px-4 py-2 text-xs">
                      {revenue.paymentLogCapped &&
                        t("adminPages.revenue.log.capped")}
                      {hasMixedNative &&
                        t("adminPages.revenue.log.mixed")
                          .replace("{list}", revenue.nativeCurrencies.join(", ").toUpperCase())
                          .replace("{currency}", selected.toUpperCase())}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground py-10 text-center text-sm">
                  {t("adminPages.revenue.log.none")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
