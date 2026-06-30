import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Always run fresh — this reads live Stripe data, never cache it.
export const dynamic = "force-dynamic";

/** Founder / co-founder revenue split. */
const EVAN_SHARE = 0.6;
const DARWIN_SHARE = 0.4;

/** How many months of paid-invoice history to include in the recap. */
const HISTORY_MONTHS = 24;

/** Extra look-back when fetching invoices so ones paid in-window but created
 *  slightly earlier are still retrieved (we bucket strictly by paid date). */
const INVOICE_FETCH_SLACK = 35 * 24 * 60 * 60; // ~35 days, in seconds

/** Display currencies offered in the report's switcher. */
const DISPLAY_CURRENCIES = ["idr", "eur", "usd"];

/** Safety caps so a runaway account can never hang the request. */
const MAX_SUBSCRIPTIONS = 5000;
const MAX_INVOICES = 10000;
const MAX_PAYMENT_LOG = 500;

/** Stripe zero-decimal currencies — their amounts are already in the major unit. */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx",
  "vnd", "vuv", "xaf", "xof", "xpf",
]);

/** Approximate EUR→X rates used if the live FX API is unavailable. */
const FALLBACK_EUR_RATES: Record<string, number> = {
  eur: 1,
  usd: 1.08,
  idr: 17500,
  mga: 4900,
};

type PlanKey = "POS" | "OPERATIONS" | "OTHER";

const PLAN_NAMES: Record<PlanKey, string> = {
  POS: "POS",
  OPERATIONS: "Operations",
  OTHER: "Other",
};

function buildPricePlanMap(): Record<string, PlanKey> {
  const map: Record<string, PlanKey> = {};
  const pos = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_POS_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_POS_YEARLY,
  ];
  const ops = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_YEARLY,
  ];
  for (const id of pos) if (id) map[id] = "POS";
  for (const id of ops) if (id) map[id] = "OPERATIONS";
  return map;
}

/** Normalize a recurring unit amount (minor units) to a monthly amount. */
function monthlyFromUnit(
  unitAmount: number | null | undefined,
  recurring: Stripe.Price.Recurring | null | undefined,
  quantity: number
): number {
  if (unitAmount == null || !recurring) return 0;
  const amount = unitAmount * (quantity || 1);
  const count = recurring.interval_count || 1;
  switch (recurring.interval) {
    case "year":
      return amount / (12 * count);
    case "month":
      return amount / count;
    case "week":
      return (amount * 52) / 12 / count;
    case "day":
      return (amount * 365) / 12 / count;
    default:
      return amount;
  }
}

/** Convert a Stripe raw amount to the major unit of its currency. */
function toMajor(raw: number, currency: string): number {
  return ZERO_DECIMAL.has(currency) ? raw : raw / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthKey(unixSeconds: number): { key: string; label: string } {
  const d = new Date(unixSeconds * 1000);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return { key, label };
}

/** Fetch EUR→X rates for every currency (one call). Falls back to approximations. */
async function getEurRates(): Promise<{ rates: Record<string, number>; live: boolean }> {
  const key = process.env.EXCHANGE_RATE_API_KEY;
  const base = process.env.EXCHANGE_RATE_API_URL || "https://v6.exchangerate-api.com/v6";
  if (!key) return { rates: { ...FALLBACK_EUR_RATES }, live: false };
  try {
    const res = await fetch(`${base}/${key}/latest/EUR`, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!res.ok || data.result !== "success" || !data.conversion_rates) {
      return { rates: { ...FALLBACK_EUR_RATES }, live: false };
    }
    const rates: Record<string, number> = { ...FALLBACK_EUR_RATES };
    for (const [k, v] of Object.entries(data.conversion_rates as Record<string, number>)) {
      rates[k.toLowerCase()] = v;
    }
    return { rates, live: true };
  } catch {
    return { rates: { ...FALLBACK_EUR_RATES }, live: false };
  }
}

type PlanAgg = Record<PlanKey, { count: number; monthlyEur: number }>;
const newPlanAgg = (): PlanAgg => ({
  POS: { count: 0, monthlyEur: 0 },
  OPERATIONS: { count: 0, monthlyEur: 0 },
  OTHER: { count: 0, monthlyEur: 0 },
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, isAdmin: true },
    });

    if (!user || !isAdminUser(user.email, user.isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. If you just added STRIPE_SECRET_KEY to .env, restart the dev server (env is read at boot).",
        },
        { status: 503 }
      );
    }

    const pricePlanMap = buildPricePlanMap();
    const { rates, live: ratesLive } = await getEurRates();
    const nativeSeen = new Set<string>();

    /** Convert a major amount in `cur` to EUR. */
    const toEur = (amountMajor: number, cur: string): number => {
      const r = rates[cur];
      return r && r > 0 ? amountMajor / r : amountMajor;
    };

    // Resolve a price's unit amount in the SUBSCRIPTION'S billing currency. A
    // multi-currency price (e.g. base USD $14.99 billed in IDR) carries the real
    // per-currency amount in `currency_options`, which isn't returned by default —
    // fetch it once per price. Without this, MRR reads the base-currency amount and
    // mis-scales it (the cause of the "Rp 0" MRR).
    const priceCache = new Map<string, Stripe.Price>();
    const resolveUnitAmount = async (
      price: Stripe.Price | null,
      cur: string
    ): Promise<number | null> => {
      if (!price) return null;
      if (price.currency === cur) return price.unit_amount;
      let full = priceCache.get(price.id);
      if (!full) {
        try {
          full = await stripe.prices.retrieve(price.id, { expand: ["currency_options"] });
          priceCache.set(price.id, full);
        } catch {
          return price.unit_amount;
        }
      }
      return full.currency_options?.[cur]?.unit_amount ?? price.unit_amount;
    };

    // ── Current MRR — from LIVE active subscriptions, normalized to EUR ─────────
    let mrrEur = 0;
    const planAgg = newPlanAgg();

    let subSeen = 0;
    for await (const sub of stripe.subscriptions.list({
      status: "active",
      expand: ["data.latest_invoice"],
      limit: 100,
    })) {
      if (++subSeen > MAX_SUBSCRIPTIONS) break;

      // Only count subscriptions backed by a REAL successful payment. An "active"
      // subscription whose latest invoice was never actually paid (trials, unpaid
      // test subs, 100%-off comps) is not real revenue and must be excluded.
      const latest = sub.latest_invoice;
      const isPaid =
        latest != null &&
        typeof latest === "object" &&
        latest.status === "paid" &&
        (latest.amount_paid ?? 0) > 0;
      if (!isPaid) continue;

      const cur = (sub.currency || "eur").toLowerCase();
      nativeSeen.add(cur);

      let items = sub.items.data;
      if (sub.items.has_more) {
        items = [];
        for await (const it of stripe.subscriptionItems.list({ subscription: sub.id, limit: 100 })) {
          items.push(it);
        }
      }

      let subMonthlyEur = 0;
      let primaryPlan: PlanKey = "OTHER";
      let primaryAmount = -1;
      for (const item of items) {
        const price = item.price;
        const unit = await resolveUnitAmount(price, cur);
        const monthlyNative = toMajor(monthlyFromUnit(unit, price?.recurring, item.quantity ?? 1), cur);
        const monthlyEur = toEur(monthlyNative, cur);
        subMonthlyEur += monthlyEur;
        const plan = (price?.id && pricePlanMap[price.id]) || "OTHER";
        if (monthlyEur > primaryAmount) {
          primaryAmount = monthlyEur;
          primaryPlan = plan;
        }
      }

      mrrEur += subMonthlyEur;
      planAgg[primaryPlan].count += 1;
      planAgg[primaryPlan].monthlyEur += subMonthlyEur;
    }

    // ── Monthly recap + payment log — from LIVE paid invoices ───────────────────
    const sinceDate = new Date();
    sinceDate.setUTCMonth(sinceDate.getUTCMonth() - HISTORY_MONTHS);
    const sinceUnix = Math.floor(sinceDate.getTime() / 1000);

    const monthsMap = new Map<
      string,
      { key: string; label: string; grossEur: number; invoices: number }
    >();
    const payments: Array<{
      id: string;
      number: string | null;
      paidAt: string;
      paidAtUnix: number;
      customerName: string | null;
      customerEmail: string | null;
      description: string | null;
      amount: number;
      currency: string;
      eurAmount: number;
      country: string | null;
    }> = [];

    let invSeen = 0;
    for await (const inv of stripe.invoices.list({
      status: "paid",
      created: { gte: sinceUnix - INVOICE_FETCH_SLACK },
      limit: 100,
    })) {
      if (++invSeen > MAX_INVOICES) break;
      const paidRaw = inv.amount_paid ?? 0;
      if (paidRaw <= 0) continue;

      const paidAt = inv.status_transitions?.paid_at ?? inv.created;
      if (paidAt < sinceUnix) continue;

      const cur = (inv.currency || "eur").toLowerCase();
      nativeSeen.add(cur);
      const amountNative = toMajor(paidRaw, cur);
      const amountEur = toEur(amountNative, cur);

      const { key, label } = monthKey(paidAt);
      const m = monthsMap.get(key) ?? { key, label, grossEur: 0, invoices: 0 };
      m.grossEur += amountEur;
      m.invoices += 1;
      monthsMap.set(key, m);

      if (payments.length < MAX_PAYMENT_LOG) {
        payments.push({
          id: inv.id ?? "",
          number: inv.number ?? null,
          paidAt: new Date(paidAt * 1000).toISOString(),
          paidAtUnix: paidAt,
          customerName: inv.customer_name ?? null,
          customerEmail: inv.customer_email ?? null,
          description: inv.lines?.data?.[0]?.description ?? null,
          amount: round2(amountNative),
          currency: cur,
          eurAmount: round2(amountEur),
          // Billing region — drives which currency/price the customer is charged.
          country: inv.customer_address?.country ?? null,
        });
      }
    }

    payments.sort((a, b) => b.paidAtUnix - a.paidAtUnix);

    const months = [...monthsMap.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((m) => ({
        key: m.key,
        label: m.label,
        grossEur: round2(m.grossEur),
        invoices: m.invoices,
      }));
    const totalCollectedEur = round2(months.reduce((s, m) => s + m.grossEur, 0));

    const plans = (["POS", "OPERATIONS", "OTHER"] as PlanKey[])
      .filter((p) => planAgg[p].count > 0)
      .map((p) => ({
        plan: p,
        name: PLAN_NAMES[p],
        count: planAgg[p].count,
        monthlyEur: round2(planAgg[p].monthlyEur),
      }));

    // EUR→display rates for just the offered display currencies.
    const displayRates: Record<string, number> = {};
    for (const c of DISPLAY_CURRENCIES) displayRates[c] = rates[c] ?? FALLBACK_EUR_RATES[c] ?? 1;

    return NextResponse.json({
      data: {
        source: "stripe_live",
        generatedAt: new Date().toISOString(),
        baseCurrency: "eur",
        displayCurrencies: DISPLAY_CURRENCIES,
        defaultCurrency: "idr",
        rates: displayRates,
        ratesLive,
        nativeCurrencies: [...nativeSeen].sort(),
        split: { evan: EVAN_SHARE, darwin: DARWIN_SHARE },
        mrr: { totalEur: round2(mrrEur), plans },
        recap: { historyMonths: HISTORY_MONTHS, totalCollectedEur, months },
        payments: payments.map((p) => ({
          id: p.id,
          number: p.number,
          paidAt: p.paidAt,
          customerName: p.customerName,
          customerEmail: p.customerEmail,
          description: p.description,
          amount: p.amount,
          currency: p.currency,
          eurAmount: p.eurAmount,
        })),
        paymentLogCapped: payments.length >= MAX_PAYMENT_LOG,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to fetch revenue:", error);
    const detail = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { error: "Failed to load revenue from Stripe", detail },
      { status: 500 }
    );
  }
}
