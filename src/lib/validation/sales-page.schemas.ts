import { z } from "zod";
import { SALES_PAGES, SALES_PAGE_LOCALES } from "@/lib/sales-pages";

/**
 * An event sent by public/sales-pages/tracker.js. SIGNUP is not accepted here:
 * it is recorded server-side when the account is actually created.
 */
export const recordSalesPageEventSchema = z.object({
  page: z.enum(SALES_PAGES),
  /** The page's <html lang>. Absent from a tracker cached before the pages had languages: French. */
  locale: z.enum(SALES_PAGE_LOCALES).default("fr"),
  type: z.enum(["VIEW", "CTA_CLICK", "SCROLL_50", "SCROLL_90"]),
  cta: z
    .string()
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  referrer: z.string().max(200).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(200).optional(),
});

export type RecordSalesPageEventInput = z.infer<typeof recordSalesPageEventSchema>;

export const SALES_PAGE_REPORT_RANGES = ["7", "30", "90", "all"] as const;

export const salesPageReportRangeSchema = z.enum(SALES_PAGE_REPORT_RANGES).catch("30");

export type SalesPageReportRange = (typeof SALES_PAGE_REPORT_RANGES)[number];

/** The report's `range` query param: a preset, or "custom" with from/to days (src/lib/report-range.ts). */
export const salesPageReportRangeParamSchema = z
  .enum([...SALES_PAGE_REPORT_RANGES, "custom"])
  .catch("30");

/** The report's language filter: one language, or all of them together. */
export const SALES_PAGE_REPORT_LANGS = ["all", ...SALES_PAGE_LOCALES] as const;

export const salesPageReportLangSchema = z.enum(SALES_PAGE_REPORT_LANGS).catch("all");

export type SalesPageReportLang = (typeof SALES_PAGE_REPORT_LANGS)[number];

/** Lead submitted via the VSL 4-minute timer or exit-intent popup. */
export const salesLeadSchema = z.object({
  page: z.enum(SALES_PAGES),
  locale: z.enum(SALES_PAGE_LOCALES).default("fr"),
  source: z.enum(["vsl_timer", "exit_intent"]),
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  phone: z.string().min(1).max(30).trim(),
  email: z.string().email().max(200).trim().toLowerCase(),
});

export type SalesLeadInput = z.infer<typeof salesLeadSchema>;
