/**
 * "Print Thai and other non-Latin text as an image" — wired into the builders.
 *
 * Two promises, in order of importance:
 *  1. With the switch off — or on a device that cannot draw — every document is
 *     byte for byte what it was before the switch existed. Nobody has run this
 *     on a real printer yet, so off must be exactly today.
 *  2. With it on, the lines the text path cannot print go out as GS v 0 images,
 *     drawn in the state (alignment, bold, size) they would have printed in,
 *     and everything that is plain ASCII still prints as text.
 *
 * jsdom has no canvas, so the drawing itself is a fake that returns a known
 * bitmap and records what it was asked for.
 */
import { describe, expect, it } from "vitest";
import { printerDotWidth, type LineRasterizer, type RasterLineRequest } from "../escpos-raster";
import { buildItemLabelEscPos, type ItemLabelData } from "../item-label";
import { buildOrderTicketEscPos, type OrderTicketData } from "../order-ticket";
import {
  buildEscPos,
  buildShiftReportEscPos,
  createEscPosWriter,
  labelRow,
  wrapText,
  wrapTextForRaster,
  type ReceiptData,
  type ShiftReportPrintInput,
} from "../thermal-printer";
import { getCanvasLineRasterizer, isRasterPrintingAvailable } from "../text-raster";
import { RECEIPT_LABELS, SHIFT_REPORT_LABELS, TICKET_LABELS } from "@/lib/receipts/receipt-labels";
import type { ShiftReportData } from "@/lib/finance/shift-report";

const decode = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** Two solid rows at the paper's width — recognisable, and free of 0x1D bytes. */
function fakeRasterizer(overrides: Partial<LineRasterizer> = {}) {
  const requests: RasterLineRequest[] = [];
  const rasterizer: LineRasterizer = {
    isAvailable: () => true,
    render: (request) => {
      requests.push(request);
      const width = printerDotWidth(request.cols);
      return { width, height: 2, data: new Uint8Array((width / 8) * 2).fill(0xff) };
    },
    ...overrides,
  };
  return { rasterizer, requests };
}

/** How many GS v 0 commands a document holds. */
function imageCount(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30 && bytes[i + 3] === 0) {
      count++;
    }
  }
  return count;
}

const STORE = "ร้านกาแฟสยาม";
const ITEM = "ข้าวผัดกะเพราไก่ไข่ดาวพิเศษเพิ่มข้าวไม่เผ็ดมาก";
const NOTE = "ไม่ใส่ผักชี";

const THAI_RECEIPT: ReceiptData = {
  storeName: STORE,
  currency: "THB",
  locale: "th",
  address: "123 ถนนสุขุมวิท กรุงเทพฯ",
  footerMessage: "ขอบคุณที่ใช้บริการ\nแล้วพบกันใหม่",
  orderNumber: "POS-20261122-0001",
  date: "22/11/2026 10:00",
  cashierName: "สมชาย",
  tableLabel: "A3",
  items: [
    { name: ITEM, quantity: 2, unitPrice: 60, total: 120, notes: NOTE },
    { name: "Iced Latte", quantity: 1, unitPrice: 75, total: 75, optionNames: ["Oat milk"] },
  ],
  subtotal: 195,
  tax: 13.65,
  discountAmount: 10,
  discountReason: "สมาชิก",
  total: 198.65,
  paymentMethod: "CASH",
  amountTendered: 200,
  change: 1.35,
  notes: "café crème",
  width: 32,
};

const LATIN_RECEIPT: ReceiptData = {
  storeName: "Epidom POS",
  locale: "id",
  orderNumber: "POS-20260808-0001",
  date: "08/08/2026 18:35",
  items: [{ name: "Salt Bread", quantity: 1, unitPrice: 25000, total: 25000 }],
  subtotal: 25000,
  total: 25000,
  paymentMethod: "CASH",
  amountTendered: 25000,
  change: 0,
};

const REPORT: ShiftReportData = {
  window: { from: "2026-08-09T03:00:00.000Z", to: "2026-08-09T15:00:00.000Z", isOpen: true },
  sales: {
    grossSales: 2298,
    discount: 20,
    serviceCharge: 229.8,
    tax: 160,
    processingFee: 0,
    delivery: 0,
    refund: 50,
    total: 2617.8,
  },
  invoices: { count: 46, averagePerInvoice: 56.9 },
  cancellations: { invoiceCount: 1, itemCount: 2, total: 120 },
  byOrderType: [{ orderType: "DINE_IN", platform: null, orderCount: 46, total: 2617.8 }],
  byGuest: null,
  byPaymentMethod: [{ paymentMethod: "CASH", orderCount: 20, revenue: 787.6, percentOfTotal: 30 }],
  byProduct: {
    categories: [
      {
        categoryId: "cat-1",
        categoryName: "อาหารจานเดียว",
        lines: [{ name: ITEM, quantity: 5, gross: 300 }],
        totalQuantity: 5,
        totalGross: 300,
      },
    ],
    totalQuantity: 5,
    totalGross: 300,
  },
  cashDrawer: null,
};

const THAI_REPORT: ShiftReportPrintInput = {
  report: REPORT,
  storeName: STORE,
  currency: "THB",
  locale: "th",
  width: 48,
  shiftLabel: "สมชาย",
  generatedAt: new Date("2026-08-09T16:56:00.000Z"),
};

const THAI_TICKET: OrderTicketData = {
  locale: "th",
  orderNumber: "POS-20261122-0007",
  queueNumber: 12,
  date: "22/11/2026 10:00",
  orderType: "DINE_IN",
  tableLabel: "A3",
  guestCount: 4,
  cashierName: "สมชาย",
  customerName: "คุณวิภา",
  notes: "แพ้ถั่ว",
  sections: [
    {
      department: "KITCHEN",
      items: [
        { name: ITEM, quantity: 2, optionNames: ["ไข่ดาว", "Extra rice"], notes: NOTE },
        { name: "Salt Bread", quantity: 1 },
      ],
    },
    { department: "BAR", items: [{ name: "ชาไทยเย็น", quantity: 1 }] },
  ],
  reprint: true,
  width: 32,
};

const THAI_LABEL: ItemLabelData = {
  headline: "#12",
  itemName: "ชาไทยเย็น",
  optionNames: ["หวานน้อย", "Less ice"],
  notes: NOTE,
  index: 1,
  count: 2,
  footer: "A3 18:35",
};

describe("switch off — byte for byte what it has always been", () => {
  const unavailable = () => fakeRasterizer({ isAvailable: () => false });
  const broken = () =>
    fakeRasterizer({
      isAvailable: () => {
        throw new Error("no canvas");
      },
    });

  /** Every way the switch can be "not on", against the builder called with no option at all. */
  function expectUnchanged(
    build: (option: object, deps?: { rasterizer: LineRasterizer }) => Uint8Array
  ) {
    const baseline = build({});
    expect(baseline.length).toBeGreaterThan(0);
    // The text path has no image command and nothing above 7-bit ASCII.
    expect(imageCount(baseline)).toBe(0);
    expect(baseline.every((byte) => byte <= 0x7f)).toBe(true);

    const working = fakeRasterizer();
    expect(build({ rasterNonAscii: false }, working)).toEqual(baseline);
    expect(build({ rasterNonAscii: undefined }, working)).toEqual(baseline);
    // Only a literal `true` switches it on — not a truthy leftover in stored JSON.
    expect(build({ rasterNonAscii: "true" }, working)).toEqual(baseline);
    expect(working.requests).toHaveLength(0);

    // Switched on, but this device cannot draw: still today's output.
    for (const device of [unavailable(), broken()]) {
      expect(build({ rasterNonAscii: true }, device)).toEqual(baseline);
      expect(device.requests).toHaveLength(0);
    }
    // jsdom has no canvas, so the real rasterizer is such a device.
    expect(build({ rasterNonAscii: true })).toEqual(baseline);
  }

  it.each([
    ["a Thai receipt", THAI_RECEIPT],
    ["a Latin receipt", LATIN_RECEIPT],
    ["a bill", { ...THAI_RECEIPT, documentType: "bill" as const }],
  ])("%s", (_name, receipt) => {
    expectUnchanged((option, deps) => buildEscPos({ ...receipt, ...option } as ReceiptData, deps));
  });

  it("a shift report", () => {
    expectUnchanged((option, deps) =>
      buildShiftReportEscPos({ ...THAI_REPORT, ...option } as ShiftReportPrintInput, deps)
    );
  });

  it("an order ticket", () => {
    expectUnchanged((option, deps) =>
      buildOrderTicketEscPos({ ...THAI_TICKET, ...option } as OrderTicketData, deps)
    );
  });

  it("item labels", () => {
    expectUnchanged((option, deps) =>
      buildItemLabelEscPos([THAI_LABEL, { ...THAI_LABEL, index: 2 }], 32, {
        ...(option as { rasterNonAscii?: boolean }),
        ...deps,
      })
    );
  });

  it("still prints English labels and '?' for Thai text — the behaviour being opted out of", () => {
    const out = decode(buildEscPos(THAI_RECEIPT));
    expect(out).toContain(RECEIPT_LABELS.en.total);
    expect(out).toContain("????");
  });

  it("is what the writer emits with no options: the exact historical command bytes", () => {
    const w = createEscPosWriter();
    w.init();
    w.center();
    w.doubleSize(true);
    w.line("Hi é");
    w.doubleSize(false);
    w.left();
    w.bold(true);
    w.line("ไทย");
    w.bold(false);
    w.doubleHeight(true);
    w.blank();
    expect(w.rasterRow("ไทย", "1")).toBe(false);
    expect(Array.from(w.bytes())).toEqual([
      ...[0x1b, 0x40],
      ...[0x1b, 0x61, 0x01],
      ...[0x1b, 0x21, 0x30],
      ...[0x48, 0x69, 0x20, 0x65, 0x0a],
      ...[0x1b, 0x21, 0x00],
      ...[0x1b, 0x61, 0x00],
      ...[0x1b, 0x45, 0x01],
      ...[0x3f, 0x3f, 0x3f, 0x0a],
      ...[0x1b, 0x45, 0x00],
      ...[0x1b, 0x21, 0x10],
      0x0a,
    ]);
  });

  it("has no canvas to draw on under jsdom, and says so instead of throwing", () => {
    expect(isRasterPrintingAvailable()).toBe(false);
    expect(
      getCanvasLineRasterizer().render({
        text: "ไทย",
        cols: 32,
        align: "left",
        bold: false,
        widthScale: 1,
        heightScale: 1,
      })
    ).toBeNull();
  });
});

describe("the writer, rasterizing", () => {
  it("sends a non-ASCII line as GS v 0 with no line feed after it, and ASCII as text", () => {
    const { rasterizer, requests } = fakeRasterizer();
    const w = createEscPosWriter({ rasterizer, cols: 32 });
    w.line("abc");
    w.line("ไทย");
    w.line("def");
    const row = new Array(48).fill(0xff);
    expect(Array.from(w.bytes())).toEqual([
      ...[0x61, 0x62, 0x63, 0x0a],
      ...[0x1d, 0x76, 0x30, 0x00, 48, 0x00, 0x02, 0x00, ...row, ...row],
      ...[0x64, 0x65, 0x66, 0x0a],
    ]);
    expect(requests).toEqual([
      {
        text: "ไทย",
        right: undefined,
        cols: 32,
        align: "left",
        bold: false,
        widthScale: 1,
        heightScale: 1,
      },
    ]);
  });

  it("draws at the 80mm dot width when the paper is 48 columns", () => {
    const { rasterizer } = fakeRasterizer();
    const w = createEscPosWriter({ rasterizer, cols: 48 });
    w.line("ไทย");
    expect(Array.from(w.bytes().slice(0, 8))).toEqual([0x1d, 0x76, 0x30, 0x00, 72, 0, 2, 0]);
  });

  it("hands over the text-mode state the line would have printed in", () => {
    const { rasterizer, requests } = fakeRasterizer();
    const w = createEscPosWriter({ rasterizer, cols: 32 });
    w.init();
    w.center();
    w.doubleSize(true);
    w.line("ก");
    w.doubleSize(false);
    w.left();
    w.doubleHeight(true);
    w.bold(true);
    w.line("ข");
    w.bold(false);
    w.doubleHeight(false);
    w.line("ค");
    w.center();
    w.bold(true);
    w.init();
    w.line("ง");
    expect(
      requests.map(({ text, align, bold, widthScale, heightScale }) => ({
        text,
        align,
        bold,
        widthScale,
        heightScale,
      }))
    ).toEqual([
      { text: "ก", align: "center", bold: false, widthScale: 2, heightScale: 2 },
      { text: "ข", align: "left", bold: true, widthScale: 1, heightScale: 2 },
      { text: "ค", align: "left", bold: false, widthScale: 1, heightScale: 1 },
      // ESC @ resets the printer, so it resets the mirror too.
      { text: "ง", align: "left", bold: false, widthScale: 1, heightScale: 1 },
    ]);
  });

  it("still sends the mode commands themselves, so text lines around an image are unaffected", () => {
    const plain = createEscPosWriter();
    const { rasterizer } = fakeRasterizer();
    const raster = createEscPosWriter({ rasterizer, cols: 32 });
    for (const w of [plain, raster]) {
      w.init();
      w.center();
      w.bold(true);
      w.line("Total 12");
      w.bold(false);
      w.left();
      w.blank(2);
    }
    expect(raster.bytes()).toEqual(plain.bytes());
  });

  it("offers a two-column row only when one side needs it", () => {
    const { rasterizer, requests } = fakeRasterizer();
    const w = createEscPosWriter({ rasterizer, cols: 32 });
    expect(w.rasterRow("Total", "12.00")).toBe(false);
    expect(w.bytes()).toHaveLength(0);
    expect(w.rasterRow("รวม", "12.00")).toBe(true);
    expect(w.rasterRow("Total", "฿12.00")).toBe(true);
    expect(requests.map(({ text, right }) => [text, right])).toEqual([
      ["รวม", "12.00"],
      ["Total", "฿12.00"],
    ]);
  });

  it.each([
    ["returns nothing", () => null],
    [
      "throws",
      () => {
        throw new Error("canvas lost");
      },
    ],
    ["returns an empty bitmap", () => ({ width: 384, height: 0, data: new Uint8Array(0) })],
  ])("prints the line as text when the rasterizer %s", (_name, render) => {
    const { rasterizer } = fakeRasterizer({ render });
    const w = createEscPosWriter({ rasterizer, cols: 32 });
    expect(() => w.line("ไทย")).not.toThrow();
    expect(w.rasterRow("ไทย", "1")).toBe(false);
    expect(Array.from(w.bytes())).toEqual([0x3f, 0x3f, 0x3f, 0x0a]);
  });
});

describe("wrapTextForRaster / labelRow", () => {
  it("wraps plain ASCII exactly as wrapText does", () => {
    for (const text of [
      "TAHOMA CAFE & EATERY",
      "Terima kasih!\nSilakan datang kembali",
      "",
      "  a b",
    ]) {
      expect(wrapTextForRaster(text, 16)).toEqual(wrapText(text, 16));
    }
  });

  it("hands a non-ASCII paragraph over whole, indent included, for wrapping in dots", () => {
    expect(wrapTextForRaster(ITEM, 8)).toEqual([ITEM]);
    expect(wrapTextForRaster(`  * ${NOTE}  `, 8)).toEqual([`  * ${NOTE}`]);
  });

  it("still honours hard line breaks, paragraph by paragraph", () => {
    expect(wrapTextForRaster(`${ITEM}\n\nThank you very much`, 10)).toEqual([
      ITEM,
      "Thank you",
      "very much",
    ]);
  });

  it("keeps a long non-ASCII value on its label's line instead of cutting it by code units", () => {
    expect(labelRow("Table", ITEM, 32, wrapTextForRaster)).toEqual([
      `${"Table".padEnd(9)}: ${ITEM}`,
    ]);
    // Unchanged without the raster wrap: the default is still wrapText.
    expect(labelRow("Table", "A3", 32)).toEqual(["Table    : A3"]);
    expect(labelRow("Table", "x".repeat(40), 32)).toEqual(
      labelRow("Table", "x".repeat(40), 32, wrapText)
    );
  });
});

describe("switch on — a Thai receipt", () => {
  const build = (receipt: ReceiptData = THAI_RECEIPT) => {
    const fake = fakeRasterizer();
    const bytes = buildEscPos({ ...receipt, rasterNonAscii: true }, fake);
    return { bytes, out: decode(bytes), requests: fake.requests };
  };
  const find = (requests: RasterLineRequest[], text: string) =>
    requests.find((request) => request.text === text);

  it("sends exactly one image per line it could not print as text", () => {
    const { bytes, requests } = build();
    expect(requests.length).toBeGreaterThan(0);
    expect(imageCount(bytes)).toBe(requests.length);
    for (const request of requests) {
      expect(/[^\x20-\x7e]/.test(`${request.text}${request.right ?? ""}`)).toBe(true);
      expect(request.cols).toBe(32);
    }
  });

  it("uses the Thai labels instead of the English fallback", () => {
    const { out, requests } = build();
    const th = RECEIPT_LABELS.th;
    expect(out).not.toContain(RECEIPT_LABELS.en.total);
    expect(out).not.toContain(RECEIPT_LABELS.en.subtotal);
    // The column header: both sides Thai, bold, on ONE bitmap.
    expect(find(requests, th.item)).toMatchObject({ right: th.total, bold: true, align: "left" });
    expect(requests.some((request) => request.text === th.subtotal && request.right)).toBe(true);
    expect(requests.some((request) => request.text.startsWith(`${th.discount} (`))).toBe(true);
  });

  it("draws the store name centred and double-size, whole", () => {
    const { requests } = build();
    expect(find(requests, STORE)).toMatchObject({
      align: "center",
      widthScale: 2,
      heightScale: 2,
      bold: false,
    });
  });

  it("never cuts a Thai item name by character count", () => {
    const { requests } = build();
    expect(ITEM.length).toBeGreaterThan(32);
    expect(find(requests, ITEM)).toMatchObject({ align: "left", widthScale: 1 });
    expect(find(requests, `  * ${NOTE}`)).toBeDefined();
  });

  it("keeps each line of a multi-line footer as its own centred image", () => {
    const { requests } = build();
    expect(find(requests, "ขอบคุณที่ใช้บริการ")).toMatchObject({ align: "center" });
    expect(find(requests, "แล้วพบกันใหม่")).toMatchObject({ align: "center" });
  });

  it("rasterizes accented Latin too, rather than stripping the accents", () => {
    const { requests } = build();
    expect(requests.some((request) => request.text.endsWith("café crème"))).toBe(true);
  });

  it("leaves plain-ASCII lines on the fast text path", () => {
    const { out } = build();
    expect(out).toContain("-".repeat(32));
    expect(out).toContain("Iced Latte\n");
    expect(out).toContain("Oat milk\n");
    expect(out).toContain("epidom");
    expect(out).not.toContain("?");
  });

  it("is identical to the text path for a receipt with nothing to rasterize", () => {
    const fake = fakeRasterizer();
    expect(buildEscPos({ ...LATIN_RECEIPT, rasterNonAscii: true }, fake)).toEqual(
      buildEscPos(LATIN_RECEIPT)
    );
    expect(fake.requests).toHaveLength(0);
  });

  it("falls back to text line by line if drawing fails midway, without throwing", () => {
    let calls = 0;
    const fake = fakeRasterizer({
      render: () => {
        calls++;
        throw new Error("canvas lost");
      },
    });
    const bytes = buildEscPos({ ...THAI_RECEIPT, rasterNonAscii: true }, fake);
    expect(calls).toBeGreaterThan(0);
    expect(imageCount(bytes)).toBe(0);
    expect(bytes.every((byte) => byte <= 0x7f)).toBe(true);
  });
});

describe("switch on — shift report, order ticket, item label", () => {
  it("prints the shift report with Thai headings and two-column Thai rows", () => {
    const fake = fakeRasterizer();
    const bytes = buildShiftReportEscPos({ ...THAI_REPORT, rasterNonAscii: true }, fake);
    const th = SHIFT_REPORT_LABELS.th;
    expect(imageCount(bytes)).toBe(fake.requests.length);
    expect(fake.requests.every((request) => request.cols === 48)).toBe(true);
    expect(fake.requests.find((request) => request.text === th.grossSales)?.right).toBeTruthy();
    expect(fake.requests.find((request) => request.text === STORE)).toMatchObject({
      align: "center",
      widthScale: 2,
    });
    // The product line: quantity prefix + the whole name, amount on the same bitmap.
    expect(fake.requests.find((request) => request.text === `x5 ${ITEM}`)?.right).toBeTruthy();
    expect(decode(bytes)).not.toContain(SHIFT_REPORT_LABELS.en.grossSales);
  });

  it("prints the kitchen ticket's items tall and bold, as the text path does", () => {
    const fake = fakeRasterizer();
    const bytes = buildOrderTicketEscPos({ ...THAI_TICKET, rasterNonAscii: true }, fake);
    expect(imageCount(bytes)).toBe(fake.requests.length);
    expect(fake.requests.find((request) => request.text === `2x ${ITEM}`)).toMatchObject({
      bold: true,
      widthScale: 1,
      heightScale: 2,
    });
    expect(fake.requests.find((request) => request.text === `   * ${NOTE}`)).toMatchObject({
      bold: true,
      heightScale: 1,
    });
    // One printer serving two areas: the Thai section banners, centred.
    expect(fake.requests.find((request) => request.text === TICKET_LABELS.th.bar)).toMatchObject({
      align: "center",
      bold: true,
    });
    const out = decode(bytes);
    expect(out).toContain("1x Salt Bread\n");
    expect(out).not.toContain("?");
  });

  it("prints an ESC/POS sticker's Thai lines as images and keeps the form feed", () => {
    const fake = fakeRasterizer();
    const bytes = buildItemLabelEscPos([THAI_LABEL], 32, { rasterNonAscii: true, ...fake });
    expect(fake.requests.map((request) => request.text)).toEqual([
      "ชาไทยเย็น",
      "หวานน้อย, Less ice",
      `* ${NOTE}`,
    ]);
    expect(fake.requests[0]).toMatchObject({ bold: true });
    expect(decode(bytes)).toContain("#12\n");
    expect(decode(bytes)).toContain("1/2 A3 18:35\n");
    expect(bytes[bytes.length - 1]).toBe(0x0c);
  });
});
