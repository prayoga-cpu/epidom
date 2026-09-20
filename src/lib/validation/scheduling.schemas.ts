import { z } from "zod";

/**
 * Staff roster/scheduling validation schemas. See docs/roadmap.md, "Proposed
 * addition, Staff Scheduling, Hours & Selfie Attendance" for the full design.
 */

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm, e.g. 08:00");

export const scheduleShiftSchema = z.object({
  name: z.string().min(1).max(40),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color, e.g. #22c55e")
    .optional()
    .or(z.literal("")),
});
export type ScheduleShiftInput = z.infer<typeof scheduleShiftSchema>;

export const updateScheduleShiftSchema = scheduleShiftSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateScheduleShiftInput = z.infer<typeof updateScheduleShiftSchema>;

// Exactly one of (isDayOff), (scheduleShiftId), or (customStartTime +
// customEndTime) must be present — a roster row is either a day off, points
// at a reusable named block, or carries its own one-off time range.
export const staffScheduleSchema = z
  .object({
    staffMemberId: z.string().cuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    scheduleShiftId: z.string().cuid().optional(),
    customStartTime: timeOfDaySchema.optional(),
    customEndTime: timeOfDaySchema.optional(),
    isDayOff: z.boolean().optional(),
    department: z.enum(["KITCHEN", "BAR", "BOTH"]).optional(),
    notes: z.string().max(300).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      (data.isDayOff && !data.scheduleShiftId && !data.customStartTime && !data.customEndTime) ||
      (!data.isDayOff && !!data.scheduleShiftId && !data.customStartTime && !data.customEndTime) ||
      (!data.isDayOff && !data.scheduleShiftId && !!data.customStartTime && !!data.customEndTime),
    {
      message: "Mark as a day off, pick a named shift block, or set a custom start and end time",
      path: ["scheduleShiftId"],
    }
  );
export type StaffScheduleInput = z.infer<typeof staffScheduleSchema>;

export const updateStaffScheduleSchema = z.object({
  scheduleShiftId: z.string().cuid().nullable().optional(),
  customStartTime: timeOfDaySchema.nullable().optional(),
  customEndTime: timeOfDaySchema.nullable().optional(),
  isDayOff: z.boolean().optional(),
  department: z.enum(["KITCHEN", "BAR", "BOTH"]).nullable().optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
});
export type UpdateStaffScheduleInput = z.infer<typeof updateStaffScheduleSchema>;

export const staffScheduleBulkSchema = z.object({
  entries: z.array(staffScheduleSchema).max(200),
});
export type StaffScheduleBulkInput = z.infer<typeof staffScheduleBulkSchema>;

export const publishScheduleSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});
export type PublishScheduleInput = z.infer<typeof publishScheduleSchema>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A REAL calendar day, not merely YYYY-MM-DD-shaped. Date.UTC rolls an impossible day over
 * ("2026-02-31" becomes 3 March), so an unchecked key is stored as a different date than the
 * one asked for and the panel's exact-range match could never find its own row again.
 * Round-tripping through a Date catches every such case (month 13, day 45, Feb 29 off-leap).
 */
export function isRealDateKey(key: string): boolean {
  if (!DATE_KEY.test(key)) return false;
  const date = new Date(`${key}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

const realDateKey = z
  .string()
  .regex(DATE_KEY, "Use YYYY-MM-DD")
  .refine(isRealDateKey, "Not a real calendar date");

/**
 * A picture of a roster made outside Epidom, published to every staff member's
 * My Schedule for the dates it covers (see ScheduleImage in schema.prisma).
 *
 * The URL must be one our own upload endpoint produced (Vercel Blob), never a
 * caller-chosen host: it is rendered in an <img> and opened from an <a href> on
 * every staff device, and z.string().url() alone accepts `javascript:`. Same rule
 * as the feedback screenshot. Zod runs refinements even when .url() fails, so
 * new URL() must not throw.
 */
export const scheduleImageSchema = z
  .object({
    imageUrl: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")
          );
        } catch {
          return false;
        }
      }, "Invalid image URL"),
    startDate: realDateKey,
    endDate: realDateKey,
    note: z.string().trim().max(200).optional(),
  })
  // YYYY-MM-DD sorts lexically, so string comparison is date comparison.
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type ScheduleImageInput = z.infer<typeof scheduleImageSchema>;
