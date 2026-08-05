import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        "common.datePicker.pickDateRange": "Pick a date range",
        "common.datePicker.presets.today": "Today",
        "common.datePicker.presets.yesterday": "Yesterday",
        "common.datePicker.presets.last7Days": "Last 7 days",
        "common.datePicker.presets.last30Days": "Last 30 days",
        "common.datePicker.presets.thisMonth": "This month",
      };
      return map[k] ?? k;
    },
  }),
}));

// Radix Popover relies on portal/position APIs jsdom doesn't implement — render
// content inline instead, matching the pattern used for notification-bell.test.tsx.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => (asChild ? children : <div>{children}</div>),
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

// Stub the calendar grid itself — its day-cell layout depends on the current
// real-world month, which would make a full drag-select test date-flaky. What
// matters here is that DateRangeField wires `selected`/`onSelect` correctly.
vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ selected, onSelect }: any) => (
    <div data-testid="calendar" data-selected={JSON.stringify(selected)}>
      <button onClick={() => onSelect({ from: new Date(2026, 7, 6) })}>pick-start</button>
      <button onClick={() => onSelect({ from: new Date(2026, 7, 6), to: new Date(2026, 7, 22) })}>
        pick-end
      </button>
    </div>
  ),
}));

import { DateRangeField } from "@/components/ui/date-range-field";
import { resolveDateRangePreset } from "@/lib/utils/date-range";

describe("DateRangeField", () => {
  it("shows a placeholder when no range is selected", () => {
    render(<DateRangeField from="" to="" onChange={vi.fn()} />);
    expect(screen.getByText("Pick a date range")).toBeTruthy();
  });

  it("labels a recognized preset by name instead of raw dates", () => {
    const { from, to } = resolveDateRangePreset("last7Days");
    render(<DateRangeField from={from} to={to} onChange={vi.fn()} />);
    // Appears both as the trigger label and as the now-active preset button.
    expect(screen.getAllByText("Last 7 days").length).toBeGreaterThan(0);
  });

  it("labels a non-preset range as formatted dates", () => {
    // Fixed past dates that can never collide with a "today"-relative preset,
    // regardless of which real-world day the test suite runs on.
    render(<DateRangeField from="2000-01-10" to="2000-01-20" onChange={vi.fn()} />);
    expect(screen.getByText("10 Jan 2000 - 20 Jan 2000")).toBeTruthy();
  });

  it("clicking a preset commits its resolved from/to", () => {
    const onChange = vi.fn();
    render(<DateRangeField from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Today"));
    expect(onChange).toHaveBeenCalledWith(...Object.values(resolveDateRangePreset("today")));
  });

  it("hides the preset row when presets=[]", () => {
    render(<DateRangeField from="" to="" onChange={vi.fn()} presets={[]} />);
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("only commits once both ends of a calendar range are picked", () => {
    const onChange = vi.fn();
    render(<DateRangeField from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByText("pick-start"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("pick-end"));
    expect(onChange).toHaveBeenCalledWith("2026-08-06", "2026-08-22");
  });
});
