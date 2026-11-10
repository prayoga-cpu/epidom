import type Stripe from "stripe";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { subscriptionRepository } from "@/lib/repositories";
import { getInvoiceSubscriptionId } from "@/types/stripe";
import { sendSubscriptionReceiptEmail } from "./email.service";

/**
 * Emails the owner a receipt whenever a subscription payment goes through
 * (Stripe's invoice.payment_succeeded): the plan, the amount, the date, the
 * period it covers, and links to the invoice and its PDF. Stripe's own receipt
 * emails are optional and off in test mode, so this is what makes sure every
 * payment is on record in the owner's inbox.
 *
 * Never throws and sends at most once per invoice, so a retried webhook can't
 * double-send. A free invoice (the POS trial's $0 one) gets no receipt.
 */

const PLAN_NAMES: Record<string, string> = {
  POS: "POS",
  OPERATIONS: "Operations",
  ENTERPRISE: "Enterprise",
};

/** Currencies Stripe counts in whole units. Everything else, IDR included, is in hundredths. */
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const LOCALE_TAGS: Record<string, string> = { en: "en-US", fr: "fr-FR", id: "id-ID" };

/** "€137.88" from Stripe's minor-unit amount. */
export function formatInvoiceAmount(amount: number, currency: string, locale?: string | null) {
  const code = currency.toUpperCase();
  const major = ZERO_DECIMAL.has(code) ? amount : amount / 100;
  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale ?? ""] ?? "id-ID", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "IDR" || ZERO_DECIMAL.has(code) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major} ${code}`;
  }
}

const sentMarker = (invoiceId: string) => `subscription-receipt:${invoiceId}`;

export async function sendSubscriptionReceipt(invoice: Stripe.Invoice): Promise<void> {
  try {
    const invoiceId = invoice.id;
    if (!invoiceId || !(invoice.amount_paid > 0)) return;

    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) return;
    const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
    if (!subscription) return;

    // Once per invoice, even when Stripe delivers the event again.
    const already = await prisma.verification.findFirst({
      where: { identifier: sentMarker(invoiceId) },
      select: { id: true },
    });
    if (already) return;

    const user = await prisma.user.findUnique({
      where: { id: subscription.userId },
      select: { email: true, name: true, locale: true },
    });
    if (!user?.email) return;

    const line = invoice.lines?.data?.[0];
    const period =
      line?.period?.start && line.period.end
        ? { start: new Date(line.period.start * 1000), end: new Date(line.period.end * 1000) }
        : null;
    const paidAt = invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : new Date();

    const result = await sendSubscriptionReceiptEmail({
      email: user.email,
      name: user.name,
      locale: user.locale,
      planName: PLAN_NAMES[subscription.plan] ?? subscription.plan,
      amountLabel: formatInvoiceAmount(invoice.amount_paid, invoice.currency, user.locale),
      paidAt,
      period,
      invoiceNumber: invoice.number ?? null,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    });
    if (!result.success) {
      logger.error("Subscription receipt email failed", { invoiceId, error: result.error });
      return;
    }

    const now = new Date();
    await prisma.verification.create({
      data: {
        identifier: sentMarker(invoiceId),
        value: user.email,
        expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    logger.error("Subscription receipt failed", {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
