import { z } from "zod";

/**
 * Zod schemas for the audit trail API.
 *
 * Note the date handling: every existing date filter in this codebase appends
 * `T00:00:00Z` to a bare `YYYY-MM-DD`, and feeding those helpers a full
 * datetime silently produces garbage rather than an error. So these accept a
 * DATE ONLY and do the boundary arithmetic here, where it is visible.
 */

const DATE_ONLY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD; a full datetime is silently mis-parsed here");

export const activityQuerySchema = z.object({
  /** Opaque cursor: the id of the last row from the previous page. */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: DATE_ONLY.optional(),
  to: DATE_ONLY.optional(),
  actorRefId: z.string().optional(),
  actorKind: z.enum(["USER", "STAFF", "PUBLIC", "SYSTEM", "WEBHOOK"]).optional(),
  storeId: z.string().optional(),
  /** Prisma model name, e.g. "Order". This is the "sort by table" filter. */
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  actionCode: z.string().optional(),
  category: z.string().optional(),
  severity: z.enum(["INFO", "NOTICE", "CRITICAL"]).optional(),
  outcome: z.enum(["SUCCESS", "DENIED", "FAILED"]).optional(),
  /** Only rows that carry a curated, potentially reversible Layer 2 entry. */
  detailedOnly: z.coerce.boolean().optional(),
  flaggedOnly: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  /** Column to order by. The admin panel has no column sorting today. */
  sortBy: z.enum(["occurredAt", "severity", "actorName", "actionCode"]).default("occurredAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export const revertSchema = z.object({
  actionLogId: z.string().min(1),
  /**
   * Required and non-trivial: the reason becomes part of the permanent record,
   * and "test" tells a future investigator nothing.
   */
  reason: z.string().min(10, "Give a reason of at least 10 characters").max(1000),
  /** Must be true; the client has to have shown the plan first. */
  confirmed: z.literal(true),
});

export const annotateSchema = z.object({
  actionLogId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export const flagSchema = z.object({
  actionLogId: z.string().min(1),
  flagged: z.boolean(),
  note: z.string().max(1000).optional(),
});

export const lockSchema = z.object({
  actionLogId: z.string().min(1),
  locked: z.boolean(),
});

/**
 * Convert a DATE-ONLY filter pair into a half-open UTC range.
 *
 * `to` is exclusive-by-next-day so that a single-day filter includes every
 * event on that day. Using `lte` with `T00:00:00Z` — the pattern used elsewhere
 * in this codebase — would silently return only events at exactly midnight.
 */
export function toDateRange(from?: string, to?: string): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    range.lt = end;
  }
  return range;
}
