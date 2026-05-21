// Thermal printer service via Web Bluetooth + ESC/POS
// Supports common 58mm/80mm Bluetooth thermal printers sold in Indonesia.
// Gracefully unavailable when Web Bluetooth is not supported (non-Chrome, iOS).

export interface ReceiptData {
  storeName: string;
  orderNumber: string;
  date: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
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

export async function connectPrinter(): Promise<boolean> {
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
    await activeCharacteristic.writeValueWithoutResponse(
      data.slice(i, i + CHUNK)
    );
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

function buildEscPos(receipt: ReceiptData): Uint8Array {
  const cols = receipt.width ?? 32;
  const divider = "-".repeat(cols);

  // ESC/POS command bytes
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  const commands: number[] = [];

  const push = (...bytes: number[]) => commands.push(...bytes);
  const text = (str: string) => {
    for (const ch of str) commands.push(ch.charCodeAt(0) & 0xff);
  };
  const line = (str: string) => {
    text(str);
    push(LF);
  };
  const blank = (n = 1) => {
    for (let i = 0; i < n; i++) push(LF);
  };

  // Initialize printer
  push(ESC, 0x40);

  // Center alignment
  push(ESC, 0x61, 0x01);

  // Bold + double-size store name
  push(ESC, 0x21, 0x30);
  line(receipt.storeName.substring(0, 16));
  push(ESC, 0x21, 0x00);

  // Order number
  push(ESC, 0x45, 0x01); // bold on
  line(receipt.orderNumber);
  push(ESC, 0x45, 0x00); // bold off

  line(receipt.date);
  if (receipt.cashierName) line(`Kasir: ${receipt.cashierName}`);
  if (receipt.tableLabel) line(`Meja: ${receipt.tableLabel}`);

  // Left alignment
  push(ESC, 0x61, 0x00);
  line(divider);

  // Items
  for (const item of receipt.items) {
    line(item.name.substring(0, cols));
    line(
      formatCols(
        `  ${item.quantity}x Rp${formatMoney(item.unitPrice)}`,
        `Rp${formatMoney(item.total)}`,
        cols
      )
    );
  }

  line(divider);

  // Totals
  if (receipt.subtotal !== receipt.total) {
    line(formatCols("Subtotal", `Rp${formatMoney(receipt.subtotal)}`, cols));
  }

  push(ESC, 0x45, 0x01);
  line(formatCols("TOTAL", `Rp${formatMoney(receipt.total)}`, cols));
  push(ESC, 0x45, 0x00);

  line(formatCols("Bayar (" + receipt.paymentMethod + ")", "", cols));
  if (receipt.amountTendered) {
    line(formatCols("  Diterima", `Rp${formatMoney(receipt.amountTendered)}`, cols));
  }
  if (receipt.change !== undefined && receipt.change >= 0) {
    line(formatCols("  Kembalian", `Rp${formatMoney(receipt.change)}`, cols));
  }

  if (receipt.notes) {
    line(divider);
    line("Catatan: " + receipt.notes.substring(0, cols - 9));
  }

  // Center footer
  push(ESC, 0x61, 0x01);
  line(divider);
  line("Terima kasih!");
  line("epidom.app");

  // Feed and cut
  blank(4);
  push(GS, 0x56, 0x41, 0x03); // partial cut

  return new Uint8Array(commands);
}

export async function printReceipt(receipt: ReceiptData): Promise<void> {
  if (!isPrinterConnected()) throw new Error("Printer tidak terhubung");
  const data = buildEscPos(receipt);
  await writeChunks(data);
}
