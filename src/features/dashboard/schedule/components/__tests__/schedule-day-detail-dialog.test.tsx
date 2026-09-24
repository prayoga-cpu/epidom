import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, dateLocale: undefined }),
}));

import { ScheduleDayDetailDialog } from "../schedule-day-detail-dialog";

const BASE = {
  scheduleShiftId: null,
  customStartTime: null,
  customEndTime: null,
  isDayOff: false,
  department: null,
  notes: null,
  status: "DRAFT" as const,
  scheduleShift: null,
};

const ENTRIES = [
  {
    ...BASE,
    id: "e-1",
    date: "2026-09-25T00:00:00.000Z",
    staffMember: { id: "st-1", name: "Sam" },
    scheduleShiftId: "blk-am",
    scheduleShift: { name: "Morning", startTime: "08:00", endTime: "14:00", color: null },
    department: "KITCHEN" as const,
    notes: "Cover for Ana",
    status: "PUBLISHED" as const,
  },
  {
    ...BASE,
    id: "e-2",
    date: "2026-09-25T00:00:00.000Z",
    staffMember: { id: "st-2", name: "Rin" },
    isDayOff: true,
  },
];

function renderDialog(hideManagerDetails?: boolean) {
  return render(
    <ScheduleDayDetailDialog
      open
      onOpenChange={() => {}}
      dateKey="2026-09-25"
      entries={ENTRIES}
      hideManagerDetails={hideManagerDetails}
    />
  );
}

describe("ScheduleDayDetailDialog", () => {
  it("titles the dialog with the formatted date, not the raw key", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Friday 25 Sep 2026" })).toBeInTheDocument();
    expect(screen.queryByText("2026-09-25")).toBeNull();
  });

  it("by default (Back Office) shows notes and the Draft/Published badge", () => {
    renderDialog();

    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Morning (08:00–14:00)")).toBeInTheDocument();
    expect(screen.getByText("pages.scheduleDepartment: KITCHEN")).toBeInTheDocument();
    expect(screen.getByText("Cover for Ana")).toBeInTheDocument();
    expect(screen.getByText("pages.schedulePublishedBadge")).toBeInTheDocument();
    expect(screen.getByText("pages.scheduleDraftBadge")).toBeInTheDocument();
  });

  it("hideManagerDetails drops notes and status badges but keeps who works what", () => {
    renderDialog(true);

    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Morning (08:00–14:00)")).toBeInTheDocument();
    expect(screen.getByText("pages.scheduleDepartment: KITCHEN")).toBeInTheDocument();
    expect(screen.getByText("Rin")).toBeInTheDocument();
    expect(screen.getByText("pages.scheduleDayOffOn")).toBeInTheDocument();

    expect(screen.queryByText("Cover for Ana")).toBeNull();
    expect(screen.queryByText("pages.schedulePublishedBadge")).toBeNull();
    expect(screen.queryByText("pages.scheduleDraftBadge")).toBeNull();
  });

  it("says so when nobody is on that day", () => {
    render(
      <ScheduleDayDetailDialog open onOpenChange={() => {}} dateKey="2026-09-25" entries={[]} />
    );
    expect(screen.getByText("pages.noData")).toBeInTheDocument();
  });
});
