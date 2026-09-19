import type { ReceiptData } from "@/lib/pwa/thermal-printer";
import { RECEIPT_INTL_LOCALE, type ReceiptLocale } from "@/lib/receipts/receipt-labels";
import type { CartItem } from "../types/pos.types";

/** The slice of the cart store a provisional bill prints. */
export interface BillCartSnapshot {
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  total: number;
  tableNumber: string;
}

/** The slice of the store's receipt settings the header/footer branding reads. */
export interface BillReceiptSettings {
  tagline?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  facebookHandle?: string | null;
  footerMessage?: string | null;
  showSocialLinks?: boolean;
}

export interface BuildBillReceiptInput {
  cart: BillCartSnapshot;
  storeName?: string;
  /** ISO 4217 code — the store's display currency; every amount is literal in it. */
  currency: string;
  locale: ReceiptLocale;
  receiptSettings?: BillReceiptSettings | null;
  taxLabel?: string | null;
  cashierName?: string;
  paperWidth?: 32 | 48;
  /** The saved bill's number when the cart is a resumed one; a fresh cart has none yet. */
  orderNumber?: string | null;
  now?: Date;
}

/**
 * The provisional "Print Bill" ticket: what the customer owes so far, printed
 * BEFORE they pay. Mirrors what checkout's own buildReceipt fills so the two
 * paper documents line up, except that it carries no payment lines — the
 * printer treats `documentType: "bill"` as "not a receipt" and drops them.
 *
 * Pure (no hooks, no clock unless `now` is omitted) so it is unit-testable.
 */
export function buildBillReceipt(input: BuildBillReceiptInput): ReceiptData {
  const { cart, receiptSettings, locale } = input;
  const showSocial = receiptSettings?.showSocialLinks !== false;

  return {
    storeName: input.storeName ?? "Epidom POS",
    currency: input.currency,
    locale,
    tagline: receiptSettings?.tagline ?? undefined,
    address: receiptSettings?.address ?? undefined,
    email: receiptSettings?.email ?? undefined,
    phone: receiptSettings?.phone ?? undefined,
    instagramHandle: showSocial ? (receiptSettings?.instagramHandle ?? undefined) : undefined,
    tiktokHandle: showSocial ? (receiptSettings?.tiktokHandle ?? undefined) : undefined,
    facebookHandle: showSocial ? (receiptSettings?.facebookHandle ?? undefined) : undefined,
    footerMessage: receiptSettings?.footerMessage ?? undefined,
    // A bill that was never saved has no number yet — same placeholder checkout
    // uses when the server didn't return one.
    orderNumber: input.orderNumber || "—",
    date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[locale] ?? "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(input.now ?? new Date()),
    items: cart.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.lineTotal,
      optionNames: i.modifiers.map((m) => m.optionName),
      notes: i.notes,
    })),
    subtotal: cart.subtotal,
    tax: cart.tax > 0 ? cart.tax : undefined,
    taxLabel: input.taxLabel ?? undefined,
    serviceCharge: cart.serviceCharge > 0 ? cart.serviceCharge : undefined,
    discountAmount: cart.discountAmount > 0 ? cart.discountAmount : undefined,
    discountReason: cart.discountReason ?? undefined,
    total: cart.total,
    documentType: "bill",
    // Required by the type, meaningless on a bill: nothing has been paid yet.
    paymentMethod: "",
    cashierName: input.cashierName,
    tableLabel: cart.tableNumber || undefined,
    width: input.paperWidth,
  };
}
