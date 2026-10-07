import type { PushPayload } from "@/lib/push/send";
import { resolveReceiptLocale, type ReceiptLocale } from "@/lib/receipts/receipt-labels";

/**
 * The OS notification a till device gets when a storefront order lands — in the
 * store's own language (Business.locale), since there is no viewer to ask.
 * Plain module so it can be unit-tested without the push transport.
 */
const COPY: Record<ReceiptLocale, { unpaid: string; paid: string; collect: string }> = {
  id: {
    unpaid: "Pesanan online baru · belum dibayar",
    paid: "Pesanan online baru",
    collect: "tagih pembayaran di kasir",
  },
  en: {
    unpaid: "New online order · unpaid",
    paid: "New online order",
    collect: "collect payment at the cashier",
  },
  fr: {
    unpaid: "Nouvelle commande en ligne · non payée",
    paid: "Nouvelle commande en ligne",
    collect: "encaisser le paiement en caisse",
  },
};

export function storefrontOrderPushPayload(args: {
  locale: string | null | undefined;
  storeId: string;
  orderId: string;
  orderNumber: string;
  queueNumber?: number | null;
  customerName: string;
  unpaid: boolean;
}): PushPayload {
  const copy = COPY[resolveReceiptLocale(args.locale)];
  // The queue number is what gets called out at the counter; the order number
  // is the fallback for a store that doesn't allocate one.
  const ref = args.queueNumber ? `#${args.queueNumber}` : args.orderNumber;
  const who = [ref, args.customerName.trim()].filter(Boolean).join(" · ");
  return {
    title: args.unpaid ? copy.unpaid : copy.paid,
    body: args.unpaid ? `${who} — ${copy.collect}` : who,
    url: `/store/${args.storeId}/pos/orders`,
    // One notification per order: a re-send replaces it instead of stacking.
    tag: `order-${args.orderId}`,
  };
}
