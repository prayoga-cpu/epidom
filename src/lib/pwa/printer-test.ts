// "Test print" for the printer settings screen: the REAL layout for the role,
// with made-up content, on real paper. Proves the pairing, the paper width and
// (for labels) the command language in one press — a blank strip or garbage
// characters here is the cheapest place to find out a setting is wrong.

import {
  buildSampleItemLabel,
  printItemLabels,
  type LabelPrinterConfig,
} from "@/lib/pwa/item-label";
import { buildSampleOrderTicket, printOrderTicket } from "@/lib/pwa/order-ticket";
import type { PrinterRole } from "@/lib/pwa/printer-connection";
import { printReceipt, type ReceiptData } from "@/lib/pwa/thermal-printer";
import {
  RECEIPT_INTL_LOCALE,
  TICKET_LABELS,
  type ReceiptLocale,
} from "@/lib/receipts/receipt-labels";

export interface TestPrintOptions {
  locale: ReceiptLocale;
  /** The store's currency, so the sample receipt's amounts read plausibly. */
  currency: string;
  /** This role's paper width (characters per line). */
  width: 32 | 48;
  /** Used only when `role` is LABEL. */
  label: LabelPrinterConfig;
}

function buildSampleReceipt({ locale, currency, width }: TestPrintOptions): ReceiptData {
  const labels = TICKET_LABELS[locale];
  // A rupiah-sized figure on a euro receipt would look like a bug.
  const unitPrice = currency === "IDR" ? 25000 : 4.5;
  const total = unitPrice * 2;
  return {
    storeName: labels.testTitle,
    currency,
    locale,
    orderNumber: "TEST-0001",
    date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[locale], {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date()),
    items: [{ name: labels.testBody, quantity: 2, unitPrice, total }],
    subtotal: total,
    total,
    paymentMethod: "CASH",
    amountTendered: total,
    change: 0,
    width,
  };
}

export async function printTestPage(role: PrinterRole, options: TestPrintOptions): Promise<void> {
  switch (role) {
    case "MAIN":
      return printReceipt(buildSampleReceipt(options));
    case "KITCHEN":
    case "BAR":
      return printOrderTicket(
        role,
        buildSampleOrderTicket({ department: role, locale: options.locale, width: options.width })
      );
    case "LABEL": {
      // Two units of one line, so the "1/2" counter and a form feed between labels are exercised.
      const sample = buildSampleItemLabel();
      return printItemLabels([sample, { ...sample, index: 2 }], options.label);
    }
  }
}
