import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  addDaysToDateKey,
  getBusinessDateKey,
  mondayOfDateKey,
} from "@/lib/attendance/business-date";
import { fetchHoursReport, getStoreHoursSettings } from "@/lib/attendance/fetch-hours-report";
import { fetchPayroll } from "@/lib/attendance/fetch-payroll";
import { staffScheduleSchema } from "@/lib/validation/scheduling.schemas";
import {
  createRosterEntries as createEntries,
  listRoster,
  publishRoster as publishEntries,
  RosterStaffNotFoundError,
} from "@/lib/services/roster.service";
import {
  decideOvertime as decideOvertimeDays,
  OVERTIME_SKIP_MESSAGES,
  OvertimeApprovalOffError,
  OvertimeRangeError,
} from "@/lib/attendance/overtime-decision.service";
import { defineStoreTool } from "../define-tool";
import { McpToolError } from "../errors";
import { rangeFromKeys } from "../range";
import { money, PAGES, storeIdInput, storeTimezone } from "./shared";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Inclusive date keys from the input, defaulting to this week and next. */
async function rosterDays(
  input: { from?: string; to?: string },
  timezone: string
): Promise<{ fromKey: string; toKey: string }> {
  const monday = mondayOfDateKey(getBusinessDateKey(new Date(), timezone));
  const fromKey = input.from ?? monday;
  const toKey = input.to ?? addDaysToDateKey(monday, 13);
  // Validates order and length the same way report periods do.
  rangeFromKeys(fromKey, toKey, timezone);
  return { fromKey, toKey };
}

export const getRoster = defineStoreTool({
  name: "get_roster",
  title: "Staff roster",
  description:
    "Who works when: roster entries (date, person, shift and hours, or day off; DRAFT or PUBLISHED) " +
    "for a date range, default this week and next. Also lists the store's shift blocks and active " +
    "staff, whose ids create_roster_entries takes. A staff member who isn't a manager only sees their " +
    "own published shifts.",
  input: z.object({
    ...storeIdInput,
    from: dateKey.optional().describe("First day, YYYY-MM-DD."),
    to: dateKey.optional().describe("Last day, inclusive."),
    staffMemberId: z.string().optional(),
  }),
  kind: "read",
  access: { pages: PAGES.ownSchedule },
  handler: async (input, ctx) => {
    const timezone = await storeTimezone(ctx);
    const { fromKey, toKey } = await rosterDays(input, timezone);
    // Same rule as GET /staff-schedules: only the owner and managers see
    // drafts and other people's shifts.
    const restricted = ctx.role !== "OWNER" && ctx.role !== "MANAGER";

    const [entries, shifts, staff] = await Promise.all([
      listRoster(ctx.storeId, {
        fromKey,
        toKey,
        staffMemberId: restricted ? ctx.staffMemberId : (input.staffMemberId ?? null),
        status: restricted ? "PUBLISHED" : null,
      }),
      prisma.scheduleShift.findMany({
        where: { storeId: ctx.storeId, isActive: true },
        orderBy: { startTime: "asc" },
        select: { id: true, name: true, startTime: true, endTime: true },
      }),
      restricted
        ? Promise.resolve([])
        : prisma.staffMember.findMany({
            where: { storeId: ctx.storeId, isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true },
          }),
    ]);

    return {
      days: { first: fromKey, last: toKey, timezone },
      entries: entries.map((entry) => ({
        entryId: entry.id,
        date: entry.date.toISOString().slice(0, 10),
        staffMemberId: entry.staffMember.id,
        name: entry.staffMember.name,
        dayOff: entry.isDayOff,
        shift: entry.scheduleShift?.name ?? null,
        start: entry.customStartTime ?? entry.scheduleShift?.startTime ?? null,
        end: entry.customEndTime ?? entry.scheduleShift?.endTime ?? null,
        department: entry.department,
        status: entry.status,
        notes: entry.notes,
      })),
      shiftBlocks: shifts.map((s) => ({
        scheduleShiftId: s.id,
        name: s.name,
        start: s.startTime,
        end: s.endTime,
      })),
      staff: staff.map((s) => ({ staffMemberId: s.id, name: s.name, role: s.role })),
    };
  },
});

export const getHoursAndOvertime = defineStoreTool({
  name: "get_hours_and_overtime",
  title: "Hours worked and overtime",
  description:
    "Clocked hours per person per day for a date range (default this month so far): worked, expected " +
    "from the roster, difference, overtime and whether that overtime is paid, waiting for approval or " +
    "turned down; plus clock-ins never closed. Days still in progress have no difference yet.",
  input: z.object({
    ...storeIdInput,
    from: dateKey.optional(),
    to: dateKey.optional(),
    staffMemberId: z.string().optional(),
  }),
  kind: "read",
  access: { pages: PAGES.roster, managerOnly: true, feature: "staffOperations" },
  handler: async (input, ctx) => {
    const settings = await getStoreHoursSettings(ctx.storeId);
    const today = getBusinessDateKey(new Date(), settings.timeZone);
    const fromKey = input.from ?? `${today.slice(0, 8)}01`;
    const toKey = input.to ?? today;
    rangeFromKeys(fromKey, toKey, settings.timeZone);

    const [report, staff] = await Promise.all([
      fetchHoursReport({
        storeId: ctx.storeId,
        fromKey,
        toKey,
        staffId: input.staffMemberId,
        settings,
      }),
      prisma.staffMember.findMany({
        where: { storeId: ctx.storeId },
        select: { id: true, name: true },
      }),
    ]);
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));

    return {
      days: { first: fromKey, last: toKey, timezone: settings.timeZone },
      standardDayMinutes: settings.standardWorkMinutesPerDay,
      overtimeNeedsApproval: settings.overtimeRequiresApproval,
      rows: report.rows.map((row) => ({
        date: row.date,
        staffMemberId: row.staffMemberId,
        name: nameOf.get(row.staffMemberId) ?? null,
        status: row.status,
        workedMinutes: row.workedMinutes,
        expectedMinutes: row.expectedMinutes,
        differenceMinutes: row.differenceMinutes,
        overtimeMinutes: row.overtimeMinutes,
        overtime: row.overtime,
      })),
      clockInsNotClosed: report.missingClockOuts.map((m) => ({
        date: m.date,
        name: nameOf.get(m.staffMemberId) ?? null,
      })),
    };
  },
});

export const getPayroll = defineStoreTool({
  name: "get_payroll",
  title: "Payroll",
  description:
    "Pay per person for a date range (default this month so far), as the Salary tab computes it: days " +
    "present and absent, regular and overtime minutes (only approved overtime is paid when approval is " +
    "on), allowances and total, in the store's currency. Owner only.",
  input: z.object({ ...storeIdInput, from: dateKey.optional(), to: dateKey.optional() }),
  kind: "read",
  access: { ownerOnly: true, feature: "staffOperations" },
  handler: async (input, ctx) => {
    const settings = await getStoreHoursSettings(ctx.storeId);
    const today = getBusinessDateKey(new Date(), settings.timeZone);
    const fromKey = input.from ?? `${today.slice(0, 8)}01`;
    const toKey = input.to ?? today;
    rangeFromKeys(fromKey, toKey, settings.timeZone);

    const report = await fetchPayroll({ storeId: ctx.storeId, fromKey, toKey, settings });
    return {
      days: { first: report.fromKey, last: report.toKey },
      currency: report.currency,
      overtimeNeedsApproval: report.overtimeRequiresApproval,
      staff: report.staff.map((s) => ({
        staffMemberId: s.staffMemberId,
        name: s.name,
        role: s.role,
        payType: s.payType,
        daysPresent: s.daysPresent,
        absentDays: s.absentDays,
        incompleteDays: s.incompleteDays,
        workedMinutes: s.workedMinutes,
        paidOvertimeMinutes: s.paidOvertimeMinutes,
        pendingOvertimeMinutes: s.pendingOvertimeMinutes,
        total: money(s.total),
      })),
      total: money(report.total),
    };
  },
});

export const createRosterEntries = defineStoreTool({
  name: "create_roster_entries",
  title: "Add roster entries",
  description:
    "Add up to 100 roster entries as DRAFT (staff don't see drafts until publish_roster). Each entry is " +
    "one person on one day with exactly one of: a shift block (scheduleShiftId from get_roster), custom " +
    "start and end times (HH:mm), or dayOff: true. Existing entries are kept; check get_roster first to " +
    "avoid double-booking.",
  input: z.object({
    ...storeIdInput,
    entries: z
      .array(
        z.object({
          staffMemberId: z.string(),
          date: dateKey,
          scheduleShiftId: z.string().optional(),
          start: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          end: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          dayOff: z.boolean().optional(),
          department: z.enum(["KITCHEN", "BAR", "BOTH"]).optional(),
          notes: z.string().max(300).optional(),
        })
      )
      .min(1)
      .max(100),
  }),
  kind: "write",
  access: { pages: PAGES.roster, managerOnly: true, feature: "staffOperations" },
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const entries = input.entries.map((entry, index) => {
      const parsed = staffScheduleSchema.safeParse({
        staffMemberId: entry.staffMemberId,
        date: entry.date,
        scheduleShiftId: entry.scheduleShiftId,
        customStartTime: entry.start,
        customEndTime: entry.end,
        isDayOff: entry.dayOff,
        department: entry.department,
        notes: entry.notes,
      });
      if (!parsed.success) {
        throw new McpToolError(
          "INVALID_INPUT",
          `Entry ${index + 1} (${entry.date}): ${parsed.error.issues.map((i) => i.message).join("; ")}. ` +
            "Give one of scheduleShiftId, start + end, or dayOff."
        );
      }
      return parsed.data;
    });

    try {
      const created = await createEntries(ctx.storeId, entries);
      return {
        created: created.length,
        status: "DRAFT",
        next: "Call publish_roster when the person approves.",
      };
    } catch (error) {
      if (error instanceof RosterStaffNotFoundError) {
        throw new McpToolError(
          "NOT_FOUND",
          "Someone in these entries isn't staff at this store. Use get_roster."
        );
      }
      throw error;
    }
  },
});

export const publishRoster = defineStoreTool({
  name: "publish_roster",
  title: "Publish the roster",
  description:
    "Publish every DRAFT roster entry between two dates, so staff see those shifts in My Schedule. " +
    "Only after the person approves the roster.",
  input: z.object({ ...storeIdInput, from: dateKey, to: dateKey }),
  kind: "write",
  access: { pages: PAGES.roster, managerOnly: true, feature: "staffOperations" },
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    rangeFromKeys(input.from, input.to, await storeTimezone(ctx));
    const published = await publishEntries(ctx.storeId, input.from, input.to);
    return { published, days: { first: input.from, last: input.to } };
  },
});

export const decideOvertime = defineStoreTool({
  name: "decide_overtime",
  title: "Approve or turn down overtime",
  description:
    "Approve or turn down the overtime that is waiting for a decision, for one or more staff-days " +
    "(staffMemberId + date from get_hours_and_overtime). Only stores that require overtime approval. " +
    "The decision applies to the minutes Epidom computes now; approved minutes are paid in payroll. " +
    "Nobody decides their own overtime (a manager's goes to the owner), the owner's own hours aren't " +
    "on payroll, and an unfinished day (still on the clock) can't be decided yet.",
  input: z.object({
    ...storeIdInput,
    decision: z.enum(["APPROVED", "REJECTED"]),
    days: z
      .array(z.object({ staffMemberId: z.string(), date: dateKey }))
      .min(1)
      .max(100),
  }),
  kind: "write",
  access: { pages: PAGES.roster, managerOnly: true, feature: "staffOperations" },
  severity: "NOTICE",
  hints: { destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    let result;
    try {
      result = await decideOvertimeDays(ctx.storeId, input.decision, input.days, async () => ({
        userId: ctx.principal.userId,
        staffMemberId: ctx.staffMemberId,
        name: ctx.actor.displayName ?? "Owner",
      }));
    } catch (error) {
      if (error instanceof OvertimeApprovalOffError) {
        throw new McpToolError(
          "APPROVAL_OFF",
          "This store pays overtime without approval, so there's nothing to decide."
        );
      }
      if (error instanceof OvertimeRangeError) {
        throw new McpToolError(
          "INVALID_PERIOD",
          "Those days span too long a period; decide them in smaller groups."
        );
      }
      throw error;
    }

    if (result.requested === 1 && result.skipped.length === 1) {
      throw new McpToolError(
        result.skipped[0].reason,
        OVERTIME_SKIP_MESSAGES[result.skipped[0].reason]
      );
    }
    return {
      decision: input.decision,
      decidedDays: result.decided,
      minutes: result.minutes,
      skipped: result.skipped.map((s) => ({
        staffMemberId: s.staffMemberId,
        date: s.date,
        reason: OVERTIME_SKIP_MESSAGES[s.reason],
      })),
    };
  },
});
