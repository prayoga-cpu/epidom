import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const STRINGS: Record<string, string> = {
  "pos.shift.orderCount": "{n} orders",
  "pos.shift.orderCountOne": "1 order",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => STRINGS[k] ?? k,
    formatDateTime: (d: string) => `DT(${d})`,
    formatTimeOnly: (d: string) => `T(${d})`,
  }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c} ${v}`,
  }),
}));

const mockHistory = vi.fn();
vi.mock("@/features/pos/hooks/use-shift-history", () => ({
  useShiftHistory: (...args: unknown[]) => mockHistory(...args),
}));

import { ShiftHistoryList } from "../shift/shift-history-list";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "clshift000000000000000001",
    // No "Z": local time, so same-day/overnight doesn't depend on the runner's zone.
    openedAt: "2026-09-18T10:00:00",
    closedAt: "2026-09-18T18:00:00",
    openingCash: "50000.00",
    closingCash: "130000.00",
    expectedCash: "130000.00",
    cashDifference: "0.00",
    notes: null,
    staffMember: { id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" },
    _count: { orders: 12 },
    ...overrides,
  };
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    data: { shifts: [item()], total: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockHistory.mockReset();
  mockHistory.mockReturnValue(state());
});

describe("ShiftHistoryList — rows", () => {
  it("shows who ran each shift, its orders, the counted cash and how the drawer closed", () => {
    render(<ShiftHistoryList storeId="s1" />);
    const row = screen.getByRole("link");

    expect(within(row).getByText(/Sam · 12 orders/)).toBeInTheDocument();
    expect(within(row).getByText("IDR 130000")).toBeInTheDocument();
    expect(within(row).getByText("pos.shift.differenceBalanced")).toBeInTheDocument();
  });

  it("an over or short drawer names the amount without a sign, in its own colour", () => {
    mockHistory.mockReturnValue(
      state({
        data: {
          shifts: [
            item({ id: "clshift000000000000000001", cashDifference: "-5000.00" }),
            item({ id: "clshift000000000000000002", cashDifference: "2500.00" }),
          ],
          total: 2,
        },
      })
    );
    render(<ShiftHistoryList storeId="s1" />);

    const short = screen.getByText("pos.shift.differenceShort IDR 5000");
    const over = screen.getByText("pos.shift.differenceOver IDR 2500");
    expect(short.className).toContain("text-destructive");
    expect(over.className).toContain("amber");
  });

  it("no closing difference on record: no chip rather than an invented 'Balanced'", () => {
    mockHistory.mockReturnValue(
      state({ data: { shifts: [item({ cashDifference: null })], total: 1 } })
    );
    render(<ShiftHistoryList storeId="s1" />);

    expect(screen.queryByText(/pos\.shift\.difference/)).toBeNull();
  });

  it("a single order is '1 order', not '1 orders'", () => {
    mockHistory.mockReturnValue(
      state({ data: { shifts: [item({ _count: { orders: 1 } })], total: 1 } })
    );
    render(<ShiftHistoryList storeId="s1" />);
    expect(screen.getByText(/Sam · 1 order$/)).toBeInTheDocument();
  });

  it("each row opens that shift's report in a new tab, for reading (no print dialog)", () => {
    render(<ShiftHistoryList storeId="s1" />);
    const link = screen.getByRole("link");

    expect(link).toHaveAttribute(
      "href",
      "/store/s1/pos/orders/daily-report?shiftId=clshift000000000000000001&print=0"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // AGENTS.md: the whole row is the tap target, at least 44px.
    expect(link.className).toContain("min-h-14");
    expect(link.className).toContain("touch-manipulation");
  });
});

describe("ShiftHistoryList — the time range", () => {
  it("a same-day shift shows the date once, then just the end time", () => {
    render(<ShiftHistoryList storeId="s1" />);
    expect(
      screen.getByText("DT(2026-09-18T10:00:00) – T(2026-09-18T18:00:00)")
    ).toBeInTheDocument();
  });

  it("an overnight shift repeats the date on the end, so '– 2:10 AM' isn't read as the same evening", () => {
    mockHistory.mockReturnValue(
      state({
        data: {
          shifts: [item({ openedAt: "2026-09-18T22:00:00", closedAt: "2026-09-19T02:10:00" })],
          total: 1,
        },
      })
    );
    render(<ShiftHistoryList storeId="s1" />);
    expect(
      screen.getByText("DT(2026-09-18T22:00:00) – DT(2026-09-19T02:10:00)")
    ).toBeInTheDocument();
  });
});

describe("ShiftHistoryList — states", () => {
  it("empty: says there are no finished shifts and draws no list", () => {
    mockHistory.mockReturnValue(state({ data: { shifts: [], total: 0 } }));
    render(<ShiftHistoryList storeId="s1" />);

    expect(screen.getByText("pos.shift.historyEmpty")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("loading: neither the list nor a false 'no shifts yet'", () => {
    mockHistory.mockReturnValue(state({ data: undefined, isLoading: true }));
    render(<ShiftHistoryList storeId="s1" />);

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("pos.shift.historyEmpty")).toBeNull();
  });

  it("a failed load with nothing cached offers a retry", () => {
    const refetch = vi.fn();
    mockHistory.mockReturnValue(state({ data: undefined, isError: true, refetch }));
    render(<ShiftHistoryList storeId="s1" />);

    expect(screen.getByText("pos.shift.historyLoadFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("a failed refresh keeps showing what was already loaded", () => {
    mockHistory.mockReturnValue(state({ isError: true }));
    render(<ShiftHistoryList storeId="s1" />);

    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.queryByText("pos.shift.historyLoadFailed")).toBeNull();
  });
});

describe("ShiftHistoryList — paging", () => {
  it("asks for the first ten, and 'Show more' asks for ten more", () => {
    mockHistory.mockReturnValue(state({ data: { shifts: [item()], total: 25 } }));
    render(<ShiftHistoryList storeId="s1" />);
    expect(mockHistory).toHaveBeenLastCalledWith("s1", 10);

    fireEvent.click(screen.getByRole("button", { name: "pos.shift.historyMore" }));
    expect(mockHistory).toHaveBeenLastCalledWith("s1", 20);
  });

  it("no 'Show more' once everything is loaded", () => {
    mockHistory.mockReturnValue(state({ data: { shifts: [item()], total: 1 } }));
    render(<ShiftHistoryList storeId="s1" />);
    expect(screen.queryByRole("button", { name: "pos.shift.historyMore" })).toBeNull();
  });

  it("'Show more' is disabled while the larger page loads, so a double tap can't skip a page", () => {
    mockHistory.mockReturnValue(state({ data: { shifts: [item()], total: 25 }, isFetching: true }));
    render(<ShiftHistoryList storeId="s1" />);
    expect(screen.getByRole("button", { name: "pos.shift.historyMore" })).toBeDisabled();
  });
});
