import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, intlLocale: "en", dateLocale: undefined }),
}));

import {
  ScheduleWeekGrid,
  type ScheduleWeekGridEntry,
  type ScheduleWeekGridStaff,
} from "../schedule-week-grid";

const DAYS = [
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
];
const TODAY = "2026-09-23";

// Deliberately out of order: the grid sorts by role (OWNER, MANAGER, CASHIER,
// KITCHEN), then by name.
const STAFF: ScheduleWeekGridStaff[] = [
  { id: "st-zed", name: "Zed", role: "CASHIER" },
  { id: "st-amy", name: "Amy", role: "KITCHEN" },
  { id: "st-bob", name: "Bob", role: "OWNER" },
  { id: "st-al", name: "Al", role: "CASHIER" },
];

function entry(
  over: Partial<ScheduleWeekGridEntry> & { id: string; staffId: string; date: string }
): ScheduleWeekGridEntry {
  const { staffId, ...rest } = over;
  const name = STAFF.find((s) => s.id === staffId)!.name;
  return {
    scheduleShiftId: null,
    customStartTime: null,
    customEndTime: null,
    isDayOff: false,
    department: null,
    notes: null,
    status: "DRAFT",
    scheduleShift: null,
    staffMember: { id: staffId, name },
    ...rest,
  };
}

const MORNING = entry({
  id: "e-morning",
  staffId: "st-zed",
  // The API returns full ISO datetimes; the grid buckets on the first 10 chars.
  date: "2026-09-21T00:00:00.000Z",
  scheduleShiftId: "blk-am",
  scheduleShift: { name: "Morning", startTime: "08:00", endTime: "14:00", color: "#ff0000" },
  status: "PUBLISHED",
});
const CUSTOM = entry({
  id: "e-custom",
  staffId: "st-zed",
  date: "2026-09-22T00:00:00.000Z",
  customStartTime: "08:00",
  customEndTime: "10:00",
});
const DAY_OFF = entry({
  id: "e-off",
  staffId: "st-amy",
  date: "2026-09-23T00:00:00.000Z",
  isDayOff: true,
});
const EVENING = entry({
  id: "e-evening",
  staffId: "st-bob",
  date: "2026-09-24T00:00:00.000Z",
  scheduleShiftId: "blk-pm",
  scheduleShift: { name: "Evening", startTime: "16:00", endTime: "22:00", color: null },
});
const ENTRIES = [MORNING, CUSTOM, DAY_OFF, EVENING];

// Back Office's block filter, narrowed to the morning block (day-offs always stay).
const onlyMorning = (e: ScheduleWeekGridEntry) =>
  e.isDayOff || (e.scheduleShiftId != null && e.scheduleShiftId === "blk-am");

const bodyRows = () => screen.getAllByRole("row").slice(1);
const rowOf = (name: string) =>
  bodyRows().find((r) => within(r).getAllByRole("cell")[0].textContent === name)!;
/** The cell for `name` on `day`. */
const cellOf = (name: string, day: string) =>
  within(rowOf(name)).getAllByRole("cell")[DAYS.indexOf(day) + 1];

function renderEditable(props: Partial<Parameters<typeof ScheduleWeekGrid>[0]> = {}) {
  const handlers = { onDayClick: vi.fn(), onEntryClick: vi.fn(), onAddClick: vi.fn() };
  const view = render(
    <ScheduleWeekGrid
      days={DAYS}
      staff={STAFF}
      entries={ENTRIES}
      today={TODAY}
      showStatus
      {...handlers}
      {...props}
    />
  );
  return { ...view, ...handlers };
}

function renderReadOnly(props: Partial<Parameters<typeof ScheduleWeekGrid>[0]> = {}) {
  return render(
    <ScheduleWeekGrid
      days={DAYS}
      staff={STAFF}
      entries={ENTRIES}
      today={TODAY}
      showStatus={false}
      {...props}
    />
  );
}

describe("ScheduleWeekGrid — editable (Back Office)", () => {
  it("lists staff by role, then name", () => {
    renderEditable();
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Bob",
      "Al",
      "Zed",
      "Amy",
    ]);
  });

  it("puts each entry in its staff/day cell as a button that opens it", () => {
    const { onEntryClick } = renderEditable();

    const morning = within(cellOf("Zed", "2026-09-21")).getByRole("button", { name: /Morning/ });
    fireEvent.click(morning);
    expect(onEntryClick).toHaveBeenCalledWith("st-zed", "2026-09-21", "e-morning");

    expect(
      within(cellOf("Zed", "2026-09-22")).getByRole("button", { name: /08:00–10:00/ })
    ).toBeInTheDocument();
    expect(
      within(cellOf("Amy", "2026-09-23")).getByRole("button", { name: /pages\.scheduleDayOffOn/ })
    ).toBeInTheDocument();
    expect(
      within(cellOf("Bob", "2026-09-24")).getByRole("button", { name: /Evening/ })
    ).toBeInTheDocument();
  });

  it("tints a chip with its block's colour", () => {
    renderEditable();
    const morning = within(cellOf("Zed", "2026-09-21")).getByRole("button", { name: /Morning/ });
    expect(morning).toHaveStyle({ borderColor: "#ff0000" });
  });

  it("offers a + in every cell (occupied ones too) that adds for that staff/day", () => {
    const { onAddClick } = renderEditable();

    expect(screen.getAllByRole("button", { name: "pages.scheduleAddShift" })).toHaveLength(
      STAFF.length * DAYS.length
    );
    fireEvent.click(
      within(cellOf("Al", "2026-09-25")).getByRole("button", { name: "pages.scheduleAddShift" })
    );
    expect(onAddClick).toHaveBeenCalledWith("st-al", "2026-09-25");
  });

  it("badges worked shifts Draft/Published, never a day off", () => {
    renderEditable();

    expect(screen.getAllByText("pages.schedulePublishedBadge")).toHaveLength(1);
    expect(screen.getAllByText("pages.scheduleDraftBadge")).toHaveLength(2);
    expect(within(cellOf("Amy", "2026-09-23")).queryByText(/Badge/)).toBeNull();
  });

  it("under a block filter, a cell holding only hidden entries shows a dot instead of +", () => {
    renderEditable({ matches: onlyMorning });

    // Custom 08-10 and Evening don't match: gone, each cell marked by a dot.
    expect(screen.queryByRole("button", { name: /08:00–10:00/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Evening/ })).toBeNull();
    for (const [name, day] of [
      ["Zed", "2026-09-22"],
      ["Bob", "2026-09-24"],
    ]) {
      const cell = cellOf(name, day);
      expect(within(cell).getByTestId("schedule-hidden-entry")).toBeInTheDocument();
      expect(within(cell).queryByRole("button", { name: "pages.scheduleAddShift" })).toBeNull();
    }
    expect(screen.getAllByTestId("schedule-hidden-entry")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "pages.scheduleAddShift" })).toHaveLength(
      STAFF.length * DAYS.length - 2
    );

    // Matching entries (and day-offs, which the filter always keeps) stay.
    expect(screen.getByRole("button", { name: /Morning/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pages\.scheduleDayOffOn/ })).toBeInTheDocument();
  });

  it("opens a day from its header, and highlights today's", () => {
    const { onDayClick } = renderEditable();
    const headers = within(screen.getAllByRole("row")[0]).getAllByRole("button");

    expect(headers).toHaveLength(DAYS.length);
    fireEvent.click(headers[4]);
    expect(onDayClick).toHaveBeenCalledWith("2026-09-25");
    expect(headers[DAYS.indexOf(TODAY)]).toHaveClass("text-primary");
    expect(headers[0]).not.toHaveClass("text-primary");
    // 40px touch target.
    expect(headers[0]).toHaveClass("min-h-10");
  });

  it("keeps the wide-table scroll wrapper and the 840px / 100px-per-day floor", () => {
    const { container, unmount } = renderEditable();
    expect(container.firstElementChild).toHaveClass("-mx-4", "overflow-x-auto", "sm:mx-0");
    expect(screen.getByRole("table")).toHaveStyle({ minWidth: "840px" });
    unmount();

    const tenDays = [...DAYS, "2026-09-28", "2026-09-29", "2026-09-30"];
    renderEditable({ days: tenDays });
    expect(screen.getByRole("table")).toHaveStyle({ minWidth: `${140 + 10 * 100}px` });
  });

  it("pins the staff-name column on the card surface Back Office renders on", () => {
    renderEditable();

    // PageShell's panel is bg-card; a bg-background fill would paint a
    // visible stripe down the name column.
    const cells = [
      within(screen.getAllByRole("row")[0]).getAllByRole("columnheader")[0],
      ...bodyRows().map((row) => within(row).getAllByRole("cell")[0]),
    ];
    for (const cell of cells) {
      expect(cell).toHaveClass("sticky", "left-0", "z-10", "bg-card");
      expect(cell).not.toHaveClass("bg-background");
    }
  });

  it("labels each day with its own weekday for a viewer west of UTC", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      renderEditable();
      // 2026-09-25 is a Friday; read in New York time, UTC midnight is still
      // Thursday evening.
      const headers = within(screen.getAllByRole("row")[0]).getAllByRole("button");
      expect(headers[DAYS.indexOf("2026-09-25")]).toHaveTextContent("Fri");
      expect(headers[DAYS.indexOf("2026-09-21")]).toHaveTextContent("Mon");
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });
});

describe("ScheduleWeekGrid — read-only", () => {
  it("shows the same chips as plain, non-interactive blocks", () => {
    renderReadOnly({ onDayClick: vi.fn() });

    const chips = screen.getAllByTestId("schedule-chip");
    expect(chips).toHaveLength(ENTRIES.length);
    for (const chip of chips) expect(chip.tagName).toBe("DIV");
    expect(within(cellOf("Zed", "2026-09-21")).getByText("Morning")).toBeInTheDocument();
    expect(within(cellOf("Zed", "2026-09-22")).getByText("08:00–10:00")).toBeInTheDocument();

    // Only the day headers are buttons — no chip or add buttons.
    expect(screen.getAllByRole("button")).toHaveLength(DAYS.length);
    expect(screen.queryByRole("button", { name: "pages.scheduleAddShift" })).toBeNull();
  });

  it("never shows the hidden-entry dot, even when `matches` hides entries", () => {
    renderReadOnly({ matches: onlyMorning });

    expect(screen.queryByTestId("schedule-hidden-entry")).toBeNull();
    expect(screen.queryByText("08:00–10:00")).toBeNull();
    expect(screen.getAllByTestId("schedule-chip")).toHaveLength(2);
  });

  it("hides status badges when showStatus is off", () => {
    renderReadOnly();
    expect(screen.queryByText("pages.schedulePublishedBadge")).toBeNull();
    expect(screen.queryByText("pages.scheduleDraftBadge")).toBeNull();
  });

  it("can still show status badges when asked", () => {
    renderReadOnly({ showStatus: true });
    expect(screen.getAllByText("pages.schedulePublishedBadge")).toHaveLength(1);
  });

  it("day headers still open the day", () => {
    const onDayClick = vi.fn();
    renderReadOnly({ onDayClick });

    fireEvent.click(within(screen.getAllByRole("row")[0]).getAllByRole("button")[0]);
    expect(onDayClick).toHaveBeenCalledWith("2026-09-21");
  });

  it("without onDayClick there is nothing to tap at all", () => {
    renderReadOnly();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("09-21")).toBeInTheDocument();
  });

  it("pins the staff-name column while the days scroll", () => {
    renderReadOnly();

    const nameHeader = within(screen.getAllByRole("row")[0]).getAllByRole("columnheader")[0];
    expect(nameHeader).toHaveClass("sticky", "left-0", "z-10", "bg-background");
    for (const row of bodyRows()) {
      expect(within(row).getAllByRole("cell")[0]).toHaveClass(
        "sticky",
        "left-0",
        "z-10",
        "bg-background"
      );
    }
  });

  it("uses the narrower 120px + 88px-per-day minimum width", () => {
    renderReadOnly();
    expect(screen.getByRole("table")).toHaveStyle({ minWidth: `${120 + 7 * 88}px` });
  });
});
