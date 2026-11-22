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
import { isRasterPrintingAvailable } from "@/lib/pwa/text-raster";
import { printReceipt, type ReceiptData } from "@/lib/pwa/thermal-printer";
import {
  RECEIPT_INTL_LOCALE,
  TICKET_LABELS,
  printerLocale,
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
  /** This printer's "print non-Latin text as an image" switch. */
  rasterNonAscii?: boolean;
}

/**
 * What the image test adds to the page: one Thai line and one accented line, so
 * the owner can see on paper whether this device has the fonts and this printer
 * takes the image — the two things that cannot be checked from the screen.
 * Printed content, not UI text, hence fixed rather than translated.
 */
export const RASTER_TEST_LINES = [
  "\u0e17\u0e14\u0e2a\u0e2d\u0e1a\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22: \u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35 \u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23",
  "Accents: caf\u00e9 cr\u00e8me, d\u00e9j\u00e0 vu, se\u00f1or",
] as const;

/**
 * The switch is on AND this device can draw. Decided here, once, because the
 * sample's own content changes with it: Thai sample text sent down the text
 * path would print as a row of question marks.
 */
function rasterTestActive(options: Pick<TestPrintOptions, "rasterNonAscii">): boolean {
  return options.rasterNonAscii === true && isRasterPrintingAvailable();
}

function buildSampleReceipt(
  { locale, currency, width }: TestPrintOptions,
  raster: boolean
): ReceiptData {
  const labels = TICKET_LABELS[raster ? locale : printerLocale(locale)];
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
    ...(raster ? { rasterNonAscii: true, notes: RASTER_TEST_LINES.join("\n") } : {}),
  };
}

export async function printTestPage(role: PrinterRole, options: TestPrintOptions): Promise<void> {
  const raster = rasterTestActive(options);
  switch (role) {
    case "MAIN":
      return printReceipt(buildSampleReceipt(options, raster));
    case "KITCHEN":
    case "BAR":
      return printOrderTicket(
        role,
        buildSampleOrderTicket({
          department: role,
          locale: options.locale,
          width: options.width,
          ...(raster ? { rasterNonAscii: true, notes: RASTER_TEST_LINES.join("\n") } : {}),
        })
      );
    case "LABEL": {
      // Two units of one line, so the "1/2" counter and a form feed between labels are exercised.
      const base = buildSampleItemLabel();
      // TSPL stickers stay text (see LabelPrinterConfig.rasterNonAscii), so the
      // Thai sample only goes on an ESC/POS sticker.
      const imageTest = raster && options.label.language !== "TSPL";
      const sample = imageTest
        ? { ...base, itemName: RASTER_TEST_LINES[0], notes: RASTER_TEST_LINES[1] }
        : base;
      return printItemLabels([sample, { ...sample, index: 2 }], {
        ...options.label,
        ...(imageTest ? { rasterNonAscii: true } : {}),
      });
    }
  }
}
