import { describe, it, expect } from "vitest";
import { buildCashReconciliationRows } from "@/lib/finance/report-aggregation";
import type { CashOnHandBreakdown } from "@/lib/finance/cash-drawer";

const budi = { id: "staff-1", name: "Budi" };
const openedAt = new Date("2026-08-02T00:00:00Z");
const closedAt = new Date("2026-08-02T08:00:00Z");

/** A zeroed cash position, overridden per test with only the fields that matter. */
const breakdown = (over: Partial<CashOnHandBreakdown> = {}): CashOnHandBreakdown => ({
  openingCash: 0,
  cashSales: 0,
  cashRefunds: 0,
  tips: 0,
  pettyIn: 0,
  pettyOut: 0,
  drops: 0,
  tipPayouts: 0,
  unlinkedCashSales: 0,
  expectedCash: 0,
  closingCash: null,
  cashDifference: null,
  ...over,
});

describe("buildCashReconciliationRows", () => {
  it("flags a closed shift whose drawer didn't balance", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt,
        staffMember: budi,
        breakdown: breakdown({
          openingCash: 100_000,
          cashSales: 400_000,
          expectedCash: 500_000,
          closingCash: 480_000,
          cashDifference: -20_000,
        }),
      },
    ]);
    expect(rows[0]).toMatchObject({
      shiftId: "shift-1",
      staffName: "Budi",
      staffId: "staff-1",
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
        breakdown: breakdown({
          openingCash: 100_000,
          cashSales: 400_000,
          expectedCash: 500_000,
          closingCash: 500_000,
          cashDifference: 0,
        }),
      },
    ]);
    expect(rows[0].isFlagged).toBe(false);
  });

  it("carries every cash category through onto the row", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt,
        staffMember: budi,
        breakdown: breakdown({
          openingCash: 100_000,
          cashSales: 900_000,
          cashRefunds: 50_000,
          tips: 30_000,
          pettyIn: 20_000,
          pettyOut: 75_000,
          drops: 200_000,
          tipPayouts: 25_000,
          expectedCash: 700_000,
          closingCash: 700_000,
          cashDifference: 0,
        }),
      },
    ]);
    expect(rows[0]).toMatchObject({
      openingCash: 100_000,
      cashSales: 900_000,
      cashRefunds: 50_000,
      tips: 30_000,
      pettyIn: 20_000,
      pettyOut: 75_000,
      drops: 200_000,
      tipPayouts: 25_000,
      expectedCash: 700_000,
    });
  });

  it("does not flag a still-open shift, even though expectedCash is now computed live", () => {
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt: null,
        staffMember: budi,
        breakdown: breakdown({
          openingCash: 100_000,
          cashSales: 340_000,
          // Live figure for a till mid-shift — real, but nothing has been
          // counted against it yet.
          expectedCash: 440_000,
          closingCash: null,
          cashDifference: null,
        }),
      },
    ]);
    expect(rows[0]).toMatchObject({
      isOpen: true,
      isFlagged: false,
      expectedCash: 440_000,
      closingCash: null,
      cashDifference: null,
    });
  });

  it("does not flag an open shift even if a stale count is attached to it", () => {
    // Defensive: `isFlagged` means "a CLOSED session whose count didn't match".
    // A non-null difference on a session that is still open must never trip it.
    const rows = buildCashReconciliationRows([
      {
        id: "shift-1",
        openedAt,
        closedAt: null,
        staffMember: budi,
        breakdown: breakdown({
          expectedCash: 440_000,
          closingCash: 400_000,
          cashDifference: -40_000,
        }),
      },
    ]);
    expect(rows[0]).toMatchObject({ isOpen: true, isFlagged: false });
  });

  it("sorts by most recently opened first", () => {
    const older = new Date("2026-08-01T00:00:00Z");
    const rows = buildCashReconciliationRows([
      {
        id: "shift-old",
        openedAt: older,
        closedAt: older,
        staffMember: budi,
        breakdown: breakdown({ closingCash: 0, cashDifference: 0 }),
      },
      {
        id: "shift-new",
        openedAt,
        closedAt,
        staffMember: budi,
        breakdown: breakdown({ closingCash: 0, cashDifference: 0 }),
      },
    ]);
    expect(rows.map((r) => r.shiftId)).toEqual(["shift-new", "shift-old"]);
  });
});
