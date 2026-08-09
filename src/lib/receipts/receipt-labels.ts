/**
 * Fixed receipt vocabulary ("No. Bill", "TOTAL", "LUNAS", ...), shared
 * between the HTML/PDF receipt (receipt-document.tsx) and the physical
 * ESC/POS print (thermal-printer.ts) so both stay in sync with the same
 * `ReceiptData.locale`. Deliberately a plain data module (no React, no
 * server-only APIs) so it can be imported from a Server Component, a client
 * dialog, and the non-React thermal-printer module alike.
 */

import { format, type Locale } from "date-fns";
import { enUS, fr as frDateFns, id as idDateFns } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils/formatting";

export type ReceiptLocale = "en" | "fr" | "id";

/** `Intl` locale tag for money/date formatting on the receipt. */
export const RECEIPT_INTL_LOCALE: Record<ReceiptLocale, string> = {
  id: "id-ID",
  en: "en-US",
  fr: "fr-FR",
};

interface ReceiptLabels {
  billNo: string;
  date: string;
  cashier: string;
  table: string;
  item: string;
  qty: string;
  total: string;
  subtotal: string;
  tax: string;
  service: string;
  discount: string;
  /** Prefixes the payment method, e.g. `${paidVia} (QRIS)`. */
  paidVia: string;
  paid: string;
  cash: string;
  change: string;
  notes: string;
  defaultFooter: string;
  poweredByTitle: string;
}

export const RECEIPT_LABELS: Record<ReceiptLocale, ReceiptLabels> = {
  id: {
    billNo: "No. Bill",
    date: "Tanggal",
    cashier: "Kasir",
    table: "Meja",
    item: "ITEM",
    qty: "QTY",
    total: "TOTAL",
    subtotal: "SUBTOTAL",
    tax: "Pajak",
    service: "Service",
    discount: "Diskon",
    paidVia: "Bayar",
    paid: "LUNAS",
    cash: "TUNAI",
    change: "KEMBALI",
    notes: "Catatan",
    defaultFooter: "Terima kasih!\nSilakan datang kembali",
    poweredByTitle: "Cafe & Restaurant System",
  },
  en: {
    billNo: "Bill No.",
    date: "Date",
    cashier: "Cashier",
    table: "Table",
    item: "ITEM",
    qty: "QTY",
    total: "TOTAL",
    subtotal: "SUBTOTAL",
    tax: "Tax",
    service: "Service",
    discount: "Discount",
    paidVia: "Paid via",
    paid: "PAID",
    cash: "CASH",
    change: "CHANGE",
    notes: "Notes",
    defaultFooter: "Thank you!\nPlease come again",
    poweredByTitle: "Cafe & Restaurant System",
  },
  fr: {
    billNo: "N° de facture",
    date: "Date",
    cashier: "Caissier",
    table: "Table",
    item: "ARTICLE",
    qty: "QTÉ",
    total: "TOTAL",
    subtotal: "SOUS-TOTAL",
    tax: "Taxe",
    service: "Service",
    discount: "Remise",
    paidVia: "Payé via",
    paid: "PAYÉ",
    cash: "ESPÈCES",
    change: "MONNAIE",
    notes: "Remarques",
    defaultFooter: "Merci !\nÀ bientôt",
    poweredByTitle: "Cafe & Restaurant System",
  },
};

/** Our own domain, shown in the receipt footer — not the merchant's. */
export const RECEIPT_POWERED_BY_URL = "www.epidom.fr";

export function resolveReceiptLocale(value: string | null | undefined): ReceiptLocale {
  return value === "en" || value === "fr" || value === "id" ? value : "id";
}

const RECEIPT_DATE_FNS_LOCALE: Record<ReceiptLocale, Locale> = {
  id: idDateFns,
  en: enUS,
  fr: frDateFns,
};

export interface ReceiptWhatsAppMessageInput {
  customerName: string;
  storeName: string;
  total: number;
  currency: string;
  /** When the order was placed — formatted fresh here (not reused from
   * `ReceiptData.date`) so it can use a single cross-locale "d MMM yyyy
   * HH:mm" shape instead of each locale's native `Intl.DateTimeFormat`
   * punctuation (id-ID's "9 Agu 2026, 01.37" vs en-US's "Aug 9, 2026, 1:37
   * AM"), which reads awkwardly dropped into a chat message. */
  orderDate: Date;
  receiptUrl: string;
  locale: ReceiptLocale;
}

// WhatsApp's own markdown: single asterisks render bold in the client, not
// double — do not "fix" these to **text**.
const WHATSAPP_MESSAGE_TEMPLATE: Record<
  ReceiptLocale,
  (i: { name: string; store: string; amount: string; date: string; url: string }) => string
> = {
  id: ({ name, store, amount, date, url }) =>
    `Hai ${name} 👋\n` +
    `Terima kasih ya kunjungannya di *${store}*.\n` +
    `Berikut total pesananmu sebesar *${amount}*, pada ${date}.\n\n` +
    `Detailnya kami cantumkan di sini ya ${url}`,
  en: ({ name, store, amount, date, url }) =>
    `Hi ${name} 👋\n` +
    `Thank you for visiting *${store}*.\n` +
    `Your order total is *${amount}*, on ${date}.\n\n` +
    `Here's your receipt: ${url}`,
  fr: ({ name, store, amount, date, url }) =>
    `Bonjour ${name} 👋\n` +
    `Merci pour votre visite chez *${store}*.\n` +
    `Le total de votre commande est de *${amount}*, le ${date}.\n\n` +
    `Voici votre reçu : ${url}`,
};

/** The one WhatsApp receipt message template, shared between the Fonnte
 * auto-send path (notifications/index.ts) and the manual "Open in
 * WhatsApp" wa.me redirect (send-receipt-whatsapp.tsx) — so the two never
 * drift into different copy for what is, to the customer, the same message. */
export function buildReceiptWhatsAppMessage(input: ReceiptWhatsAppMessageInput): string {
  const amount = formatCurrency(input.total, input.currency, RECEIPT_INTL_LOCALE[input.locale]);
  const date = format(input.orderDate, "d MMM yyyy HH:mm", {
    locale: RECEIPT_DATE_FNS_LOCALE[input.locale],
  });
  return WHATSAPP_MESSAGE_TEMPLATE[input.locale]({
    name: input.customerName,
    store: input.storeName,
    amount,
    date,
    url: input.receiptUrl,
  });
}
