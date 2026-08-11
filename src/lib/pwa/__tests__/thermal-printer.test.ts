/**
 * Thermal Printer Receipt Builder Tests
 *
 * Regression coverage for the store-name truncation bug ("TAHOMA CAFE &
 * EATERY" printing as "TAHOMA CAFE & EA") and the tax/service-charge line
 * items that were silently dropped from the printed receipt.
 */
import { describe, it, expect } from "vitest";
import {
  wrapText,
  buildEscPos,
  buildShiftReportEscPos,
  type ReceiptData,
} from "../thermal-printer";
import type { ShiftReportData } from "@/lib/finance/shift-report";

function decode(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

const BASE_RECEIPT: ReceiptData = {
  storeName: "Epidom POS",
  orderNumber: "POS-20260808-0001",
  date: "08/08/2026 18:35",
  items: [{ name: "Salt Bread", quantity: 1, unitPrice: 25000, total: 25000 }],
  subtotal: 25000,
  total: 25000,
  paymentMethod: "CASH",
};

describe("wrapText", () => {
  it("wraps on word boundaries instead of cutting mid-word", () => {
    const lines = wrapText("TAHOMA CAFE & EATERY", 16);
    expect(lines.join(" ")).toBe("TAHOMA CAFE & EATERY");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(16);
  });

  it("hard-breaks a single word longer than the column width", () => {
    const lines = wrapText("Supercalifragilisticexpialidocious", 10);
    expect(lines.join("")).toBe("Supercalifragilisticexpialidocious");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
  });

  it("preserves explicit newlines as hard line breaks", () => {
    const lines = wrapText("Terima kasih!\nSilakan datang kembali", 32);
    expect(lines).toEqual(["Terima kasih!", "Silakan datang kembali"]);
  });

  it("returns an empty array for empty input", () => {
    expect(wrapText("", 32)).toEqual([]);
  });
});

describe("buildEscPos", () => {
  it("never truncates a long store name (regression: TAHOMA CAFE & EATERY bug)", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, storeName: "TAHOMA CAFE & EATERY", width: 32 })
    );
    expect(output).toContain("EATERY");
    expect(output).not.toContain("TAHOMA CAFE & EA\n");
  });

  it("does not truncate a long item name", () => {
    const longName = "Konsultasi model rambut, Potong rambut, Cuci rambut, Hair tonic";
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        items: [{ name: longName, quantity: 1, unitPrice: 74999, total: 74999 }],
        width: 32,
      })
    );
    expect(output).toContain("Hair tonic");
  });

  it("prints a tax line when tax is present, using the store's tax label", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, tax: 2500, taxLabel: "PB1 (10%)", width: 32 })
    );
    expect(output).toContain("PB1 (10%)");
  });

  it("omits the tax line when there is no tax", () => {
    const output = decode(buildEscPos({ ...BASE_RECEIPT, width: 32 }));
    expect(output).not.toContain("Pajak");
  });

  it("prints TUNAI/KEMBALI for cash payments with an amount tendered", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, paymentMethod: "CASH", amountTendered: 30000, change: 5000 })
    );
    expect(output).toContain("TUNAI");
    expect(output).toContain("KEMBALI");
  });

  it("prints a LUNAS marker instead of TUNAI/KEMBALI for non-cash payments", () => {
    const output = decode(buildEscPos({ ...BASE_RECEIPT, paymentMethod: "QRIS" }));
    expect(output).toContain("LUNAS");
    expect(output).not.toContain("TUNAI");
  });

  it("wraps the store name narrower on 58mm (32 cols) than 80mm (48 cols)", () => {
    const name = "TAHOMA CAFE & EATERY";
    const narrow = wrapText(name, Math.floor(32 / 2));
    const wide = wrapText(name, Math.floor(48 / 2));
    expect(narrow.length).toBeGreaterThanOrEqual(wide.length);
  });
});

const BASE_REPORT: ShiftReportData = {
  window: { from: "2026-08-09T03:00:00.000Z", to: "2026-08-09T15:00:00.000Z", isOpen: false },
  sales: {
    grossSales: 2298000,
    discount: 0,
    serviceCharge: 229800,
    tax: 0,
    processingFee: 0,
    delivery: 0,
    refund: 0,
    total: 2527800,
  },
  invoices: { count: 46, averagePerInvoice: 54952.17 },
  cancellations: { invoiceCount: 0, itemCount: 0, total: 0 },
  byOrderType: [{ orderType: "DINE_IN", orderCount: 46, total: 2527800 }],
  byGuest: null,
  byPaymentMethod: [
    { paymentMethod: "CASH", orderCount: 20, revenue: 787600, percentOfTotal: 31.2 },
  ],
  byProduct: {
    categories: [
      {
        categoryId: "cat-1",
        categoryName: "Pastry",
        lines: [{ name: "London Cake", quantity: 5, gross: 185000 }],
        totalQuantity: 5,
        totalGross: 185000,
      },
    ],
    totalQuantity: 5,
    totalGross: 185000,
  },
  cashDrawer: null,
};

const REPORT_INPUT = {
  report: BASE_REPORT,
  storeName: "Tahoma Cafe",
  currency: "IDR",
  locale: "id" as const,
  generatedAt: new Date("2026-08-09T16:56:00.000Z"),
};

describe("buildShiftReportEscPos", () => {
  it("emits only ASCII — CP437 round-trips nothing else", () => {
    const bytes = buildShiftReportEscPos({
      ...REPORT_INPUT,
      // Accented and non-Latin characters must be stripped/replaced, never
      // passed through as multi-byte sequences.
      storeName: "Café Crème Ñoño 東京",
      locale: "fr",
    });

    for (const byte of bytes) expect(byte).toBeLessThanOrEqual(0x7f);
  });

  it("prints every reference block that has data", () => {
    const output = decode(buildShiftReportEscPos(REPORT_INPUT));

    expect(output).toContain("Penjualan");
    expect(output).toContain("Biaya Layanan");
    expect(output).toContain("Jumlah Invoices");
    expect(output).toContain("Ringkasan Pembatalan");
    expect(output).toContain("Berdasarkan Tipe Penjualan");
    expect(output).toContain("Berdasarkan Pembayaran");
    expect(output).toContain("Berdasarkan Produk");
    expect(output).toContain("Pastry");
    expect(output).toContain("London Cake");
  });

  it("omits the guest block entirely when no pax was recorded", () => {
    const output = decode(buildShiftReportEscPos(REPORT_INPUT));
    expect(output).not.toContain("Berdasarkan Tamu");
  });

  it("prints the guest block when pax data exists", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: {
          ...BASE_REPORT,
          byGuest: {
            totalGuests: 46,
            invoicesWithGuestCount: 46,
            dayCount: 1,
            averageGuestsPerDay: 46,
            averageSalesPerGuest: 54952.17,
          },
        },
      })
    );

    expect(output).toContain("Berdasarkan Tamu");
    expect(output).toContain("Total Tamu");
  });

  it("titles a session-scoped run a shift report and adds the cash drawer", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        shiftLabel: "Budi",
        report: {
          ...BASE_REPORT,
          cashDrawer: {
            staffName: "Budi",
            openedAt: "2026-08-09T03:00:00.000Z",
            closedAt: "2026-08-09T15:00:00.000Z",
            openingCash: 200000,
            closingCash: 987600,
            expectedCash: 987600,
            cashDifference: 0,
          },
        },
      })
    );

    expect(output).toContain("LAPORAN SHIFT");
    expect(output).toContain("Kas Laci");
    expect(output).toContain("Kas Awal");
    expect(output).toContain("Budi");
  });

  it("titles an unscoped run a daily report", () => {
    const output = decode(buildShiftReportEscPos(REPORT_INPUT));
    expect(output).toContain("LAPORAN HARIAN");
    expect(output).not.toContain("Kas Laci");
  });

  it("flags a still-open window rather than reading as a final Z-report", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: { ...BASE_REPORT, window: { ...BASE_REPORT.window, isOpen: true } },
      })
    );

    expect(output).toContain("masih buka");
  });

  it("says so instead of printing an all-zero report for an empty window", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: {
          ...BASE_REPORT,
          sales: { ...BASE_REPORT.sales, grossSales: 0, serviceCharge: 0, total: 0 },
          invoices: { count: 0, averagePerInvoice: 0 },
          byOrderType: [],
          byPaymentMethod: [],
          byProduct: { categories: [], totalQuantity: 0, totalGross: 0 },
        },
      })
    );

    expect(output).toContain("Tidak ada transaksi");
  });

  it("keeps every content line within the paper width at 32 and 48 cols", () => {
    for (const width of [32, 48] as const) {
      const output = decode(buildShiftReportEscPos({ ...REPORT_INPUT, width }));
      // Strip ESC/POS control sequences before measuring — only printable
      // text counts against the column budget.
      const lines = output
        .split("\n")
        // eslint-disable-next-line no-control-regex
        .map((l) => l.replace(/\x1b[@!aE][\x00-\xff]?/g, "").replace(/[\x00-\x1f]/g, ""));

      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it("does not truncate a long product name — it wraps under the quantity", () => {
    const longName = "Cream Cheese Honey Chilli Sourdough Toastie with Extra Everything";
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        width: 32,
        report: {
          ...BASE_REPORT,
          byProduct: {
            categories: [
              {
                categoryId: "cat-1",
                categoryName: "Pastry",
                lines: [{ name: longName, quantity: 3, gross: 96000 }],
                totalQuantity: 3,
                totalGross: 96000,
              },
            ],
            totalQuantity: 3,
            totalGross: 96000,
          },
        },
      })
    );

    expect(output).toContain("Everything");
  });

  it("swaps a non-ASCII currency symbol for the plain ISO code", () => {
    const output = decode(
      buildShiftReportEscPos({ ...REPORT_INPUT, currency: "EUR", locale: "fr" })
    );

    expect(output).toContain("EUR");
    expect(output).not.toContain("€");
  });
});
