import { describe, it, expect } from "vitest";
import { buildCashReconciliationRows } from "@/lib/finance/report-aggregation";

const budi = { id: "staff-1", name: "Budi" };
const openedAt = new Date("2026-08-02T00:00:00Z");
const closedAt = new Date("2026-08-02T08:00:00Z");

describe("buildCashReconciliationRows", () => {
  it("flags a closed shift whose drawer didn't balance", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt,
        staffMember: budi,
        openingCash: 100_000,
        closingCash: 480_000,
        expectedCash: 500_000,
        cashDifference: -20_000,
      },
    ]);
    expect(rows[0]).toMatchObject({
      shiftId: "shift-1",
      staffName: "Budi",
      isOpen: false,
      cashDifference: -20_000,
      isFlagged: true,
    });
  });

  it("does not flag a balanced shift", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt,
        staffMember: budi,
        openingCash: 100_000,
        closingCash: 500_000,
        expectedCash: 500_000,
        cashDifference: 0,
      },
    ]);
    expect(rows[0].isFlagged).toBe(false);
  });

  it("does not flag a still-open shift (no closingCash/cashDifference yet)", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt: null,
        staffMember: budi,
        openingCash: 100_000,
        closingCash: null,
        expectedCash: null,
        cashDifference: null,
      },
    ]);
    expect(rows[0]).toMatchObject({ isOpen: true, isFlagged: false, closingCash: null });
  });

  it("sorts by most recently opened first", () => {
    const older = new Date("2026-08-01T00:00:00Z");
    const rows = buildCashReconciliationRows([
      {
        id: "shift-old",
        openedAt: older,
        closedAt: older,
        staffMember: budi,
        openingCash: 0,
        closingCash: 0,
        expectedCash: 0,
        cashDifference: 0,
      },
      {
        id: "shift-new",
        openedAt,
        closedAt,
        staffMember: budi,
        openingCash: 0,
        closingCash: 0,
        expectedCash: 0,
        cashDifference: 0,
      },
    ]);
    expect(rows.map((r) => r.shiftId)).toEqual(["shift-new", "shift-old"]);
  });
});
