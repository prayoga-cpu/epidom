import { z } from "zod";

/**
 * Attendance (selfie + geolocation clock-in/out) validation schemas. See
 * docs/roadmap.md, "Proposed addition, Staff Scheduling, Hours & Selfie
 * Attendance" for the full feature design.
 */

const pinSchema = z
  .string()
  .length(4)
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
  .optional()
  .or(z.literal(""));

// Best-effort — geolocation can be denied/unsupported, must never block a
// clock-in/out. Range-checked so a malformed client payload can't slip
// nonsense into reports.
const latitudeSchema = z.number().min(-90).max(90).optional();
const longitudeSchema = z.number().min(-180).max(180).optional();

export const clockInSchema = z.object({
  staffId: z.string().cuid(),
  pin: pinSchema,
  selfieUrl: z.string().url("A selfie photo is required to clock in"),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  staffScheduleId: z.string().cuid().optional(),
});
export type ClockInInput = z.infer<typeof clockInSchema>;

export const clockOutSchema = z.object({
  staffId: z.string().cuid(),
  pin: pinSchema,
  selfieUrl: z.string().url("A selfie photo is required to clock out"),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
export type ClockOutInput = z.infer<typeof clockOutSchema>;

export const reportAbsenceSchema = z.object({
  staffId: z.string().cuid(),
  pin: pinSchema,
  notes: z.string().min(1, "A reason is required").max(500),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
export type ReportAbsenceInput = z.infer<typeof reportAbsenceSchema>;

export const manualCloseAttendanceSchema = z.object({
  notes: z.string().min(1, "A correction reason is required").max(500),
  timestamp: z.string().datetime().optional(),
});
export type ManualCloseAttendanceInput = z.infer<typeof manualCloseAttendanceSchema>;

export const attendanceSettingsSchema = z.object({
  standardWorkMinutesPerDay: z.number().int().min(1).max(1440),
});
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
