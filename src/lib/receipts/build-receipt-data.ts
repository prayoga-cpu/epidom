import { prisma } from "@/lib/prisma";
import { getFinanceSettings, getReceiptBranding } from "@/lib/services";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";
import { RECEIPT_INTL_LOCALE, resolveReceiptLocale } from "@/lib/receipts/receipt-labels";

export interface BuiltReceipt {
  receipt: ReceiptData;
  orderId: string;
  storeId: string;
  storefrontSlug: string | null;
  customerPhone: string | null;
  customerName: string;
  paymentStatus: string;
  autoSendWhatsappReceipt: boolean;
  /** Raw order timestamp — kept separate from `receipt.date` (a string
   * already formatted for the printed/HTML receipt) so callers that need to
   * format it differently (e.g. the WhatsApp message's own date shape) can
   * without reparsing a locale-formatted string. */
  orderDate: Date;
}

/**
 * Canonical server-side "Order -> ReceiptData" builder. Used anywhere a
 * receipt needs to be rendered/sent after the fact (the public /r/[orderId]
 * page, the WhatsApp auto-send job) — as opposed to the POS checkout
 * dialog's own buildReceipt(), which runs client-side from the live cart
 * *before* the round-trip to the server completes and additionally knows
 * things this can't reconstruct after the fact (amountTendered/change, the
 * active cashier's name).
 *
 * Returns null when the order doesn't exist — callers 404 on that.
 */
export async function buildReceiptData(orderId: string): Promise<BuiltReceipt | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      // How the bill was actually settled. Empty for orders placed before
      // multi-tender (no backfill) — those fall back to Order.paymentMethod
      // below, exactly as this builder always did.
      payments: { orderBy: { createdAt: "asc" } },
      table: { select: { label: true } },
      storefront: { select: { slug: true } },
      store: {
        select: {
          name: true,
          business: { select: { locale: true } },
        },
      },
    },
  });
  if (!order) return null;

  const [branding, financeSettings] = await Promise.all([
    getReceiptBranding(order.storeId),
    getFinanceSettings(order.storeId),
  ]);

  // The store's *current* resolved currency — this is what every
  // MenuItem/cart/order amount is actually stored literally in (see
  // CurrencyProvider's own docs: `useCurrency()` reads the store/business
  // finance settings, and the whole POS/dashboard treats that as the
  // store's display currency with no conversion). Orders don't freeze a
  // currency snapshot at creation time, so this is only wrong if the owner
  // changes it after the fact — rare, and out of scope here.
  const currency = financeSettings.currency;
  const receiptLocale = resolveReceiptLocale(order.store.business.locale);

  const items: ReceiptData["items"] = order.items.map((item) => {
    const selectedOptions = Array.isArray(item.selectedOptions)
      ? (item.selectedOptions as Array<{ optionName?: string }>)
      : [];
    return {
      name: item.menuItem?.name ?? item.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      optionNames: selectedOptions.map((o) => o.optionName).filter((n): n is string => !!n),
      notes: item.notes ?? undefined,
    };
  });

  // "OTHER" alone tells the customer nothing — the tender's own note is the
  // label the cashier typed for it (Order.paymentNote is the order-level
  // equivalent, used for the single-method fallback below).
  const tenders: NonNullable<ReceiptData["payments"]> = order.payments.map((payment) => ({
    method: payment.method === "OTHER" && payment.note ? payment.note : payment.method,
    amount: Number(payment.amount),
    amountTendered: payment.amountTendered == null ? undefined : Number(payment.amountTendered),
    change: payment.change == null ? undefined : Number(payment.change),
  }));

  // Cash handed over / change given back. This page used to have no answer at
  // all — it always printed a bare "Paid via CASH" — because the figures only
  // existed in the checkout dialog's in-memory receipt. They are persisted per
  // tender now, so a reprint or the customer's own /r/[orderId] link shows
  // what the paper receipt showed. Summed across cash tenders so a bill split
  // between two cash payments still reconciles.
  const cashTenders = order.payments.filter((p) => p.method === "CASH");
  const amountTendered = cashTenders.reduce(
    (sum, p) => (p.amountTendered == null ? sum : sum + Number(p.amountTendered)),
    0
  );
  const change = cashTenders.reduce(
    (sum, p) => (p.change == null ? sum : sum + Number(p.change)),
    0
  );
  const hasCashTendered = cashTenders.some((p) => p.amountTendered != null);

  const receipt: ReceiptData = {
    storeName: branding.storeName,
    currency,
    locale: receiptLocale,
    tagline: branding.tagline ?? undefined,
    address: branding.address ?? undefined,
    email: branding.email ?? undefined,
    phone: branding.phone ?? undefined,
    instagramHandle: branding.showSocialLinks ? (branding.instagramHandle ?? undefined) : undefined,
    tiktokHandle: branding.showSocialLinks ? (branding.tiktokHandle ?? undefined) : undefined,
    facebookHandle: branding.showSocialLinks ? (branding.facebookHandle ?? undefined) : undefined,
    footerMessage: branding.footerMessage ?? undefined,
    orderNumber: order.orderNumber,
    date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[receiptLocale], {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(order.orderDate),
    items,
    subtotal: Number(order.subtotal),
    tax: Number(order.tax) > 0 ? Number(order.tax) : undefined,
    taxLabel: financeSettings.taxLabel ?? undefined,
    serviceCharge: Number(order.serviceCharge) > 0 ? Number(order.serviceCharge) : undefined,
    discountAmount: Number(order.discountAmount) > 0 ? Number(order.discountAmount) : undefined,
    discountReason: order.discountReason ?? undefined,
    total: Number(order.total),
    // "OTHER" alone tells the customer nothing — show what the cashier
    // actually typed instead (see pos-checkout-dialog.tsx's own buildReceipt,
    // which does the same for the printed thermal receipt).
    paymentMethod:
      order.paymentMethod === "OTHER" && order.paymentNote
        ? order.paymentNote
        : order.paymentMethod,
    // Only set when the order actually has tender rows; an empty array would
    // read as "settled with nothing" to the renderers.
    payments: tenders.length > 0 ? tenders : undefined,
    amountTendered: hasCashTendered ? amountTendered : undefined,
    change: hasCashTendered ? change : undefined,
    tableLabel: order.tableNumber ?? order.table?.label ?? undefined,
    notes: order.notes ?? undefined,
  };

  return {
    receipt,
    orderId: order.id,
    storeId: order.storeId,
    storefrontSlug: order.storefront?.slug ?? null,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    paymentStatus: order.paymentStatus,
    autoSendWhatsappReceipt: branding.autoSendWhatsappReceipt,
    orderDate: order.orderDate,
  };
}
