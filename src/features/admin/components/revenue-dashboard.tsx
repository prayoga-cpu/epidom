"use client";

import { useEffect, useMemo, useState } from "react";
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** ISO-3166 alpha-2 country code → flag emoji (e.g. "ID" → 🇮🇩). */
function flagEmoji(cc: string | null): string {
  if (!cc || cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => A + c.charCodeAt(0) - 65)
  );
}

/** Display a payment's billing region (the country that drove its currency/price). */
function regionLabel(cc: string | null): string {
  if (!cc) return "—";
  const flag = flagEmoji(cc);
  return flag ? `${flag} ${cc.toUpperCase()}` : cc.toUpperCase();
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export function RevenueDashboard() {
  const { data, isLoading, error } = useQuery<{ data: RevenueData }>({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/revenue");
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.detail || json?.error || "Failed to fetch revenue");
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
    const generated = new Date(revenue.generatedAt).toLocaleString();
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
          `<tr><td>${escapeHtml(fmtDate(p.paidAt))}</td><td>${escapeHtml(
            p.customerName || p.customerEmail || "—"
          )}</td><td>${escapeHtml(p.country ? p.country.toUpperCase() : "—")}</td><td>${escapeHtml(
            p.description || "—"
          )}</td><td>${escapeHtml(p.number || "—")}</td><td class="r">${escapeHtml(
            fmtNative(p)
          )}</td><td class="r">${fmt(toDisplay(p.eurAmount))}</td></tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Epidom Revenue Recap — ${code}</title>
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
  <h1>Epidom — Revenue Split &amp; Payout Recap (${code})</h1>
  <p class="muted">Generated ${escapeHtml(generated)} · Source: Live Stripe · Split: Evan 60% / Darwin 40%
    · Totals converted to ${code} at ${revenue.ratesLive ? "live" : "approximate"} FX rates.</p>
  <div class="cards">
    <div class="card"><div class="lbl">Current MRR</div><div class="val">${fmt(mrrTotal)}</div></div>
    <div class="card"><div class="lbl">Evan · Founder (60%)</div><div class="val">${fmt(mrrTotal * evanPct)}</div></div>
    <div class="card"><div class="lbl">Darwin · Co-Founder (40%)</div><div class="val">${fmt(mrrTotal * darwinPct)}</div></div>
  </div>
  <h2>Monthly Recap — Cash Collected (last ${revenue.recap.historyMonths} months)</h2>
  <table><thead><tr><th>Month</th><th class="r">Collected</th><th class="r">Evan (60%)</th><th class="r">Darwin (40%)</th><th class="r">Invoices</th></tr></thead>
  <tbody>${monthRows || `<tr><td colspan="5">No payments collected yet.</td></tr>`}</tbody>
  <tfoot><tr><td>Total</td><td class="r">${fmt(totalCollected)}</td><td class="r">${fmt(
    totalCollected * evanPct
  )}</td><td class="r">${fmt(totalCollected * darwinPct)}</td><td class="r">${months.reduce(
    (s, m) => s + m.invoices,
    0
  )}</td></tr></tfoot></table>
  <h2>Payment Log (${revenue.payments.length})</h2>
  <table><thead><tr><th>Date</th><th>Customer</th><th>Region</th><th>Plan / Description</th><th>Invoice</th><th class="r">Charged</th><th class="r">≈ ${code}</th></tr></thead>
  <tbody>${paymentRows || `<tr><td colspan="7">No payments recorded yet.</td></tr>`}</tbody></table>
</body></html>`;

    const w = window.open("", "_blank", "width=1000,height=1200");
    if (!w) {
      alert("Please allow pop-ups to export the PDF, then try again.");
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
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load revenue data."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasMixedNative = (revenue?.nativeCurrencies.length ?? 0) > 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Revenue Split Report</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-emerald-400" />
                Live Stripe data · Founder/Co-Founder split
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Display-currency selector */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
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
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isLoading || !revenue}>
                <Printer className="mr-1.5 h-4 w-4" />
                Export / Print PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Info Alert */}
        <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-400">
          <ArrowRightLeft className="h-4 w-4 text-blue-400" />
          <AlertTitle>Automatic Payout & Manual Recap</AlertTitle>
          <AlertDescription className="text-blue-400/80 mt-1">
            All subscription payments are collected automatically by the Epidom Stripe account, linked
            to <strong>Evan&apos;s</strong> bank account (France). Each month we reconcile and transfer{" "}
            <strong>Darwin&apos;s</strong> 40% co-founder share to his bank account. Only real
            production payments from live Stripe are counted. Totals are converted to{" "}
            <strong>{selected.toUpperCase()}</strong> at {revenue?.ratesLive ? "live" : "approximate"}{" "}
            FX rates — switch the display currency above; the payment log shows each charge in its
            original currency.
          </AlertDescription>
        </Alert>

        {/* Share cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-500/80 font-medium flex items-center gap-2">
                <Coins className="h-4 w-4" /> Total MRR · {selected.toUpperCase()}
              </CardDescription>
              <CardTitle className="text-4xl text-emerald-400">
                {isLoading ? <Skeleton className="h-10 w-40" /> : fmt(mrrTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Monthly recurring revenue from all active live subscriptions, in{" "}
                {selected.toUpperCase()}.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" /> Evan · Founder (60%)
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-28" /> : fmt(mrrTotal * evanPct)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Retained in the Epidom Stripe account (Evan&apos;s bank).
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-orange-500" /> Darwin · Co-Founder (40%)
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-28" /> : fmt(mrrTotal * darwinPct)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Transferred to Darwin&apos;s bank account at month-end.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan breakdown */}
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Subscription Breakdown · Live MRR ({selected.toUpperCase()})
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
                    <CardTitle className="text-base flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          p.plan === "POS"
                            ? "bg-blue-500"
                            : p.plan === "OPERATIONS"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                      />
                      {p.name} Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-2xl font-bold">
                        {p.count}
                        <span className="text-sm font-normal text-muted-foreground">
                          active {p.count === 1 ? "subscription" : "subscriptions"}
                        </span>
                      </div>
                      <div className="text-lg font-medium text-emerald-400">
                        {fmt(toDisplay(p.monthlyEur))}/mo
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No active live subscriptions yet.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly recap */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Monthly Recap — Cash Collected{" "}
              {revenue ? (
                <span className="text-muted-foreground font-normal text-sm">
                  (last {revenue.recap.historyMonths} months · {selected.toUpperCase()})
                </span>
              ) : null}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSortDesc((v) => !v)} disabled={isLoading}>
              <ArrowUpDown className="mr-1.5 h-4 w-4" />
              {sortDesc ? "Newest first" : "Oldest first"}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : months.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Month</th>
                        <th className="px-4 py-3 text-right font-medium">Collected</th>
                        <th className="px-4 py-3 text-right font-medium text-blue-400">Evan (60%)</th>
                        <th className="px-4 py-3 text-right font-medium text-orange-400">Darwin (40%)</th>
                        <th className="px-4 py-3 text-right font-medium">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => {
                        const g = toDisplay(m.grossEur);
                        return (
                          <tr key={m.key} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3 font-medium text-foreground">{m.label}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">
                              {fmt(g)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {fmt(g * evanPct)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-foreground">
                              {fmt(g * darwinPct)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {m.invoices}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {revenue && (
                      <tfoot>
                        <tr className="border-t border-border bg-muted/30 font-bold">
                          <td className="px-4 py-3">Total</td>
                          <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">
                            {fmt(totalCollected)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(totalCollected * evanPct)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(totalCollected * darwinPct)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {months.reduce((s, m) => s + m.invoices, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No payments collected yet. Real Stripe revenue will appear here month by month.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment log */}
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
            Payment Log{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({revenue?.payments.length ?? 0})
            </span>
          </h2>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : revenue && revenue.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Customer</th>
                        <th className="px-4 py-3 text-left font-medium">Region</th>
                        <th className="px-4 py-3 text-left font-medium">Plan / Description</th>
                        <th className="px-4 py-3 text-left font-medium">Invoice</th>
                        <th className="px-4 py-3 text-right font-medium">Charged</th>
                        <th className="px-4 py-3 text-right font-medium">≈ {selected.toUpperCase()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.payments.map((p) => (
                        <tr key={p.id} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {fmtDate(p.paidAt)}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            <div className="font-medium">{p.customerName || p.customerEmail || "—"}</div>
                            {p.customerName && p.customerEmail && (
                              <div className="text-xs text-muted-foreground">{p.customerEmail}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {regionLabel(p.country)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.description || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                            {p.number || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                            {makeFmt(p.currency)(p.amount)}
                            <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                              {p.currency}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                            {fmt(toDisplay(p.eurAmount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(revenue.paymentLogCapped || hasMixedNative) && (
                    <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                      {revenue.paymentLogCapped && "Showing the most recent payments (log capped). "}
                      {hasMixedNative &&
                        `Charges span multiple currencies (${revenue.nativeCurrencies
                          .join(", ")
                          .toUpperCase()}); the ≈ column converts each to ${selected.toUpperCase()}.`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No payments recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
