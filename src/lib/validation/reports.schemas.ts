import { z } from "zod";

/**
 * Query params for GET /api/stores/[id]/reports/shift-report.
 *
 * `shiftId` wins over `from`/`to` when both are present (picking a session is
 * a more specific intent than the range it sits inside) — the service enforces
 * that precedence; this schema only validates shape.
 *
 * Dates arrive as full ISO datetimes, not date-only strings: a shift window is
 * `openedAt` → `closedAt`, which has minute precision.
 */
export const shiftReportQuerySchema = z
  .object({
    shiftId: z.string().cuid().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine((data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to), {
    message: "`from` must not be after `to`",
    path: ["from"],
  });

export type ShiftReportQuery = z.infer<typeof shiftReportQuerySchema>;
