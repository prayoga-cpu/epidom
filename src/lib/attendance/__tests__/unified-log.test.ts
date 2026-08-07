import { describe, it, expect } from "vitest";
import {
  mergeUnifiedLog,
  type AttendanceRecordInput,
  type ShiftInput,
} from "../unified-log";

const STAFF = { name: "Alice" };

function attendance(
  id: string,
  type: AttendanceRecordInput["type"],
  iso: string
): AttendanceRecordInput {
  return {
    id,
    staffMemberId: "staff-1",
    staffMember: STAFF,
    type,
    timestamp: new Date(iso),
    selfieUrl: null,
    locationLabel: null,
    notes: null,
  };
}

function shift(
  id: string,
  openedIso: string,
  closedIso: string | null,
  openingCash = 100,
  closingCash: number | null = null
): ShiftInput {
  return {
    id,
    staffMemberId: "staff-1",
    staffMember: STAFF,
    openedAt: new Date(openedIso),
    closedAt: closedIso ? new Date(closedIso) : null,
    openingCash,
    closingCash,
    notes: null,
  };
}

describe("mergeUnifiedLog", () => {
  it("merges attendance and shift events sorted newest-first", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")],
      shifts: [shift("s1", "2026-08-10T02:00:00.000Z", null)],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe("CASH_IN");
    expect(rows[1].type).toBe("CLOCK_IN");
  });

  it("projects a closed shift into two rows: CASH_IN at openedAt, CASH_OUT at closedAt", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [shift("s1", "2026-08-10T01:00:00.000Z", "2026-08-10T09:00:00.000Z", 100, 150)],
    });
    expect(rows).toHaveLength(2);
    const cashIn = rows.find((r) => r.type === "CASH_IN")!;
    const cashOut = rows.find((r) => r.type === "CASH_OUT")!;
    expect(cashIn.amount).toBe(100);
    expect(cashOut.amount).toBe(150);
    expect(cashIn.id).not.toBe(cashOut.id);
  });

  it("an open shift (no closedAt) only produces a CASH_IN row", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [shift("s1", "2026-08-10T01:00:00.000Z", null)],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("CASH_IN");
  });

  it("filters by date range across both sources", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [
        attendance("a1", "CLOCK_IN", "2026-08-09T01:00:00.000Z"), // out of range
        attendance("a2", "CLOCK_IN", "2026-08-10T01:00:00.000Z"), // in range
      ],
      shifts: [
        shift("s1", "2026-08-09T01:00:00.000Z", null), // out of range
        shift("s2", "2026-08-10T01:00:00.000Z", null), // in range
      ],
      from: new Date("2026-08-10T00:00:00.000Z"),
      to: new Date("2026-08-10T23:59:59.999Z"),
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.timestamp.startsWith("2026-08-10"))).toBe(true);
  });

  it("filters by type, e.g. only CASH_IN/CASH_OUT excludes attendance rows entirely", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")],
      shifts: [shift("s1", "2026-08-10T02:00:00.000Z", "2026-08-10T09:00:00.000Z")],
      types: ["CASH_IN", "CASH_OUT"],
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === "CASH_IN" || r.type === "CASH_OUT")).toBe(true);
  });

  it("filters by a single attendance type", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [
        attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z"),
        attendance("a2", "CLOCK_OUT", "2026-08-10T09:00:00.000Z"),
      ],
      shifts: [],
      types: ["CLOCK_IN"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("CLOCK_IN");
  });

  it("carries the shift's staff name and null selfie/location on cash rows", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [shift("s1", "2026-08-10T01:00:00.000Z", null)],
    });
    expect(rows[0].staffName).toBe("Alice");
    expect(rows[0].selfieUrl).toBeNull();
    expect(rows[0].locationLabel).toBeNull();
  });

  it("returns an empty array when there is nothing in either source", () => {
    const rows = mergeUnifiedLog({ attendanceRecords: [], shifts: [] });
    expect(rows).toEqual([]);
  });
});
