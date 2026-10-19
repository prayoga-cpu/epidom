import type Stripe from "stripe";
import { Prisma, type BillingInterval, type SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import {
  commissionOf,
  commissionWindow,
  commissionableAmount,
  refundAdjustment,
  type CommissionLine,
} from "@/lib/partners/commission-math";
import {
  decimalStringToStripeAmount,
  stripeAmountToDecimalString,
} from "@/lib/money/stripe-amount";

/**
 * Partner commissions from Stripe (SaaS billing only).
 *
 * - recordInvoiceCommission: on every paid invoice (`invoice.payment_succeeded`).
 *   Records the account's first paid invoice on its SignupAttribution (every
 *   account, for the reports) and, for a customer credited to a partner, adds
 *   a ledger row for the part of the invoice inside the commission window.
 * - recordRefund: on `refund.created` / `refund.updated`. Takes back the
 *   refunded share of the commission that payment earned.
 *
 * Both re-read Stripe instead of trusting the event body: events are rendered
 * in the webhook endpoint's API version, the SDK types in another. Both are
 * idempotent: a ledger row's `sourceKey` is unique.
 */

/** Days a commission waits before it can be paid out, in case the payment is refunded. */
export const COMMISSION_HOLD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

/** A line Stripe bills for a subscription (not a one-off item), and whether it is a proration. */
function subscriptionLineInfo(line: Stripe.InvoiceLineItem): {
  subscription: boolean;
  proration: boolean;
} {
  const details = line.parent?.subscription_item_details;
  return { subscription: Boolean(details), proration: Boolean(details?.proration) };
}

function toCommissionLine(line: Stripe.InvoiceLineItem): CommissionLine {
  return {
    amount: line.amount,
    discountAmount: (line.discount_amounts ?? []).reduce((sum, d) => sum + d.amount, 0),
    inclusiveTax: (line.taxes ?? [])
      .filter((t) => t.tax_behavior === "inclusive")
      .reduce((sum, t) => sum + t.amount, 0),
    periodStart: line.period.start,
    periodEnd: line.period.end,
  };
}

async function invoiceLines(invoice: Stripe.Invoice): Promise<Stripe.InvoiceLineItem[]> {
  if (!invoice.lines?.has_more) return invoice.lines?.data ?? [];
  const lines: Stripe.InvoiceLineItem[] = [];
  for await (const line of stripe.invoices.listLineItems(invoice.id!, { limit: 100 })) {
    lines.push(line);
  }
  return lines;
}

/** When the invoice was paid (seconds), falling back to when it was created. */
function paidAtSeconds(invoice: Stripe.Invoice): number {
  return invoice.status_transitions?.paid_at ?? invoice.created;
}

/** The payment intent that paid the invoice, for matching a refund later. */
function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  for (const p of invoice.payments?.data ?? []) {
    const id = idOf(p.payment?.payment_intent as string | { id: string } | undefined);
    if (id) return id;
  }
  return null;
}

/** Monthly or yearly, from how long the subscription line's period is. */
function intervalOf(lines: Stripe.InvoiceLineItem[]): BillingInterval | null {
  const line = lines.find(
    (l) => subscriptionLineInfo(l).subscription && !subscriptionLineInfo(l).proration
  );
  if (!line) return null;
  return line.period.end - line.period.start > 200 * 24 * 60 * 60 ? "YEARLY" : "MONTHLY";
}

/** Who pays this invoice: the Subscription row of its Stripe customer, else the metadata. */
async function customerUserId(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId = idOf(invoice.customer as string | { id: string } | null);
  if (customerId) {
    const row = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: { userId: true },
    });
    if (row) return row.userId;
  }
  return invoice.parent?.subscription_details?.metadata?.userId ?? null;
}

/**
 * The account's earliest paid invoice with money in it (not a trial's $0 one),
 * and the start of the period it paid for: listed rather than taken from the
 * invoice at hand, because Stripe doesn't deliver events in order.
 */
async function firstPaidInvoice(
  customerId: string
): Promise<{
  invoice: Stripe.Invoice;
  lines: Stripe.InvoiceLineItem[];
  periodStart: number;
} | null> {
  let earliest: Stripe.Invoice | null = null;
  for await (const inv of stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 100,
  })) {
    if (inv.amount_paid <= 0) continue;
    if (!earliest || paidAtSeconds(inv) < paidAtSeconds(earliest)) earliest = inv;
  }
  if (!earliest) return null;
  const lines = await invoiceLines(earliest);
  const billed = lines.filter(
    (l) => subscriptionLineInfo(l).subscription && !subscriptionLineInfo(l).proration
  );
  const periodStart = Math.min(...(billed.length ? billed : lines).map((l) => l.period.start));
  return {
    invoice: earliest,
    lines,
    periodStart: Number.isFinite(periodStart) ? periodStart : paidAtSeconds(earliest),
  };
}

export interface RecordInvoiceResult {
  status:
    | "no-customer"
    | "no-attribution"
    | "not-paid"
    | "no-partner"
    | "outside-window"
    | "recorded"
    | "already-recorded";
  amountMinor?: number;
}

/** Record what a paid invoice means for its account's attribution and its partner's commission. */
export async function recordInvoiceCommission(invoiceId: string): Promise<RecordInvoiceResult> {
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return { status: "not-paid" };

  const userId = await customerUserId(invoice);
  if (!userId) return { status: "no-customer" };

  let attribution = await prisma.signupAttribution.findUnique({ where: { userId } });
  if (!attribution) return { status: "no-attribution" };

  const customerId = idOf(invoice.customer as string | { id: string } | null);
  const lines = await invoiceLines(invoice);
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true },
  });

  // The first paid invoice opens the commission window, once.
  if (!attribution.firstPaidAt && customerId) {
    const first = await firstPaidInvoice(customerId);
    if (first) {
      const window =
        attribution.partnerId && attribution.commissionMonths
          ? commissionWindow(first.periodStart, attribution.commissionMonths)
          : null;
      await prisma.signupAttribution.updateMany({
        where: { id: attribution.id, firstPaidAt: null },
        data: {
          firstPaidAt: new Date(paidAtSeconds(first.invoice) * 1000),
          firstPaidPlan: (subscription?.plan as SubscriptionPlan | undefined) ?? null,
          firstPaidInterval: intervalOf(first.lines),
          firstPaidCurrency: first.invoice.currency,
          commissionWindowStart: window ? new Date(window.start * 1000) : null,
          commissionWindowEnd: window ? new Date(window.end * 1000) : null,
        },
      });
      attribution =
        (await prisma.signupAttribution.findUnique({ where: { userId } })) ?? attribution;
    }
  }

  // The referral discount counts as used once an invoice carrying it is paid.
  const discounted = (invoice.total_discount_amounts ?? []).some((d) => d.amount > 0);
  if (discounted && attribution.discountPercent && !attribution.discountRedeemedAt) {
    await prisma.signupAttribution.updateMany({
      where: { id: attribution.id, discountRedeemedAt: null },
      data: { discountRedeemedAt: new Date(paidAtSeconds(invoice) * 1000) },
    });
  }

  if (
    !attribution.partnerId ||
    attribution.commissionRate == null ||
    !attribution.commissionWindowStart ||
    !attribution.commissionWindowEnd
  ) {
    return { status: "no-partner" };
  }

  const window = {
    start: Math.floor(attribution.commissionWindowStart.getTime() / 1000),
    end: Math.floor(attribution.commissionWindowEnd.getTime() / 1000),
  };
  const commissionable = commissionableAmount(
    { lines: lines.map(toCommissionLine), amountPaid: invoice.amount_paid, total: invoice.total },
    window
  );
  const rate = Number(attribution.commissionRate);
  const amount = commissionOf(commissionable, rate);
  if (commissionable <= 0 || amount <= 0) return { status: "outside-window" };

  const earnedAt = new Date(paidAtSeconds(invoice) * 1000);
  try {
    await prisma.partnerCommission.create({
      data: {
        partnerId: attribution.partnerId,
        attributionId: attribution.id,
        customerUserId: userId,
        kind: "INVOICE",
        sourceKey: `inv:${invoice.id}`,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoicePaymentIntentId(invoice),
        plan: (subscription?.plan as SubscriptionPlan | undefined) ?? null,
        billingInterval: intervalOf(lines),
        currency: invoice.currency,
        invoiceAmount: stripeAmountToDecimalString(invoice.amount_paid, invoice.currency),
        commissionableAmount: stripeAmountToDecimalString(commissionable, invoice.currency),
        rate: attribution.commissionRate,
        amount: stripeAmountToDecimalString(amount, invoice.currency),
        earnedAt,
        payableAt: new Date(earnedAt.getTime() + COMMISSION_HOLD_DAYS * DAY_MS),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "already-recorded" };
    }
    throw err;
  }
  return { status: "recorded", amountMinor: amount };
}

export type RecordRefundResult =
  | "no-commission"
  | "recorded"
  | "already-recorded"
  | "voided"
  | "ignored";

/**
 * Take back the refunded share of a commission. A refund on a commission not
 * yet paid out waits with it; one on a paid-out commission comes off the next
 * payout. A refund that failed or was cancelled voids its adjustment.
 */
export async function recordRefund(refundId: string): Promise<RecordRefundResult> {
  const refund = await stripe.refunds.retrieve(refundId);
  const sourceKey = `refund:${refund.id}`;

  if (refund.status === "failed" || refund.status === "canceled") {
    const voided = await prisma.partnerCommission.updateMany({
      where: { sourceKey, status: "PENDING" },
      data: { status: "VOID", note: `Refund ${refund.status}` },
    });
    return voided.count > 0 ? "voided" : "ignored";
  }
  if (refund.status !== "succeeded") return "ignored";

  const paymentIntentId = idOf(refund.payment_intent as string | { id: string } | null);
  if (!paymentIntentId) return "no-commission";

  const original = await prisma.partnerCommission.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, kind: "INVOICE" },
  });
  if (!original) return "no-commission";

  const currency = original.currency;
  const commissionMinor = decimalStringToStripeAmount(original.amount.toString(), currency);
  const paymentMinor = decimalStringToStripeAmount(original.invoiceAmount.toString(), currency);

  // Earlier refunds of the same payment already took part of it back.
  const earlier = await prisma.partnerCommission.findMany({
    where: { reversesId: original.id, kind: "REFUND_ADJUSTMENT", status: { not: "VOID" } },
    select: { amount: true, sourceKey: true },
  });
  if (earlier.some((e) => e.sourceKey === sourceKey)) return "already-recorded";
  const alreadyTaken = earlier.reduce(
    (sum, e) => sum - decimalStringToStripeAmount(e.amount.toString(), currency),
    0
  );
  const adjustment = Math.max(
    refundAdjustment(commissionMinor, paymentMinor, refund.amount),
    -(commissionMinor - alreadyTaken)
  );
  if (adjustment >= 0) return "no-commission";

  const earnedAt = new Date(refund.created * 1000);
  try {
    await prisma.partnerCommission.create({
      data: {
        partnerId: original.partnerId,
        attributionId: original.attributionId,
        customerUserId: original.customerUserId,
        kind: "REFUND_ADJUSTMENT",
        sourceKey,
        stripeInvoiceId: original.stripeInvoiceId,
        stripePaymentIntentId: paymentIntentId,
        stripeRefundId: refund.id,
        plan: original.plan,
        billingInterval: original.billingInterval,
        currency,
        invoiceAmount: stripeAmountToDecimalString(-refund.amount, currency),
        commissionableAmount: "0.00",
        rate: original.rate,
        amount: stripeAmountToDecimalString(adjustment, currency),
        earnedAt,
        // Netted with the commission it reverses when that one is still on
        // hold; straight into the next payout when it was already paid.
        payableAt: original.status === "PENDING" ? original.payableAt : earnedAt,
        reversesId: original.id,
        note: `Refund of ${stripeAmountToDecimalString(refund.amount, currency)} ${currency.toUpperCase()}`,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return "already-recorded";
    }
    throw err;
  }
  return "recorded";
}

/**
 * Record the commissions of invoices a customer already paid before they were
 * credited to a partner (a sales page assigned with an earlier "credit from"
 * date). Idempotent, like the webhook.
 */
export async function backfillCustomerCommissions(userId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  const customerId = subscription?.stripeCustomerId;
  // "free_…" / "admin_…" rows are local stubs, not Stripe customers.
  if (!customerId || !customerId.startsWith("cus_")) return 0;

  let recorded = 0;
  for await (const inv of stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 100,
  })) {
    if (inv.amount_paid <= 0 || !inv.id) continue;
    try {
      const result = await recordInvoiceCommission(inv.id);
      if (result.status === "recorded") recorded += 1;
    } catch (err) {
      logger.error("Partner commission backfill failed for an invoice", {
        userId,
        invoiceId: inv.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return recorded;
}
