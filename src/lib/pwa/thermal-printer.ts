// Thermal printer service via Web Bluetooth + ESC/POS
// Supports common 58mm/80mm Bluetooth thermal printers sold in Indonesia.
// Gracefully unavailable when Web Bluetooth is not supported (non-Chrome, iOS).

export interface ReceiptData {
  storeName: string;
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

async function writeChunks(data: Uint8Array): Promise<void> {
  if (!activeCharacteristic) throw new Error("Printer not connected");
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    await activeCharacteristic.writeValueWithoutResponse(data.slice(i, i + CHUNK));
  }
}

function formatCols(left: string, right: string, cols: number): string {
  const gap = cols - left.length - right.length;
  return left + " ".repeat(Math.max(1, gap)) + right;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

  // ESC/POS command bytes
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  const commands: number[] = [];

  const push = (...bytes: number[]) => commands.push(...bytes);
  // Only ASCII (0-127) round-trips correctly through this byte-per-char
  // encoding — a JS string literal like "♥" or "•" does NOT map to the
  // printer's CP437 codepage this way, it'll print as garbage. Keep any
  // decorative characters ASCII-only unless explicitly mapped to a CP437
  // byte value.
  const text = (str: string) => {
    for (const ch of str) commands.push(ch.charCodeAt(0) & 0xff);
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
  line(labelRow("No. Bill", receipt.orderNumber));
  line(labelRow("Tanggal", receipt.date));
  if (receipt.cashierName) line(labelRow("Kasir", receipt.cashierName));
  if (receipt.tableLabel) line(labelRow("Meja", receipt.tableLabel));

  // ---- Items ----
  line(divider);
  bold(true);
  line(formatCols("ITEM", "QTY   TOTAL", cols));
  bold(false);
  for (const item of receipt.items) {
    lines(wrapText(item.name, cols));
    line(
      formatCols(
        `  ${item.quantity}x Rp${formatMoney(item.unitPrice)}`,
        `Rp${formatMoney(item.total)}`,
        cols
      )
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
  line(formatCols("SUBTOTAL", `Rp${formatMoney(receipt.subtotal)}`, cols));
  if (receipt.tax) {
    line(formatCols(receipt.taxLabel || "Pajak", `Rp${formatMoney(receipt.tax)}`, cols));
  }
  if (receipt.serviceCharge) {
    line(
      formatCols(
        receipt.serviceChargeLabel || "Service",
        `Rp${formatMoney(receipt.serviceCharge)}`,
        cols
      )
    );
  }
  if (receipt.discountAmount) {
    line(
      formatCols(
        receipt.discountReason ? `Diskon (${receipt.discountReason})` : "Diskon",
        `-Rp${formatMoney(receipt.discountAmount)}`,
        cols
      )
    );
  }

  line(divider);
  bold(true);
  line(formatCols("TOTAL", `Rp${formatMoney(receipt.total)}`, cols));
  bold(false);

  // ---- Payment ----
  line(divider);
  if (receipt.paymentMethod === "CASH" && receipt.amountTendered) {
    line(formatCols("TUNAI", `Rp${formatMoney(receipt.amountTendered)}`, cols));
    if (receipt.change !== undefined && receipt.change >= 0) {
      line(formatCols("KEMBALI", `Rp${formatMoney(receipt.change)}`, cols));
    }
  } else {
    line(formatCols(`Bayar (${receipt.paymentMethod})`, "LUNAS", cols));
  }

  if (receipt.notes) {
    line(divider);
    lines(wrapText("Catatan: " + receipt.notes, cols));
  }

  // ---- Footer ----
  line(divider);
  center();
  lines(wrapText(receipt.footerMessage || "Terima kasih!\nSilakan datang kembali", cols));

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
  line("epidom.app");

  // Extra feed + an explicit tear-guide line before the cut command. Cheap
  // cutter-less BT printers (the common case for small IDN merchants) rely
  // on the customer tearing by hand — a thin gap here is what caused
  // consecutive orders to visually run into each other.
  blank(2);
  line(divider);
  blank(6);
  push(GS, 0x56, 0x41, 0x03); // partial cut

  return new Uint8Array(commands);
}

export async function printReceipt(receipt: ReceiptData): Promise<void> {
  if (!isPrinterConnected()) throw new Error("Printer tidak terhubung");
  const data = buildEscPos(receipt);
  await writeChunks(data);
}
