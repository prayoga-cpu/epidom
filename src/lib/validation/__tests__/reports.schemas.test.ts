/**
 * Query validation for the shift/daily report route. `shiftId` arrives
 * straight off a query string, so the shape check here is the first gate
 * before the service's own tenant check.
 */
import { describe, it, expect } from "vitest";
import { shiftReportQuerySchema } from "../reports.schemas";

const SHIFT_ID = "clh1234567890abcdefghijkl";

describe("shiftReportQuerySchema", () => {
  it("accepts a shiftId on its own", () => {
    expect(shiftReportQuerySchema.safeParse({ shiftId: SHIFT_ID }).success).toBe(true);
  });

  it("accepts a from/to window on its own", () => {
    const result = shiftReportQuerySchema.safeParse({
      from: "2026-08-09T03:00:00.000Z",
      to: "2026-08-09T15:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an entirely empty query — the service defaults to today", () => {
    expect(shiftReportQuerySchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-cuid shiftId", () => {
    expect(shiftReportQuerySchema.safeParse({ shiftId: "not-a-cuid" }).success).toBe(false);
  });

  it("rejects a date-only string — a shift window needs minute precision", () => {
    expect(shiftReportQuerySchema.safeParse({ from: "2026-08-09" }).success).toBe(false);
  });

  it("rejects an inverted range", () => {
    const result = shiftReportQuerySchema.safeParse({
      from: "2026-08-09T15:00:00.000Z",
      to: "2026-08-09T03:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a zero-length range (from === to)", () => {
    const result = shiftReportQuerySchema.safeParse({
      from: "2026-08-09T03:00:00.000Z",
      to: "2026-08-09T03:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
