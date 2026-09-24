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
  byOrderType: [{ orderType: "DINE_IN", platform: null, orderCount: 46, total: 2527800 }],
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

/**
 * A closed single-till drawer with only sales and refunds moving through it —
 * every discretionary movement (tips, float top-up, paid-out, safe drop, tips
 * paid out) is deliberately zero so the same fixture doubles as the
 * "zero lines are not printed" case.
 */
const BASE_CASH_DRAWER: NonNullable<ShiftReportData["cashDrawer"]> = {
  scope: "SHIFT",
  staffName: "Budi",
  openedAt: "2026-08-09T03:00:00.000Z",
  closedAt: "2026-08-09T15:00:00.000Z",
  tillCount: 1,
  hasOpenTill: false,
  openingCash: 200000,
  cashSales: 800000,
  cashRefunds: 12400,
  tips: 0,
  pettyIn: 0,
  pettyOut: 0,
  drops: 0,
  tipPayouts: 0,
  unlinkedCashSales: 0,
  expectedCash: 987600,
  closingCash: 987600,
  cashDifference: 0,
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
        report: { ...BASE_REPORT, cashDrawer: BASE_CASH_DRAWER },
      })
    );

    expect(output).toContain("LAPORAN SHIFT");
    expect(output).toContain("Kas Laci");
    expect(output).toContain("Kas Awal");
    expect(output).toContain("Budi");
    // One cashier's till: the heading must NOT claim to cover every till.
    expect(output).not.toContain("Semua Kasir");
  });

  it("prints each cash movement that has a figure, signed by its direction", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: {
          ...BASE_REPORT,
          cashDrawer: { ...BASE_CASH_DRAWER, tips: 45000, pettyOut: 60000, expectedCash: 972600 },
        },
      })
    );

    expect(output).toContain("Penjualan Tunai");
    // "Tip" is also a substring of "Berdasarkan Tipe Penjualan", so anchor
    // the assertion to the start of its own row rather than matching anywhere.
    expect(output).toMatch(/^Tip\s/m);
    // Outbound movements carry the same leading "-" as the refund line, so a
    // reader can add the column up by eye and land on the expected total.
    expect(output).toMatch(/^Kas Keluar\s+-/m);
    expect(output).toMatch(/^Refund\s+-/m);
  });

  it("skips a cash movement with no figure instead of printing a zero row", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: { ...BASE_REPORT, cashDrawer: BASE_CASH_DRAWER },
      })
    );

    // Nothing was tipped out, dropped to the safe or added to the float.
    expect(output).not.toContain("Tip Keluar");
    expect(output).not.toContain("Setor Brankas");
    expect(output).not.toContain("Kas Masuk");
    // The float and the expected total print regardless — their absence
    // would itself be information the person counting the drawer needs.
    expect(output).toContain("Kas Awal");
    expect(output).toContain("Kas Seharusnya");
  });

  it("marks a store-wide day rollup as covering every till, and as provisional", () => {
    const output = decode(
      buildShiftReportEscPos({
        ...REPORT_INPUT,
        report: {
          ...BASE_REPORT,
          cashDrawer: {
            ...BASE_CASH_DRAWER,
            scope: "STORE_DAY",
            staffName: null,
            tillCount: 3,
            hasOpenTill: true,
            closingCash: null,
            cashDifference: null,
          },
        },
      })
    );

    expect(output).toContain("Semua Kasir");
    // A till is still open, so the expected figure keeps moving — the paper
    // must not read as a final, signed-off count.
    expect(output).toContain("Sementara");
    // A cash block no longer implies a shift: this one spans the whole store.
    expect(output).toContain("LAPORAN HARIAN");
    expect(output).not.toContain("Kas Akhir");
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
      // Includes the cash drawer, whose "Kas Seharusnya (Sementara)" label is
      // the longest in the report and the likeliest to overflow 58mm paper.
      const output = decode(
        buildShiftReportEscPos({
          ...REPORT_INPUT,
          width,
          report: {
            ...BASE_REPORT,
            cashDrawer: { ...BASE_CASH_DRAWER, hasOpenTill: true },
          },
        })
      );
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

/**
 * Column safety, bills and multi-tender receipts (release 2.88.0).
 *
 * `formatCols()` always emits at least one space, so it silently OVERFLOWS the
 * paper as soon as label + value fills the width — on 58mm (32 cols) that is
 * ordinary content, e.g. a 7-figure rupiah total next to a discount reason.
 * An overflowing line wraps wherever the printer feels like it, orphaning the
 * amount mid-column. Every two-column line now goes through createColumnRow,
 * and the width assertions below are what keep it that way.
 */
function printedLines(bytes: Uint8Array): string[] {
  return (
    decode(bytes)
      .split("\n")
      // Strip the ESC/POS control sequences — only printable text counts
      // against the column budget.
      // eslint-disable-next-line no-control-regex
      .map((l) => l.replace(/\x1b[@!aE][\x00-\xff]?/g, "").replace(/[\x00-\x1f]/g, ""))
  );
}

const SPLIT_RECEIPT: ReceiptData = {
  ...BASE_RECEIPT,
  paymentMethod: "SPLIT",
  payments: [
    { method: "CASH", amount: 15000, amountTendered: 20000, change: 5000 },
    { method: "QRIS", amount: 10000 },
  ],
};

describe("buildEscPos — bill (provisional print)", () => {
  it("prints the bill title and the not-a-receipt footer, per locale", () => {
    const id = decode(buildEscPos({ ...BASE_RECEIPT, documentType: "bill", locale: "id" }));
    expect(id).toContain("NOTA SEMENTARA");
    expect(id).toContain("Ini bukan bukti pembayaran");

    const en = decode(buildEscPos({ ...BASE_RECEIPT, documentType: "bill", locale: "en" }));
    expect(en).toContain("BILL");
    expect(en).toContain("This is not a receipt");

    // Accents are stripped for CP437 — "reçu" prints as "recu", by design.
    const fr = decode(buildEscPos({ ...BASE_RECEIPT, documentType: "bill", locale: "fr" }));
    expect(fr).toContain("ADDITION");
    expect(fr).toContain("Ceci n'est pas un recu");
  });

  it("prints no payment lines at all — nothing has been paid yet", () => {
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        documentType: "bill",
        locale: "id",
        paymentMethod: "CASH",
        amountTendered: 30000,
        change: 5000,
      })
    );
    expect(output).not.toContain("TUNAI");
    expect(output).not.toContain("KEMBALI");
    expect(output).not.toContain("LUNAS");
  });

  it("still prints the items, charges and total", () => {
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        documentType: "bill",
        locale: "id",
        tax: 2500,
        serviceCharge: 1250,
        discountAmount: 1000,
        discountReason: "Preset: Happy Hour",
      })
    );
    expect(output).toContain("Salt Bread");
    expect(output).toContain("SUBTOTAL");
    expect(output).toContain("Pajak");
    expect(output).toContain("Service");
    expect(output).toContain("Diskon");
    expect(output).toContain("TOTAL");
  });

  it("drops the merchant's thank-you footer, which would read as a sign-off", () => {
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        documentType: "bill",
        locale: "id",
        footerMessage: "Terima kasih sudah mampir!",
      })
    );
    expect(output).not.toContain("Terima kasih sudah mampir!");
  });
});

describe("buildEscPos — multi-tender", () => {
  it("prints one line per tender, with tendered/change under the cash one", () => {
    const output = decode(buildEscPos({ ...SPLIT_RECEIPT, locale: "id", width: 32 }));
    expect(output).toContain("CASH");
    expect(output).toContain("QRIS");
    expect(output).toContain("TUNAI");
    expect(output).toContain("KEMBALI");
    // "SPLIT" is a label on the order, not a way anyone paid — it must never
    // reach the paper.
    expect(output).not.toContain("SPLIT");
  });

  it("leaves a single-tender receipt byte-identical to one with no tender rows", () => {
    // The whole compatibility promise: an ordinary cash sale prints exactly
    // what it printed before OrderPayment existed.
    const legacy = buildEscPos({
      ...BASE_RECEIPT,
      paymentMethod: "CASH",
      amountTendered: 30000,
      change: 5000,
    });
    const withOneRow = buildEscPos({
      ...BASE_RECEIPT,
      paymentMethod: "CASH",
      amountTendered: 30000,
      change: 5000,
      payments: [{ method: "CASH", amount: 25000, amountTendered: 30000, change: 5000 }],
    });
    expect(Array.from(withOneRow)).toEqual(Array.from(legacy));
  });

  it("uses the cashier's typed label for an OTHER tender", () => {
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        paymentMethod: "SPLIT",
        payments: [
          { method: "Voucher Gojek", amount: 15000 },
          { method: "CASH", amount: 10000 },
        ],
      })
    );
    expect(output).toContain("Voucher Gojek");
  });
});

describe("buildEscPos — paper width", () => {
  it("keeps every content line within the paper at 32 and 48 cols", () => {
    for (const width of [32, 48] as const) {
      const lines = printedLines(
        buildEscPos({
          ...SPLIT_RECEIPT,
          width,
          locale: "id",
          currency: "IDR",
          // Deliberately hostile: long store/customer text, a long discount
          // reason, a long typed tender label and 7-figure amounts — the exact
          // content that used to overflow 58mm paper.
          storeName: "WARUNG KOPI SENJA & DAPUR NUSANTARA JAKARTA SELATAN",
          address: "Jl. Kemang Raya No. 45B, Bangka, Mampang Prapatan, Jakarta Selatan 12730",
          cashierName: "Muhammad Rizky Ramadhan Kurniawan",
          tableLabel: "Terrace long table number seventeen",
          items: [
            {
              name: "Cream Cheese Honey Chilli Sourdough Toastie with Extra Everything",
              quantity: 12,
              unitPrice: 1250000,
              total: 15000000,
            },
          ],
          subtotal: 15000000,
          tax: 1500000,
          taxLabel: "Pajak Restoran PB1 (10%)",
          serviceCharge: 750000,
          serviceChargeLabel: "Biaya Layanan Restoran (5%)",
          discountAmount: 1000000,
          discountReason: "Preset: Promo Akhir Pekan Spesial Pelanggan Setia",
          total: 16250000,
          notes: "Tolong pisahkan sambalnya, alergi kacang, dan bungkus terpisah ya",
          payments: [
            {
              method: "Voucher makan karyawan kantor pusat",
              amount: 6250000,
            },
            { method: "CASH", amount: 10000000, amountTendered: 12000000, change: 2000000 },
          ],
        })
      );

      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it("keeps a bill within the paper too", () => {
    for (const width of [32, 48] as const) {
      const lines = printedLines(
        buildEscPos({
          ...BASE_RECEIPT,
          width,
          locale: "fr",
          currency: "EUR",
          documentType: "bill",
          storeName: "BOULANGERIE DU COIN SAINT-GERMAIN-DES-PRES",
          discountAmount: 12.5,
          discountReason: "Remise fidelite client habituel du quartier",
          tax: 9.9,
          taxLabel: "TVA sur place (10%)",
          total: 199.9,
        })
      );
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it("emits only ASCII for a bill — CP437 round-trips nothing else", () => {
    const bytes = buildEscPos({
      ...BASE_RECEIPT,
      documentType: "bill",
      locale: "fr",
      storeName: "Café Crème",
    });
    for (const byte of bytes) expect(byte).toBeLessThanOrEqual(0x7f);
  });
});

describe("buildEscPos — wrapped lines keep their indentation", () => {
  it("keeps a wrapped item quantity line indented under its name", () => {
    // Leading whitespace is the only thing marking a sub-line as belonging to
    // the item above it; wrapText splits on /\s+/ and used to eat it, so a
    // wrapped quantity line read as a brand new item on 58mm paper.
    const lines = printedLines(
      buildEscPos({
        ...BASE_RECEIPT,
        width: 32,
        locale: "id",
        currency: "IDR",
        items: [
          { name: "Nasi Goreng Spesial", quantity: 1200, unitPrice: 1250000, total: 1500000000 },
        ],
        subtotal: 1500000000,
        total: 1500000000,
      })
    );

    const qtyLine = lines.find((l) => l.includes("1200x"));
    expect(qtyLine).toBeDefined();
    expect(qtyLine!.startsWith("  ")).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(32);
  });

  it("keeps a wrapped cash sub-line indented under its tender", () => {
    const lines = printedLines(
      buildEscPos({
        ...BASE_RECEIPT,
        width: 32,
        locale: "id",
        currency: "IDR",
        paymentMethod: "SPLIT",
        total: 1500000000,
        subtotal: 1500000000,
        payments: [
          { method: "Voucher makan karyawan", amount: 500000000 },
          {
            method: "CASH",
            amount: 1000000000,
            amountTendered: 1200000000,
            change: 200000000,
          },
        ],
      })
    );

    const tenderedLine = lines.find((l) => l.trimStart().startsWith("TUNAI"));
    expect(tenderedLine).toBeDefined();
    expect(tenderedLine!.startsWith("  ")).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(32);
  });
});
