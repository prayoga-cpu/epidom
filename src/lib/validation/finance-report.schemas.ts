import { z } from "zod";

/** A date the report can use: an ISO date or datetime that parses. */
const reportDate = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

/**
 * The date range of a finance report query (the filters — shift, channel,
 * payment method — are validated by their own helpers in report-filters.ts).
 * An unparseable date is a 400, not a query that fails in the database.
 */
export const financeReportRangeSchema = z.object({
  from: reportDate.optional(),
  to: reportDate.optional(),
});
