// Thermal printer service via Web Bluetooth + ESC/POS
// Supports common 58mm/80mm Bluetooth thermal printers sold in Indonesia.
// Gracefully unavailable when Web Bluetooth is not supported (non-Chrome, iOS).

import { formatCurrency, getCurrencySymbol } from "@/lib/utils/formatting";
import {
  RECEIPT_INTL_LOCALE,
  RECEIPT_LABELS,
  RECEIPT_POWERED_BY_URL,
  SHIFT_REPORT_LABELS,
  resolveReceiptLocale,
  type ReceiptLocale,
} from "@/lib/receipts/receipt-labels";
import type { ShiftReportData } from "@/lib/finance/shift-report";

export interface ReceiptData {
  storeName: string;
  /** ISO 4217 code the order was actually charged in. Defaults to "IDR" for
   * callers built before this field existed. */
  currency?: string;
  /** Language for the fixed receipt vocabulary (labels, default footer).
   * Defaults to "id" for callers built before this field existed. */
  locale?: ReceiptLocale;
  // Branding block — all optional so a store with no storefront/receipt
  // settings configured yet still prints a valid (just plainer) receipt.
  tagline?: string;
  address?: string;
  email?: string;
  phone?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  facebookHandle?: string;
  footerMessage?: string;
  orderNumber: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    optionNames?: string[];
    notes?: string;
  }>;
  subtotal: number;
  tax?: number;
  taxLabel?: string;
  serviceCharge?: number;
  serviceChargeLabel?: string;
  discountAmount?: number;
  discountReason?: string;
  total: number;
  paymentMethod: string;
  amountTendered?: number;
  change?: number;
  /**
   * "bill" is the provisional pre-payment print ("Print Bill"): it has no
   * payment lines and says it is not a receipt. Defaults to "receipt".
   */
  documentType?: "receipt" | "bill";
  /**
   * Per-tender breakdown for a bill settled with two or more tenders. When
   * present with more than one entry it replaces the single paymentMethod /
   * amountTendered / change lines. `method` is the same string paymentMethod
   * would carry (an enum value, or the typed label for OTHER).
   */
  payments?: Array<{
    method: string;
    amount: number;
    amountTendered?: number;
    change?: number;
  }>;
  cashierName?: string;
  tableLabel?: string;
  notes?: string;
  width?: 32 | 48; // 32 cols = 58mm, 48 cols = 80mm
}

// Common Bluetooth service/characteristic UUIDs for ESC/POS printers
const PRINTER_PROFILES = [
  // Most common cheap BT printers (Aliexpress, Shopee)
  {
    service: 0x18f0,
    characteristic: 0x2af1,
  },
  // Alternative profile
  {
    service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    characteristic: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  },
];

let activeDevice: BluetoothDevice | null = null;
let activeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectPrinter(onDisconnected?: () => void): Promise<boolean> {
  if (!isBluetoothSupported()) return false;

  try {
    const optionalServices = PRINTER_PROFILES.map((p) => p.service);
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PRINTER_PROFILES[0].service] }],
      optionalServices,
    });

    const server = await device.gatt?.connect();
    if (!server) return false;

    // Try each profile until one works
    for (const profile of PRINTER_PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.service);
        const characteristic = await service.getCharacteristic(profile.characteristic);
        activeDevice = device;
        activeCharacteristic = characteristic;

        device.addEventListener("gattserverdisconnected", () => {
          activeDevice = null;
          activeCharacteristic = null;
          onDisconnected?.();
        });

        return true;
      } catch {
        // Try next profile
      }
    }

    return false;
  } catch (err: any) {
    // User cancelled device picker or no device found
    if (err?.name !== "NotFoundError" && err?.name !== "NotAllowedError") {
      console.error("[Printer] connect error:", err);
    }
    return false;
  }
}

export function disconnectPrinter() {
  activeDevice?.gatt?.disconnect();
  activeDevice = null;
  activeCharacteristic = null;
}

export function isPrinterConnected(): boolean {
  return !!activeDevice?.gatt?.connected && !!activeCharacteristic;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// `writeValueWithoutResponse` is fire-and-forget at the BLE layer: it
// returns as soon as the browser hands the bytes to the OS's Bluetooth
// stack, not once the printer has actually consumed them — there is no ACK,
// no NACK, nothing that surfaces as a JS error if the peripheral drops data.
// Cheap ESC/POS printers (the common case here) have a small input buffer
// (often well under 1KB) and a real-world print throughput far slower than
// BLE's transfer rate. Firing large writes back-to-back with no pause
// reliably outruns both — the buffer overflows mid-receipt and everything
// past that point is silently discarded, which is what produced the
// "header prints, then quantity/subtotal/total/footer all missing" symptom.
//
// There's no portable way to ask the OS/printer what its actual buffer size
// or negotiated ATT MTU is from Web Bluetooth, so this can't be tuned to a
// value proven correct for every device — 64 bytes with a 30ms gap is a
// deliberately conservative choice (well under any realistic MTU, and slow
// enough that even a slow firmware's buffer keeps draining faster than it
// fills). If a specific printer still drops content, raise
// PRINT_CHUNK_DELAY_MS (or lower PRINT_CHUNK_BYTES further) for that model —
// there's no fixed value that's provably safe for every printer on the
// market, only more conservative vs. less.
const PRINT_CHUNK_BYTES = 64;
const PRINT_CHUNK_DELAY_MS = 30;
// Extra pause after the last content byte and before the partial-cut
// command, separate from the inter-chunk delay above: printing is
// mechanical (print head + paper feed), not instant, so the printer can
// still be physically rendering the last line or two of text even after
// its input buffer has fully drained. Cutting immediately after the last
// write can guillotine paper that hasn't finished printing yet — a
// different failure mode than dropped data, but the same visible result
// (a receipt that looks cropped).
const PRINT_SETTLE_DELAY_MS = 300;

async function writeChunks(data: Uint8Array): Promise<void> {
  if (!activeCharacteristic) throw new Error("Printer not connected");
  for (let i = 0; i < data.length; i += PRINT_CHUNK_BYTES) {
    await activeCharacteristic.writeValueWithoutResponse(data.slice(i, i + PRINT_CHUNK_BYTES));
    await sleep(PRINT_CHUNK_DELAY_MS);
  }
}

function formatCols(left: string, right: string, cols: number): string {
  const gap = cols - left.length - right.length;
  return left + " ".repeat(Math.max(1, gap)) + right;
}

const ASCII_ONLY = /^[\x00-\x7f]*$/;

// CP437 (the printer's codepage) only round-trips ASCII through this
// byte-per-char encoding — see `text()` below. `Intl`'s localized currency
// symbol is often non-ASCII (€, £, ¥, ₫, ...) or is joined to the amount by
// a non-breaking space, so it's normalized then swapped for the plain ISO
// code (always ASCII) whenever the symbol form wouldn't print cleanly.
function formatMoney(amount: number, currency: string, locale: ReceiptLocale): string {
  const formatted = formatCurrency(amount, currency, RECEIPT_INTL_LOCALE[locale]).replace(
    /\u00a0/g,
    " "
  );
  if (ASCII_ONLY.test(formatted)) return formatted;
  const symbol = getCurrencySymbol(currency);
  return formatted.replace(symbol, currency);
}

// Strips accents so localized labels/free text stay ASCII-safe for the
// printer's codepage; any character that survives non-ASCII (emoji,
// degree sign, currency glyphs) becomes "?" rather than silently
// mis-rendering as an unrelated CP437 glyph.
function toPrinterAscii(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "?");
}

// Word-wraps a single line into printer-column-width lines instead of
// cutting mid-word. A single word longer than `cols` is hard-broken (nowhere
// left to wrap to) but only as a last resort.
function wrapLine(text: string, cols: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > cols) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += cols) {
        lines.push(word.slice(i, i + cols));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > cols) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Wraps every free-text field on the receipt (store name, address, item
// names, notes, footer message) so nothing gets silently dropped the way the
// old `.substring(0, N)` truncation did. Explicit `\n` breaks (e.g. a
// merchant's custom multi-line footer message) are preserved as hard line
// breaks rather than being reflowed with the rest of the text.
export function wrapText(text: string, cols: number): string[] {
  if (!text) return [];
  return text.split("\n").flatMap((paragraph) => wrapLine(paragraph, cols));
}

/**
 * `Label    : value`, wrapped rather than overflowed.
 *
 * The padded-label form is 11 characters before the value even starts, so on
 * 58mm paper (32 cols) an ordinary cashier name or table label runs off the
 * edge — and the printer then wraps it wherever it likes, breaking the
 * column. Continuation lines are indented under the value so the block still
 * reads as one field. Returns lines (never a single string) so callers cannot
 * accidentally emit an over-wide one.
 */
function labelRow(label: string, value: string, cols: number): string[] {
  const prefix = `${label.padEnd(9)}: `;
  if (prefix.length + value.length <= cols) return [`${prefix}${value}`];
  const indent = " ".repeat(Math.min(prefix.length, Math.max(0, cols - 1)));
  const wrapped = wrapText(value, Math.max(1, cols - indent.length));
  return [`${prefix}${wrapped[0] ?? ""}`, ...wrapped.slice(1).map((l) => `${indent}${l}`)];
}

// ESC/POS command bytes
const ESC = 0x1b;
const LF = 0x0a;

/**
 * Byte-emitting primitives shared by the receipt and shift-report builders,
 * so both speak the same ESC/POS dialect (and both get `toPrinterAscii`'s
 * codepage safety) instead of each hand-rolling its own escape sequences.
 */
function createEscPosWriter() {
  const commands: number[] = [];

  const push = (...bytes: number[]) => commands.push(...bytes);
  // Only ASCII (0-127) round-trips correctly through this byte-per-char
  // encoding — a JS string literal like "♥" or "•" does NOT map to the
  // printer's CP437 codepage this way, it'll print as garbage.
  // `toPrinterAscii` strips/replaces anything that wouldn't survive.
  const text = (str: string) => {
    for (const ch of toPrinterAscii(str)) commands.push(ch.charCodeAt(0) & 0xff);
  };
  const line = (str: string) => {
    text(str);
    push(LF);
  };
  const lines = (strs: string[]) => {
    for (const s of strs) line(s);
  };
  const blank = (n = 1) => {
    for (let i = 0; i < n; i++) push(LF);
  };
  const bold = (on: boolean) => push(ESC, 0x45, on ? 0x01 : 0x00);
  const center = () => push(ESC, 0x61, 0x01);
  const left = () => push(ESC, 0x61, 0x00);
  const doubleSize = (on: boolean) => push(ESC, 0x21, on ? 0x30 : 0x00);
  const init = () => push(ESC, 0x40);
  const bytes = () => new Uint8Array(commands);

  return { push, text, line, lines, blank, bold, center, left, doubleSize, init, bytes };
}

type EscPosWriter = ReturnType<typeof createEscPosWriter>;

/**
 * `label` left, `value` right-aligned to the paper width — the ONLY safe way
 * to emit a two-column line.
 *
 * `formatCols` forces a minimum one-space gap, so it silently overflows the
 * paper whenever label + value already fills the width. On 58mm (32 cols) that
 * happens with entirely ordinary content: a discount reason, a long tender
 * label, or "Makan di Tempat (46)" next to a 7-figure rupiah total (33 chars).
 * An overflowing line wraps at the printer's own discretion, which is what
 * produces a value orphaned on its own line mid-column. Instead, detect the
 * case and lay it out deliberately: label wrapped on its own line(s), value
 * right-aligned underneath.
 *
 * Shared by the receipt and the shift report so neither can regrow its own
 * unguarded `formatCols` call — that is exactly how this bug class came back.
 */
function createColumnRow(w: EscPosWriter, cols: number) {
  return (label: string, value: string) => {
    if (label.length + value.length < cols) {
      w.line(formatCols(label, value, cols));
      return;
    }
    // Leading whitespace IS the hierarchy on a receipt — "  2x Rp 1.250.000"
    // under its item name, "  TUNAI" under its tender. wrapText splits on
    // /\s+/ and would drop it, flattening a wrapped line into the level above
    // and making a sub-line read as a new item. Re-applied to every wrapped
    // line, with the indent bounded so it can never eat the whole width.
    const indent = label.slice(0, label.length - label.trimStart().length);
    const safeIndent = indent.slice(0, Math.max(0, cols - 1));
    w.lines(
      wrapText(label.trimStart(), Math.max(1, cols - safeIndent.length)).map(
        (l) => `${safeIndent}${l}`
      )
    );
    w.line(value.length >= cols ? value : value.padStart(cols));
  };
}

export function buildEscPos(receipt: ReceiptData): Uint8Array {
  const cols = receipt.width ?? 32;
  const divider = "-".repeat(cols);
  const currency = receipt.currency ?? "IDR";
  const locale = resolveReceiptLocale(receipt.locale);
  const labels = RECEIPT_LABELS[locale];
  const money = (amount: number) => formatMoney(amount, currency, locale);

  const w = createEscPosWriter();
  const { line, lines, blank, bold, center, left, doubleSize } = w;
  // Every two-column line goes through this, never bare formatCols — see
  // createColumnRow for why (32-col paper overflows on ordinary content).
  const row = createColumnRow(w, cols);
  // A "bill" is the provisional pre-payment print: same items, charges and
  // total, but no payment lines (nothing has been paid yet) and a footer that
  // says so, so it can never be mistaken for proof of payment.
  const isBill = receipt.documentType === "bill";

  // Initialize printer
  w.init();

  // ---- Header: store name (bold double-size), tagline ----
  center();
  doubleSize(true);
  // Double-width glyphs take 2 cell-widths each, so the usable line length
  // here is half of `cols` — this is the actual root cause of the old
  // "TAHOMA CAFE & EA" truncation bug (it hardcoded 16 = 32/2 and never
  // adapted when `cols` changed). Wrapping instead of truncating means a
  // long name spans multiple bold/double-size lines instead of losing text.
  lines(wrapText(receipt.storeName, Math.max(1, Math.floor(cols / 2))));
  doubleSize(false);

  if (receipt.tagline) {
    lines(wrapText(receipt.tagline, cols));
  }

  // The document's own title, printed only for a bill — a receipt has never
  // carried one and must stay byte-identical.
  if (isBill) {
    bold(true);
    lines(wrapText(labels.billTitle, cols));
    bold(false);
  }

  // ---- Address / contact block ----
  const contactLine = [receipt.email, receipt.phone].filter(Boolean).join("  ");
  const handleLine = receipt.instagramHandle ? `@${receipt.instagramHandle}` : "";
  const hasContactBlock = !!(receipt.address || contactLine || handleLine);
  if (hasContactBlock) {
    line(divider);
    if (receipt.address) lines(wrapText(receipt.address, cols));
    if (contactLine) lines(wrapText(contactLine, cols));
    if (handleLine) lines(wrapText(handleLine, cols));
  }

  // ---- Bill info block ----
  line(divider);
  left();
  lines(labelRow(labels.billNo, receipt.orderNumber, cols));
  lines(labelRow(labels.date, receipt.date, cols));
  if (receipt.cashierName) lines(labelRow(labels.cashier, receipt.cashierName, cols));
  if (receipt.tableLabel) lines(labelRow(labels.table, receipt.tableLabel, cols));

  // ---- Items ----
  line(divider);
  bold(true);
  row(labels.item, labels.total);
  bold(false);
  for (const item of receipt.items) {
    lines(wrapText(item.name, cols));
    row(`  ${item.quantity}x ${money(item.unitPrice)}`, money(item.total));
    if (item.optionNames && item.optionNames.length > 0) {
      lines(wrapText(`  ${item.optionNames.join(", ")}`, cols));
    }
    if (item.notes) {
      lines(wrapText(`  * ${item.notes}`, cols));
    }
  }

  // ---- Totals ----
  line(divider);
  row(labels.subtotal, money(receipt.subtotal));
  if (receipt.tax) {
    row(receipt.taxLabel || labels.tax, money(receipt.tax));
  }
  if (receipt.serviceCharge) {
    row(receipt.serviceChargeLabel || labels.service, money(receipt.serviceCharge));
  }
  if (receipt.discountAmount) {
    row(
      receipt.discountReason ? `${labels.discount} (${receipt.discountReason})` : labels.discount,
      `-${money(receipt.discountAmount)}`
    );
  }

  line(divider);
  bold(true);
  row(labels.total, money(receipt.total));
  bold(false);

  // ---- Payment ----
  // Omitted entirely on a bill: nothing has been paid yet, and printing a
  // payment block on a provisional print is how a bill gets mistaken for a
  // receipt.
  if (!isBill) {
    line(divider);
    const tenders = receipt.payments ?? [];
    if (tenders.length > 1) {
      // A bill settled with several tenders: one line per tender, with the
      // cash ones carrying their own tendered/change underneath. The single
      // paymentMethod line below cannot describe this — Order.paymentMethod
      // is the literal string "SPLIT" for these.
      for (const tender of tenders) {
        row(tender.method, money(tender.amount));
        if (tender.amountTendered !== undefined) {
          row(`  ${labels.cash}`, money(tender.amountTendered));
          if (tender.change !== undefined && tender.change >= 0) {
            row(`  ${labels.change}`, money(tender.change));
          }
        }
      }
    } else if (receipt.paymentMethod === "CASH" && receipt.amountTendered) {
      row(labels.cash, money(receipt.amountTendered));
      if (receipt.change !== undefined && receipt.change >= 0) {
        row(labels.change, money(receipt.change));
      }
    } else {
      row(`${labels.paidVia} (${receipt.paymentMethod})`, labels.paid);
    }
  }

  if (receipt.notes) {
    line(divider);
    lines(wrapText(`${labels.notes}: ${receipt.notes}`, cols));
  }

  // ---- Footer ----
  line(divider);
  center();
  // A bill says what it is instead of thanking the customer for a payment
  // they haven't made — the merchant's own footer message is a receipt
  // sign-off and would read as one here.
  lines(wrapText(isBill ? labels.billNotice : receipt.footerMessage || labels.defaultFooter, cols));

  const socialLine = [
    receipt.instagramHandle ? `IG @${receipt.instagramHandle}` : null,
    receipt.tiktokHandle ? `TikTok @${receipt.tiktokHandle}` : null,
    receipt.facebookHandle ? `FB ${receipt.facebookHandle}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  if (socialLine) {
    line(divider);
    lines(wrapText(socialLine, cols));
  }

  line(divider);
  // 40 characters at its shortest — it does not fit 58mm paper on one line,
  // so it wraps here the same way the shift report's does.
  lines(wrapText(`${RECEIPT_POWERED_BY_URL} | ${labels.poweredByTitle}`, cols));

  // Extra feed + an explicit tear-guide line. Cheap cutter-less BT printers
  // (the common case for small IDN merchants) rely on the customer tearing
  // by hand — a thin gap here is what caused consecutive orders to visually
  // run into each other. The cut command itself is deliberately NOT
  // included here — see CUT_COMMAND and printReceipt() below.
  blank(2);
  line(divider);
  blank(6);

  return w.bytes();
}

export interface ShiftReportPrintInput {
  report: ShiftReportData;
  storeName: string;
  /** ISO 4217 the amounts are literally denominated in — no conversion. */
  currency: string;
  locale?: ReceiptLocale | string | null;
  width?: 32 | 48;
  /** Cashier name when the report is scoped to one till session. */
  shiftLabel?: string | null;
  generatedAt?: Date;
}

/**
 * The shift / daily report ("Z-report") as ESC/POS bytes — the paper
 * equivalent of the browser report page, rendered from the exact same
 * ShiftReportData so the two can't disagree.
 *
 * Every string goes through the writer's `toPrinterAscii`, and every money
 * figure through `formatMoney`, which swaps a non-ASCII currency symbol for
 * the plain ISO code — CP437 only round-trips ASCII.
 */
export function buildShiftReportEscPos(input: ShiftReportPrintInput): Uint8Array {
  const cols = input.width ?? 32;
  const divider = "-".repeat(cols);
  const thickDivider = "=".repeat(cols);
  const locale = resolveReceiptLocale(
    typeof input.locale === "string" ? input.locale : undefined
  );
  const labels = SHIFT_REPORT_LABELS[locale];
  const intlLocale = RECEIPT_INTL_LOCALE[locale];
  const money = (amount: number) => formatMoney(amount, input.currency, locale);
  const dateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value)
    );

  const { report } = input;
  const w = createEscPosWriter();
  const { line, lines, blank, bold, center, left, doubleSize } = w;

  // Overflow-safe two-column line — shared with the receipt builder, see
  // createColumnRow.
  const row = createColumnRow(w, cols);
  const heading = (title: string) => {
    blank();
    bold(true);
    lines(wrapText(title, cols));
    bold(false);
    line(divider);
  };

  w.init();

  // ---- Header ------------------------------------------------------------
  center();
  doubleSize(true);
  lines(wrapText(input.storeName, Math.max(1, Math.floor(cols / 2))));
  doubleSize(false);
  bold(true);
  // A session-scoped run is a shift report; an arbitrary date window is a
  // daily report. Same layout, honest title. Keyed on the drawer's *scope*,
  // not its mere presence — the store-wide day rollup now carries a cash
  // block too, and titling that "SHIFT REPORT" would be a lie.
  lines(
    wrapText(report.cashDrawer?.scope === "SHIFT" ? labels.shiftReportTitle : labels.title, cols)
  );
  bold(false);
  left();
  line(divider);

  // ---- Window / cashier --------------------------------------------------
  // An open till's window runs to "now" and keeps moving — say so on the
  // paper, otherwise a mid-shift printout reads as a final Z-report.
  const windowTo = report.window.isOpen
    ? `${dateTime(report.window.to)} (${labels.stillOpen})`
    : dateTime(report.window.to);
  lines(wrapText(`${labels.period}: ${dateTime(report.window.from)}`, cols));
  lines(wrapText(`${" ".repeat(labels.period.length + 2)}${windowTo}`, cols));
  if (input.shiftLabel) lines(wrapText(`${labels.cashier}: ${input.shiftLabel}`, cols));
  line(divider);

  // ---- Sales -------------------------------------------------------------
  row(labels.grossSales, money(report.sales.grossSales));
  if (report.sales.discount) row(labels.discount, `-${money(report.sales.discount)}`);
  if (report.sales.serviceCharge) row(labels.serviceCharge, money(report.sales.serviceCharge));
  if (report.sales.tax) row(labels.tax, money(report.sales.tax));
  // The reference report's "Pembulatan" (rounding) line has no equivalent
  // field here; these two are Epidom's actual non-item charges.
  if (report.sales.processingFee) row(labels.processingFee, money(report.sales.processingFee));
  if (report.sales.delivery) row(labels.delivery, money(report.sales.delivery));
  if (report.sales.refund) row(labels.refund, `-${money(report.sales.refund)}`);
  line(divider);
  bold(true);
  row(labels.total, money(report.sales.total));
  bold(false);

  if (report.invoices.count === 0) {
    blank();
    center();
    lines(wrapText(labels.noData, cols));
    left();
  }

  // ---- Invoices ----------------------------------------------------------
  heading(labels.invoicesHeading);
  row(labels.invoiceCount, String(report.invoices.count));
  row(labels.averagePerInvoice, money(report.invoices.averagePerInvoice));

  // ---- Cancellations -----------------------------------------------------
  heading(labels.cancellationsHeading);
  row(labels.invoiceCount, String(report.cancellations.invoiceCount));
  row(labels.cancelledItems, String(report.cancellations.itemCount));
  row(labels.total, money(report.cancellations.total));

  // ---- By sale type ------------------------------------------------------
  if (report.byOrderType.length > 0) {
    heading(labels.byOrderTypeHeading);
    for (const bucket of report.byOrderType) {
      const typeLabel =
        bucket.orderType === "DINE_IN"
          ? labels.dineIn
          : bucket.orderType === "TAKEAWAY"
            ? labels.takeaway
            : labels.deliveryType;
      row(`${typeLabel} (${bucket.orderCount})`, money(bucket.total));
    }
    line(divider);
    bold(true);
    row(labels.total, money(report.sales.total));
    bold(false);
  }

  // ---- By guest (omitted entirely when no pax was ever recorded) ----------
  if (report.byGuest) {
    heading(labels.byGuestHeading);
    row(labels.totalGuests, String(report.byGuest.totalGuests));
    row(labels.invoicesWithGuests, String(report.byGuest.invoicesWithGuestCount));
    row(labels.averageGuestsPerDay, report.byGuest.averageGuestsPerDay.toFixed(2));
    row(labels.averageSalesPerGuest, money(report.byGuest.averageSalesPerGuest));
  }

  // ---- By payment method -------------------------------------------------
  if (report.byPaymentMethod.length > 0) {
    heading(labels.byPaymentHeading);
    for (const method of report.byPaymentMethod) {
      row(method.paymentMethod, money(method.revenue));
    }
    line(divider);
    bold(true);
    row(labels.total, money(report.sales.total));
    bold(false);
  }

  // ---- By product, grouped by category -----------------------------------
  if (report.byProduct.categories.length > 0) {
    heading(labels.byProductHeading);
    for (const category of report.byProduct.categories) {
      lines(wrapText(category.categoryName, cols));
      for (const item of category.lines) {
        // Quantity prefix on its own column, name wrapped under it — long
        // item names must wrap rather than be truncated (the bug class
        // wrapText() exists to prevent).
        const prefix = `x${item.quantity} `;
        const nameLines = wrapText(item.name, Math.max(1, cols - prefix.length - 12));
        row(`${prefix}${nameLines[0] ?? ""}`, money(item.gross));
        for (const extra of nameLines.slice(1)) {
          line(`${" ".repeat(prefix.length)}${extra}`);
        }
      }
      row(`${labels.total} (${category.totalQuantity})`, money(category.totalGross));
      blank();
    }
    line(divider);
    bold(true);
    row(`${labels.total} (${report.byProduct.totalQuantity})`, money(report.byProduct.totalGross));
    bold(false);
  }

  // ---- Cash drawer -------------------------------------------------------
  // Every movement between the opening float and the expected total, so the
  // count can be audited against the paper instead of taken on trust. The
  // browser report (shift-report-print-view.tsx) prints the identical block.
  if (report.cashDrawer) {
    const drawer = report.cashDrawer;
    // A STORE_DAY block sums every till in the window plus the cash that was
    // linked to none of them — a different, larger figure than one cashier's
    // accountability, so the heading refuses to let the two be confused.
    heading(
      drawer.scope === "STORE_DAY"
        ? `${labels.cashDrawerHeading} (${labels.allTills})`
        : labels.cashDrawerHeading
    );
    row(labels.openingCash, money(drawer.openingCash));
    // Zero categories are skipped, same as the sales block above — a store
    // that takes no tips shouldn't spend a line of paper on "Tip 0". The
    // float and the expected total always print: their absence is itself
    // information the person counting the drawer needs.
    if (drawer.cashSales) row(labels.cashSales, money(drawer.cashSales));
    if (drawer.cashRefunds) row(labels.cashRefunds, `-${money(drawer.cashRefunds)}`);
    if (drawer.tips) row(labels.tips, money(drawer.tips));
    if (drawer.pettyIn) row(labels.cashIn, money(drawer.pettyIn));
    if (drawer.pettyOut) row(labels.paidOut, `-${money(drawer.pettyOut)}`);
    if (drawer.drops) row(labels.safeDrop, `-${money(drawer.drops)}`);
    if (drawer.tipPayouts) row(labels.tipsOut, `-${money(drawer.tipPayouts)}`);
    // Cash sales no till was linked to, printed unsigned and below the rule
    // because it is deliberately NOT in the expected total: nothing in the
    // schema says whether this money reached a drawer (counter cash) or a
    // courier (delivery/aggregator). Visible, not counted.
    if (drawer.unlinkedCashSales) {
      row(labels.offTillCash, money(drawer.unlinkedCashSales));
    }
    line(divider);
    bold(true);
    // An open till keeps taking cash, so the expected figure is still moving
    // — say so, otherwise a mid-shift printout reads as a signed-off count.
    row(
      drawer.hasOpenTill ? `${labels.expectedCash} (${labels.provisional})` : labels.expectedCash,
      money(drawer.expectedCash)
    );
    bold(false);
    if (drawer.closingCash != null) {
      row(labels.closingCash, money(drawer.closingCash));
    }
    if (drawer.cashDifference != null) {
      bold(true);
      row(labels.difference, money(drawer.cashDifference));
      bold(false);
    }
  }

  // ---- Footer ------------------------------------------------------------
  line(thickDivider);
  center();
  lines(wrapText(`${labels.printedAt} ${dateTime(input.generatedAt ?? new Date())}`, cols));
  lines(wrapText(`${RECEIPT_POWERED_BY_URL} | ${RECEIPT_LABELS[locale].poweredByTitle}`, cols));

  // Same tear-guide + feed as the receipt path — cheap cutter-less printers
  // rely on the customer tearing by hand.
  blank(2);
  line(divider);
  blank(6);

  return w.bytes();
}

// Sent as its own write, after PRINT_SETTLE_DELAY_MS, instead of being part
// of buildEscPos()'s output — see printReceipt().
const CUT_COMMAND = new Uint8Array([0x1d, 0x56, 0x41, 0x03]); // GS V A 3 — partial cut

export async function printReceipt(receipt: ReceiptData): Promise<void> {
  if (!isPrinterConnected()) throw new Error("Printer tidak terhubung");
  const data = buildEscPos(receipt);
  await writeChunks(data);
  // Give the printer time to physically finish rendering the last line(s)
  // before it receives the cut command — see PRINT_SETTLE_DELAY_MS above.
  await sleep(PRINT_SETTLE_DELAY_MS);
  await writeChunks(CUT_COMMAND);
}

/**
 * Prints the shift / daily report. Same chunked-write + settle + cut
 * discipline as printReceipt() — a report is materially longer than a
 * receipt, so the small-input-buffer overflow this guards against is *more*
 * likely here, not less.
 */
export async function printShiftReport(input: ShiftReportPrintInput): Promise<void> {
  if (!isPrinterConnected()) throw new Error("Printer tidak terhubung");
  await writeChunks(buildShiftReportEscPos(input));
  await sleep(PRINT_SETTLE_DELAY_MS);
  await writeChunks(CUT_COMMAND);
}
