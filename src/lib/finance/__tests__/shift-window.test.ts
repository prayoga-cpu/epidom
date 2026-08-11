/**
 * Shift window resolution — the single meaning of "filter by shift" across
 * Order History, the daily report, and Finance.
 */
import { describe, it, expect } from "vitest";
import { resolveShiftWindow, formatShiftLabel } from "../shift-window";

describe("resolveShiftWindow", () => {
  it("runs openedAt to closedAt for a closed shift", () => {
    const window = resolveShiftWindow({
      openedAt: "2026-08-09T03:00:00.000Z",
      closedAt: "2026-08-09T15:30:00.000Z",
    });

    expect(window.from.toISOString()).toBe("2026-08-09T03:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-09T15:30:00.000Z");
    expect(window.isOpen).toBe(false);
  });

  it("runs openedAt to `now` for a still-open shift, and flags it", () => {
    const now = new Date("2026-08-09T11:00:00.000Z");
    const window = resolveShiftWindow(
      { openedAt: "2026-08-09T03:00:00.000Z", closedAt: null },
      now
    );

    expect(window.to.toISOString()).toBe(now.toISOString());
    expect(window.isOpen).toBe(true);
  });

  it("keeps a midnight-crossing shift as one continuous window", () => {
    // 20:00 -> 04:00 next day. The window must not be split or clamped to the
    // calendar day the shift opened on.
    const window = resolveShiftWindow({
      openedAt: "2026-08-09T13:00:00.000Z",
      closedAt: "2026-08-09T21:00:00.000Z",
    });

    expect(window.to.getTime() - window.from.getTime()).toBe(8 * 60 * 60 * 1000);
  });

  it("accepts Date objects as well as ISO strings", () => {
    const window = resolveShiftWindow({
      openedAt: new Date("2026-08-09T03:00:00.000Z"),
      closedAt: new Date("2026-08-09T09:00:00.000Z"),
    });

    expect(window.from.toISOString()).toBe("2026-08-09T03:00:00.000Z");
    expect(window.isOpen).toBe(false);
  });
});

describe("formatShiftLabel", () => {
  const fmt = {
    formatDayDate: () => "09 Aug",
    formatTimeOnly: (value: Date | string) =>
      new Date(value).toISOString().slice(11, 16),
    openLabel: "still open",
  };

  it("includes the cashier name and both ends of the window", () => {
    const label = formatShiftLabel(
      {
        openedAt: "2026-08-09T03:00:00.000Z",
        closedAt: "2026-08-09T15:30:00.000Z",
        staffMember: { name: "Budi" },
      },
      fmt
    );

    expect(label).toBe("Budi · 09 Aug 03:00 – 15:30");
  });

  it("labels an open shift rather than showing a fabricated close time", () => {
    const label = formatShiftLabel(
      { openedAt: "2026-08-09T03:00:00.000Z", closedAt: null, staffMember: { name: "Budi" } },
      fmt
    );

    expect(label).toBe("Budi · 09 Aug 03:00 – still open");
  });

  it("omits the name prefix when the shift has no staff member", () => {
    const label = formatShiftLabel(
      { openedAt: "2026-08-09T03:00:00.000Z", closedAt: "2026-08-09T15:30:00.000Z" },
      fmt
    );

    expect(label).toBe("09 Aug 03:00 – 15:30");
  });
});
