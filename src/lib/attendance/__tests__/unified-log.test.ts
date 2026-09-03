import { describe, it, expect } from "vitest";
import {
  mergeUnifiedLog,
  type AttendanceRecordInput,
  type CashMovementInput,
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

function movement(
  id: string,
  type: CashMovementInput["type"],
  iso: string,
  amount = 25,
  reason: string | null = null,
  staffMember: { name: string } | null = STAFF
): CashMovementInput {
  return {
    id,
    staffMemberId: staffMember ? "staff-1" : null,
    staffMember,
    type,
    amount,
    reason,
    occurredAt: new Date(iso),
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

describe("mergeUnifiedLog — real cash movements", () => {
  it("maps an inbound movement (TIP) to CASH_IN, carrying reason and amount", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements: [movement("m1", "TIP", "2026-08-10T04:00:00.000Z", 12.5, "table 4")],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("CASH_IN");
    expect(rows[0].amount).toBe(12.5);
    expect(rows[0].notes).toBe("table 4");
    expect(rows[0].staffName).toBe("Alice");
  });

  it("maps an outbound movement (PETTY_OUT) to CASH_OUT with its amount still positive", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements: [
        movement("m1", "PETTY_OUT", "2026-08-10T04:00:00.000Z", 30, "vegetable supplier"),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("CASH_OUT");
    // The sign lives in the type, never in the figure — a negative here would
    // double-negate against the drawer arithmetic.
    expect(rows[0].amount).toBe(30);
    expect(rows[0].notes).toBe("vegetable supplier");
  });

  it("maps every movement type to the direction cash-drawer.ts declares", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements: [
        movement("m1", "TIP", "2026-08-10T01:00:00.000Z"),
        movement("m2", "PETTY_IN", "2026-08-10T02:00:00.000Z"),
        movement("m3", "PETTY_OUT", "2026-08-10T03:00:00.000Z", 5, "milk"),
        movement("m4", "DROP", "2026-08-10T04:00:00.000Z", 5, "safe"),
        movement("m5", "PAYOUT", "2026-08-10T05:00:00.000Z", 5, "tips out"),
      ],
    });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.type]));
    expect(byId["movement-m1"]).toBe("CASH_IN");
    expect(byId["movement-m2"]).toBe("CASH_IN");
    expect(byId["movement-m3"]).toBe("CASH_OUT");
    expect(byId["movement-m4"]).toBe("CASH_OUT");
    expect(byId["movement-m5"]).toBe("CASH_OUT");
  });

  it("gives movement rows ids that cannot collide with the synthetic shift rows", () => {
    // Worst case: a movement whose id is literally the shift's id, which
    // without the prefix would produce a duplicate React key.
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [shift("s1", "2026-08-10T01:00:00.000Z", "2026-08-10T09:00:00.000Z", 100, 150)],
      cashMovements: [movement("s1", "TIP", "2026-08-10T04:00:00.000Z")],
    });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    expect(rows.map((r) => r.id)).toContain("movement-s1");
  });

  it("interleaves movements with shift and attendance rows, newest first", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")],
      shifts: [shift("s1", "2026-08-10T02:00:00.000Z", null)],
      cashMovements: [movement("m1", "DROP", "2026-08-10T03:00:00.000Z", 40, "safe")],
    });
    expect(rows.map((r) => r.id)).toEqual(["movement-m1", "s1-in", "a1"]);
  });

  it("still honours the type filter, selecting movements by their mapped direction", () => {
    const cashMovements = [
      movement("m1", "TIP", "2026-08-10T03:00:00.000Z"),
      movement("m2", "DROP", "2026-08-10T04:00:00.000Z", 40, "safe"),
    ];

    const inOnly = mergeUnifiedLog({
      attendanceRecords: [attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")],
      shifts: [],
      cashMovements,
      types: ["CASH_IN"],
    });
    expect(inOnly.map((r) => r.id)).toEqual(["movement-m1"]);

    const outOnly = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements,
      types: ["CASH_OUT"],
    });
    expect(outOnly.map((r) => r.id)).toEqual(["movement-m2"]);

    const attendanceOnly = mergeUnifiedLog({
      attendanceRecords: [attendance("a1", "CLOCK_IN", "2026-08-10T01:00:00.000Z")],
      shifts: [],
      cashMovements,
      types: ["CLOCK_IN"],
    });
    expect(attendanceOnly.map((r) => r.id)).toEqual(["a1"]);
  });

  it("filters movements by date range like every other source", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements: [
        movement("m1", "TIP", "2026-08-09T23:00:00.000Z"),
        movement("m2", "TIP", "2026-08-10T03:00:00.000Z"),
      ],
      from: new Date("2026-08-10T00:00:00.000Z"),
      to: new Date("2026-08-10T23:59:59.999Z"),
    });
    expect(rows.map((r) => r.id)).toEqual(["movement-m2"]);
  });

  it("renders an unattributed movement without inventing a staff member", () => {
    const rows = mergeUnifiedLog({
      attendanceRecords: [],
      shifts: [],
      cashMovements: [movement("m1", "PETTY_IN", "2026-08-10T03:00:00.000Z", 50, null, null)],
    });
    expect(rows[0].staffMemberId).toBeNull();
    expect(rows[0].staffName).toBe("—");
  });
});
