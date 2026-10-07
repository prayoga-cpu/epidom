import { z } from "zod";
import { SALES_PAGES } from "@/lib/sales-pages";

/**
 * An event sent by public/sales-pages/tracker.js. SIGNUP is not accepted here:
 * it is recorded server-side when the account is actually created.
 */
export const recordSalesPageEventSchema = z.object({
  page: z.enum(SALES_PAGES),
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
