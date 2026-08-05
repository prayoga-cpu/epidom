import { describe, it, expect } from "vitest";
import {
  clockInSchema,
  clockOutSchema,
  reportAbsenceSchema,
  manualCloseAttendanceSchema,
  attendanceSettingsSchema,
} from "../attendance.schemas";

const staffId = "c123456789012345678901234";

describe("clockInSchema", () => {
  it("accepts a valid clock-in with coordinates", () => {
    const result = clockInSchema.safeParse({
      staffId,
      pin: "1234",
      selfieUrl: "https://blob.example.com/selfie.jpg",
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a clock-in with no coordinates (geolocation denied)", () => {
    const result = clockInSchema.safeParse({
      staffId,
      selfieUrl: "https://blob.example.com/selfie.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing selfieUrl", () => {
    const result = clockInSchema.safeParse({ staffId, pin: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range latitude", () => {
    const result = clockInSchema.safeParse({
      staffId,
      selfieUrl: "https://blob.example.com/selfie.jpg",
      latitude: 200,
      longitude: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("clockOutSchema", () => {
  it("accepts a valid clock-out", () => {
    const result = clockOutSchema.safeParse({
      staffId,
      selfieUrl: "https://blob.example.com/selfie.jpg",
    });
    expect(result.success).toBe(true);
  });
});

describe("reportAbsenceSchema", () => {
  it("requires a non-empty reason", () => {
    const result = reportAbsenceSchema.safeParse({ staffId, notes: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid absence report with no selfie", () => {
    const result = reportAbsenceSchema.safeParse({ staffId, notes: "Sick leave" });
    expect(result.success).toBe(true);
  });
});

describe("manualCloseAttendanceSchema", () => {
  it("requires a correction reason", () => {
    expect(manualCloseAttendanceSchema.safeParse({ notes: "" }).success).toBe(false);
  });

  it("accepts a valid correction", () => {
    expect(manualCloseAttendanceSchema.safeParse({ notes: "Forgot to clock out" }).success).toBe(
      true
    );
  });
});

describe("attendanceSettingsSchema", () => {
  it("accepts a valid threshold", () => {
    expect(attendanceSettingsSchema.safeParse({ standardWorkMinutesPerDay: 480 }).success).toBe(
      true
    );
  });

  it("rejects zero or negative minutes", () => {
    expect(attendanceSettingsSchema.safeParse({ standardWorkMinutesPerDay: 0 }).success).toBe(
      false
    );
  });

  it("rejects more than 1440 minutes (a day)", () => {
    expect(attendanceSettingsSchema.safeParse({ standardWorkMinutesPerDay: 1441 }).success).toBe(
      false
    );
  });
});
