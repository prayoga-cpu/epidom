import { z } from "zod";
import {
  CONSENT_CHOICES,
  PIXEL_EVENTS,
  TRACKING_LOCALES,
  TRACKING_SOURCES,
  normalizeTrackedPath,
} from "@/lib/tracking-events";

const path = z
  .string()
  .min(1)
  .max(500)
  .transform((value) => normalizeTrackedPath(value));

const base = {
  path,
  source: z.enum(TRACKING_SOURCES),
  /** Anything else (a page without a known language) is dropped, not refused. */
  locale: z.enum(TRACKING_LOCALES).optional().catch(undefined),
};

/**
 * One event for /api/public/tracking-events, sent by src/lib/tracking-events.ts
 * (the site) and public/sales-pages/pixel.js (the sales pages).
 */
export const recordTrackingEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PIXEL"),
    name: z.enum(PIXEL_EVENTS),
    ...base,
    content: z.string().trim().max(100).optional(),
    value: z.number().finite().min(0).max(1_000_000_000).optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
  }),
  z.object({
    kind: z.literal("CONSENT"),
    name: z.enum(CONSENT_CHOICES),
    ...base,
    marketing: z.boolean(),
    analytics: z.boolean(),
  }),
]);

export type RecordTrackingEventInput = z.infer<typeof recordTrackingEventSchema>;

export const PIXEL_REPORT_RANGES = ["1", "7", "30", "90"] as const;

export type PixelReportRange = (typeof PIXEL_REPORT_RANGES)[number];

export const pixelReportRangeSchema = z.enum(PIXEL_REPORT_RANGES).catch("7");

/** The report's `range` query param: a preset, or "custom" with from/to days (src/lib/report-range.ts). */
export const pixelReportRangeParamSchema = z.enum([...PIXEL_REPORT_RANGES, "custom"]).catch("7");
