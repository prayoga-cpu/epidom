// Thermal printer service via Web Bluetooth + ESC/POS
// Supports common 58mm/80mm Bluetooth thermal printers sold in Indonesia.
// Gracefully unavailable when Web Bluetooth is not supported (non-Chrome, iOS).

import { formatCurrency, getCurrencySymbol } from "@/lib/utils/formatting";
import {
  RECEIPT_INTL_LOCALE,
  RECEIPT_LABELS,
  RECEIPT_POWERED_BY_URL,
  resolveReceiptLocale,
  type ReceiptLocale,
} from "@/lib/receipts/receipt-labels";

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

function labelRow(label: string, value: string): string {
  return `${label.padEnd(9)}: ${value}`;
}

export function buildEscPos(receipt: ReceiptData): Uint8Array {
  const cols = receipt.width ?? 32;
  const divider = "-".repeat(cols);
  const currency = receipt.currency ?? "IDR";
  const locale = resolveReceiptLocale(receipt.locale);
  const labels = RECEIPT_LABELS[locale];
  const money = (amount: number) => formatMoney(amount, currency, locale);

  // ESC/POS command bytes
  const ESC = 0x1b;
  const LF = 0x0a;

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

  // Initialize printer
  push(ESC, 0x40);

  // ---- Header: store name (bold double-size), tagline ----
  center();
  push(ESC, 0x21, 0x30);
  // Double-width glyphs take 2 cell-widths each, so the usable line length
  // here is half of `cols` — this is the actual root cause of the old
  // "TAHOMA CAFE & EA" truncation bug (it hardcoded 16 = 32/2 and never
  // adapted when `cols` changed). Wrapping instead of truncating means a
  // long name spans multiple bold/double-size lines instead of losing text.
  lines(wrapText(receipt.storeName, Math.max(1, Math.floor(cols / 2))));
  push(ESC, 0x21, 0x00);

  if (receipt.tagline) {
    lines(wrapText(receipt.tagline, cols));
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
  line(labelRow(labels.billNo, receipt.orderNumber));
  line(labelRow(labels.date, receipt.date));
  if (receipt.cashierName) line(labelRow(labels.cashier, receipt.cashierName));
  if (receipt.tableLabel) line(labelRow(labels.table, receipt.tableLabel));

  // ---- Items ----
  line(divider);
  bold(true);
  line(formatCols(labels.item, `${labels.qty}   ${labels.total}`, cols));
  bold(false);
  for (const item of receipt.items) {
    lines(wrapText(item.name, cols));
    line(
      formatCols(`  ${item.quantity}x ${money(item.unitPrice)}`, money(item.total), cols)
    );
    if (item.optionNames && item.optionNames.length > 0) {
      lines(wrapText(`  ${item.optionNames.join(", ")}`, cols));
    }
    if (item.notes) {
      lines(wrapText(`  * ${item.notes}`, cols));
    }
  }

  // ---- Totals ----
  line(divider);
  line(formatCols(labels.subtotal, money(receipt.subtotal), cols));
  if (receipt.tax) {
    line(formatCols(receipt.taxLabel || labels.tax, money(receipt.tax), cols));
  }
  if (receipt.serviceCharge) {
    line(
      formatCols(receipt.serviceChargeLabel || labels.service, money(receipt.serviceCharge), cols)
    );
  }
  if (receipt.discountAmount) {
    line(
      formatCols(
        receipt.discountReason ? `${labels.discount} (${receipt.discountReason})` : labels.discount,
        `-${money(receipt.discountAmount)}`,
        cols
      )
    );
  }

  line(divider);
  bold(true);
  line(formatCols(labels.total, money(receipt.total), cols));
  bold(false);

  // ---- Payment ----
  line(divider);
  if (receipt.paymentMethod === "CASH" && receipt.amountTendered) {
    line(formatCols(labels.cash, money(receipt.amountTendered), cols));
    if (receipt.change !== undefined && receipt.change >= 0) {
      line(formatCols(labels.change, money(receipt.change), cols));
    }
  } else {
    line(formatCols(`${labels.paidVia} (${receipt.paymentMethod})`, labels.paid, cols));
  }

  if (receipt.notes) {
    line(divider);
    lines(wrapText(`${labels.notes}: ${receipt.notes}`, cols));
  }

  // ---- Footer ----
  line(divider);
  center();
  lines(wrapText(receipt.footerMessage || labels.defaultFooter, cols));

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
  line(`${RECEIPT_POWERED_BY_URL} | ${labels.poweredByTitle}`);

  // Extra feed + an explicit tear-guide line. Cheap cutter-less BT printers
  // (the common case for small IDN merchants) rely on the customer tearing
  // by hand — a thin gap here is what caused consecutive orders to visually
  // run into each other. The cut command itself is deliberately NOT
  // included here — see CUT_COMMAND and printReceipt() below.
  blank(2);
  line(divider);
  blank(6);

  return new Uint8Array(commands);
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
