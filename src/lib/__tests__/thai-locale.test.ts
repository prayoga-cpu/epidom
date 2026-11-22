import { describe, it, expect } from "vitest";
import {
  LOCALES,
  DEFAULT_LOCALE,
  stripLocalePrefix,
  getLocalizedPath,
  detectLocaleFromAcceptLanguage,
} from "../i18n-routing";
import { formatDate, formatDateTime } from "../utils/formatting";
import { INTL_LOCALES, DATE_FNS_LOCALES } from "@/components/lang/i18n-provider";
import { getLocaleMessages, loadLocale } from "@/locales";
import { th } from "@/locales/th";
import { toLocale } from "@/features/marketing/seo/route-locale";
import { localeSchema } from "../validation/common.schemas";
import {
  RECEIPT_LABELS,
  SHIFT_REPORT_LABELS,
  TICKET_LABELS,
  RECEIPT_INTL_LOCALE,
  printerLocale,
  resolveReceiptLocale,
  buildReceiptWhatsAppMessage,
} from "../receipts/receipt-labels";
import { toPrinterAscii } from "../pwa/thermal-printer";
import { LOCALE_PRICE_CURRENCY } from "../constants/plan-pricing";

describe("Thai locale wiring", () => {
  it("is a routed, prefixed marketing locale and French stays the default", () => {
    expect(LOCALES).toContain("th");
    expect(DEFAULT_LOCALE).toBe("fr");
    expect(stripLocalePrefix("/th/pricing")).toEqual({ locale: "th", basePath: "/pricing" });
    expect(stripLocalePrefix("/th")).toEqual({ locale: "th", basePath: "/" });
    expect(getLocalizedPath("/pricing", "th")).toBe("/th/pricing");
    expect(getLocalizedPath("/", "th")).toBe("/th");
  });

  it("detects Thai from Accept-Language without disturbing the other languages", () => {
    expect(detectLocaleFromAcceptLanguage("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("id-ID,id;q=0.9")).toBe("id");
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("fr");
  });

  it("accepts th as a route segment and as a stored preference", () => {
    expect(toLocale("th")).toBe("th");
    expect(toLocale("xx")).toBe(DEFAULT_LOCALE);
    expect(localeSchema.safeParse("th").success).toBe(true);
    expect(localeSchema.safeParse("de").success).toBe(false);
  });

  it("lazy-loads the Thai dictionary (and not another language's) on demand", async () => {
    await loadLocale("th");
    expect(getLocaleMessages("th")).toBe(th);
    await loadLocale("id");
    expect(getLocaleMessages("id")).not.toBe(th);
  });

  it("prints Gregorian years: Intl and date-fns agree (no 2569 next to 2026)", () => {
    const date = new Date("2026-11-22T10:00:00Z");
    expect(INTL_LOCALES.th).toBe("th-TH-u-ca-gregory");
    expect(new Intl.DateTimeFormat(INTL_LOCALES.th, { year: "numeric" }).format(date)).toContain("2026");
    expect(DATE_FNS_LOCALES.th.code).toBe("th");
    expect(formatDate(date, "PP", "th")).toContain("2026");
    expect(formatDateTime(date, "th")).toContain("2026");
    expect(RECEIPT_INTL_LOCALE.th).toBe("th-TH-u-ca-gregory");
  });

  it("quotes Thai visitors the USD price (no THB Stripe Price exists)", () => {
    expect(LOCALE_PRICE_CURRENCY.th).toBe("USD");
  });
});

describe("Thai receipts", () => {
  it("resolves th instead of coercing it to Indonesian", () => {
    expect(resolveReceiptLocale("th")).toBe("th");
    expect(resolveReceiptLocale("xx")).toBe("id");
  });

  it("has a complete Thai label set in all three tables, with the same keys as English", () => {
    for (const table of [RECEIPT_LABELS, SHIFT_REPORT_LABELS, TICKET_LABELS]) {
      expect(Object.keys(table.th).sort()).toEqual(Object.keys(table.en).sort());
      for (const value of Object.values(table.th)) expect(value.length).toBeGreaterThan(0);
    }
  });

  it("sends English labels to a thermal printer, because CP437 cannot print Thai", () => {
    expect(printerLocale("th")).toBe("en");
    expect(printerLocale("fr")).toBe("fr");
    expect(printerLocale("id")).toBe("id");
    // This is why: Thai glyphs become "?" on paper.
    expect(toPrinterAscii(RECEIPT_LABELS.th.total)).toMatch(/^\?+$/);
    expect(toPrinterAscii(RECEIPT_LABELS[printerLocale("th")].total)).toBe("TOTAL");
  });

  it("writes the WhatsApp receipt message in Thai", () => {
    const message = buildReceiptWhatsAppMessage({
      customerName: "Somchai",
      storeName: "Cafe Siam",
      total: 120,
      currency: "THB",
      orderDate: new Date("2026-11-22T10:00:00Z"),
      receiptUrl: "https://example.com/r/1",
      locale: "th",
    });
    expect(message).toContain("Somchai");
    expect(message).toContain("*Cafe Siam*");
    expect(message).toContain("https://example.com/r/1");
    expect(message).toMatch(/[฀-๿]/);
  });
});
