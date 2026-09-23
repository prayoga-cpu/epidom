import { describe, it, expect } from "vitest";
import {
  scheduleShiftSchema,
  staffScheduleSchema,
  publishScheduleSchema,
  scheduleImageSchema,
} from "../scheduling.schemas";

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

describe("scheduleImageSchema", () => {
  const blobUrl = "https://abc123.public.blob.vercel-storage.com/schedule/week-38.png";
  const valid = { imageUrl: blobUrl, startDate: "2026-09-14", endDate: "2026-09-20" };

  it("accepts an image our upload endpoint produced, for a date range", () => {
    expect(scheduleImageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a one-day range and an optional note", () => {
    const result = scheduleImageSchema.safeParse({
      ...valid,
      endDate: "2026-09-14",
      note: "  Updated Tuesday  ",
    });
    expect(result.success).toBe(true);
    // Trimmed, so a note of spaces can't masquerade as content.
    expect(result.success && result.data.note).toBe("Updated Tuesday");
  });

  // The image is rendered in an <img> and opened from an <a href> on every staff
  // device, so the host is not the caller's to pick.
  it.each([
    ["a javascript: URL (z.string().url() alone accepts it)", "javascript:alert(1)"],
    ["plain http", "http://abc123.public.blob.vercel-storage.com/x.png"],
    ["another host", "https://example.com/roster.png"],
    ["a look-alike host", "https://abc123.public.blob.vercel-storage.com.evil.example/x.png"],
    ["a bare word", "roster.png"],
    ["an empty string", ""],
  ])("rejects %s", (_label, imageUrl) => {
    expect(scheduleImageSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
  });

  it("rejects an end before the start, on the end date", () => {
    const result = scheduleImageSchema.safeParse({
      ...valid,
      startDate: "2026-09-20",
      endDate: "2026-09-14",
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].path).toEqual(["endDate"]);
  });

  it("rejects a date that is not YYYY-MM-DD — never a datetime", () => {
    expect(
      scheduleImageSchema.safeParse({ ...valid, startDate: "2026-09-14T00:00:00Z" }).success
    ).toBe(false);
    expect(scheduleImageSchema.safeParse({ ...valid, endDate: "20/09/2026" }).success).toBe(false);
  });

  // Date.UTC rolls an impossible day over ("2026-02-31" -> 3 March), so a merely
  // YYYY-MM-DD-shaped key was stored as a different date than the one asked for.
  it.each([
    ["2026-02-31", "31 February"],
    ["2026-13-01", "month 13"],
    ["2026-04-31", "31 April"],
    ["2026-00-10", "month 0"],
    ["2026-02-29", "29 Feb in a non-leap year"],
  ])("rejects %s (%s)", (bad) => {
    expect(scheduleImageSchema.safeParse({ ...valid, startDate: bad, endDate: bad }).success).toBe(
      false
    );
  });

  it("accepts real edge days: 29 Feb in a leap year, month and year ends", () => {
    for (const day of ["2028-02-29", "2026-12-31", "2026-01-01", "2026-04-30"]) {
      expect(scheduleImageSchema.safeParse({ ...valid, startDate: day, endDate: day }).success).toBe(
        true
      );
    }
  });

  it("caps the note", () => {
    expect(scheduleImageSchema.safeParse({ ...valid, note: "x".repeat(201) }).success).toBe(false);
  });
});
