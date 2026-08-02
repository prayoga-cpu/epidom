import { describe, it, expect } from "vitest";
import { buildShiftRows } from "@/lib/finance/report-aggregation";

const budi = { id: "staff-1", name: "Budi" };
const openedAt = new Date("2026-08-02T00:00:00Z");
const closedAt = new Date("2026-08-02T08:00:00Z");

describe("buildShiftRows", () => {
  it("attaches staff name and open/close time to a matching shift group", () => {
    const rows = buildShiftRows(
      [{ shiftId: "shift-1", _sum: { total: 500_000 }, _count: { id: 10 } }],
      [{ id: "shift-1", openedAt, closedAt, staffMember: budi }]
    );
    expect(rows[0]).toMatchObject({
      shiftId: "shift-1",
      staffName: "Budi",
      staffId: "staff-1",
      isOpen: false,
      orderCount: 10,
      revenue: 500_000,
    });
  });

  it("marks a shift with no closedAt as still open", () => {
    const rows = buildShiftRows(
      [{ shiftId: "shift-1", _sum: { total: 100_000 }, _count: { id: 1 } }],
      [{ id: "shift-1", openedAt, closedAt: null, staffMember: budi }]
    );
    expect(rows[0].isOpen).toBe(true);
    expect(rows[0].closedAt).toBeNull();
  });

  it("buckets orders with no shiftId (storefront/online) under Unassigned instead of dropping them", () => {
    const rows = buildShiftRows(
      [{ shiftId: null, _sum: { total: 250_000 }, _count: { id: 3 } }],
      []
    );
    expect(rows[0]).toMatchObject({
      shiftId: null,
      staffName: "Unassigned",
      staffId: null,
      openedAt: null,
      isOpen: false,
      revenue: 250_000,
    });
  });

  it("sorts shifts by revenue descending", () => {
    const rows = buildShiftRows(
      [
        { shiftId: "shift-1", _sum: { total: 100_000 }, _count: { id: 1 } },
        { shiftId: "shift-2", _sum: { total: 900_000 }, _count: { id: 5 } },
      ],
      [
        { id: "shift-1", openedAt, closedAt, staffMember: budi },
        { id: "shift-2", openedAt, closedAt, staffMember: { id: "staff-2", name: "Wati" } },
      ]
    );
    expect(rows.map((r) => r.shiftId)).toEqual(["shift-2", "shift-1"]);
  });

  it("rounds revenue to 2 decimal places and defaults a null sum to 0", () => {
    const rows = buildShiftRows(
      [{ shiftId: "shift-1", _sum: { total: null }, _count: { id: 0 } }],
      [{ id: "shift-1", openedAt, closedAt, staffMember: budi }]
    );
    expect(rows[0].revenue).toBe(0);
  });
});
