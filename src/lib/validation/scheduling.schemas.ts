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
