import { describe, it, expect } from "vitest";
import { scheduleShiftSchema, staffScheduleSchema, publishScheduleSchema } from "../scheduling.schemas";

const staffMemberId = "c123456789012345678901234";
const scheduleShiftId = "c223456789012345678901234";

describe("scheduleShiftSchema", () => {
  it("accepts a valid named block", () => {
    const result = scheduleShiftSchema.safeParse({
      name: "Shift 1",
      startTime: "08:00",
      endTime: "16:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a cross-midnight block", () => {
    const result = scheduleShiftSchema.safeParse({
      name: "Shift 4",
      startTime: "20:00",
      endTime: "04:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed time", () => {
    const result = scheduleShiftSchema.safeParse({
      name: "Shift 1",
      startTime: "8am",
      endTime: "16:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("staffScheduleSchema", () => {
  it("accepts a named-block assignment", () => {
    const result = staffScheduleSchema.safeParse({
      staffMemberId,
      date: "2026-08-10",
      scheduleShiftId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a custom-time assignment", () => {
    const result = staffScheduleSchema.safeParse({
      staffMemberId,
      date: "2026-08-10",
      customStartTime: "09:00",
      customEndTime: "17:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects both a named block and a custom time together", () => {
    const result = staffScheduleSchema.safeParse({
      staffMemberId,
      date: "2026-08-10",
      scheduleShiftId,
      customStartTime: "09:00",
      customEndTime: "17:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects neither a named block nor a custom time", () => {
    const result = staffScheduleSchema.safeParse({ staffMemberId, date: "2026-08-10" });
    expect(result.success).toBe(false);
  });
});

describe("publishScheduleSchema", () => {
  it("accepts a valid date range", () => {
    expect(
      publishScheduleSchema.safeParse({ from: "2026-08-10", to: "2026-08-16" }).success
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(publishScheduleSchema.safeParse({ from: "10/08/2026", to: "2026-08-16" }).success).toBe(
      false
    );
  });
});
