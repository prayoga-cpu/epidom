import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    formatDayDate: () => "",
    formatTimeOnly: () => "",
  }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "IDR", formatPrice: (v: number) => String(v) }),
}));
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(url.search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/pwa/thermal-printer", () => ({
  isBluetoothSupported: () => false,
  isPrinterConnected: () => false,
  printShiftReport: vi.fn(),
}));

// The filters the tab hands the query hook — that is what actually reaches the server.
const captured = vi.hoisted(() => ({ filters: null as any }));
vi.mock("../../hooks/use-order-history", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/use-order-history")>()),
  useOrderHistory: (_storeId: string, filters: unknown) => {
    captured.filters = filters;
    return {
      data: { pages: [{ orders: [], totalCount: 0, nextCursor: null }] },
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
  },
  useOrderPaymentTotals: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock("../../hooks/use-pos-menu", () => ({ usePosMenu: () => ({ data: undefined }) }));
vi.mock("../../hooks/use-pos-staff-list", () => ({ usePosStaffList: () => ({ data: [] }) }));
vi.mock("../../hooks/use-store-shifts", () => ({ useStoreShifts: () => ({ data: [] }) }));
vi.mock("../../hooks/use-update-order-status", () => ({
  useUpdateOrderStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../hooks/use-printer-settings", () => ({
  usePrinterSettings: Object.assign(
    (select: (s: unknown) => unknown) => select({ printers: { MAIN: { paperWidth: 32 } } }),
    { getState: () => ({ connect: vi.fn() }) }
  ),
}));
vi.mock("../order-history-detail-dialog", () => ({ OrderHistoryDetailDialog: () => null }));
vi.mock("../mark-paid-dialog", () => ({ MarkPaidDialog: () => null }));

import {
  HISTORY_FILTERS_DEFAULTS,
  OrderHistoryTab,
  resolveHistoryRange,
  sanitizeHistoryFilters,
} from "../order-history-tab";
import { localDateKey } from "../../lib/date-range-presets";

const STORAGE_KEY = "epidom-pos-history-filters-store-1";
const persist = (state: object) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const dayKey = (offsetDays: number) => {
  const d = new Date();
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays));
};

async function renderHistory() {
  // usePersistedState applies its saved value in a mount effect; let it land.
  await act(async () => {
    render(<OrderHistoryTab storeId="store-1" />);
  });
}

const dateSelect = () => screen.getByRole("combobox", { name: "pos.filters.dateRange" });
const resetButton = () => screen.queryByRole("button", { name: /pos\.filters\.resetToToday/ });

beforeEach(() => {
  localStorage.clear();
  url.search = "";
  captured.filters = null;
});

describe("OrderHistoryTab — opens on today", () => {
  it("queries today's orders on the user's own calendar day", async () => {
    await renderHistory();
    expect(captured.filters.from).toBe(dayKey(0));
    expect(captured.filters.to).toBe(dayKey(0));
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
  });

  it("has no reset button while on today", async () => {
    await renderHistory();
    expect(resetButton()).toBeNull();
  });

  it("shows the date control without anyone adding it, and it cannot be removed", async () => {
    await renderHistory();
    expect(dateSelect()).toBeInTheDocument();
    // A removable chip would carry a "remove filter" control; the date has none.
    expect(screen.queryByTitle("pos.filters.removeFilter")).toBeNull();
  });
});

describe("OrderHistoryTab — saved filters", () => {
  it("gives someone who saved filters before 'today' existed the new default, keeping their other filters", async () => {
    // What every user who ever touched a filter has saved: no version, date = all-time.
    persist({
      status: "READY",
      datePreset: "all",
      from: "",
      to: "",
      unpaidOnly: false,
      activeFilterKeys: ["status", "dateRange"],
    });
    await renderHistory();
    expect(captured.filters.status).toBe("READY");
    expect(captured.filters.from).toBe(dayKey(0));
    expect(captured.filters.to).toBe(dayKey(0));
  });

  it("keeps a deliberate All time saved at the current version, and offers the way back", async () => {
    persist({ ...HISTORY_FILTERS_DEFAULTS, datePreset: "all" });
    await renderHistory();
    expect(captured.filters.from).toBe("");
    expect(captured.filters.to).toBe("");
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.all");

    fireEvent.click(resetButton()!);
    expect(captured.filters.from).toBe(dayKey(0));
    expect(captured.filters.to).toBe(dayKey(0));
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
    expect(resetButton()).toBeNull();
  });

  it("re-resolves a saved 'Today' against the CURRENT day, so it never goes stale overnight", async () => {
    persist({
      ...HISTORY_FILTERS_DEFAULTS,
      datePreset: "today",
      from: "2020-01-01",
      to: "2020-01-01",
    });
    await renderHistory();
    expect(captured.filters.from).toBe(dayKey(0));
    expect(captured.filters.to).toBe(dayKey(0));
  });

  it("queries yesterday for the yesterday preset, and offers the reset", async () => {
    persist({ ...HISTORY_FILTERS_DEFAULTS, datePreset: "yesterday" });
    await renderHistory();
    expect(captured.filters.from).toBe(dayKey(-1));
    expect(captured.filters.to).toBe(dayKey(-1));
    expect(resetButton()).not.toBeNull();
  });

  it("the reset also drops a selected shift, which would otherwise keep driving the daily report", async () => {
    persist({
      ...HISTORY_FILTERS_DEFAULTS,
      datePreset: "custom",
      from: "2026-09-01T01:00:00.000Z",
      to: "2026-09-01T09:00:00.000Z",
      shiftId: "shift-1",
      activeFilterKeys: ["shift"],
    });
    await renderHistory();
    expect(captured.filters.from).toBe("2026-09-01T01:00:00.000Z"); // the shift's exact window
    fireEvent.click(resetButton()!);
    expect(captured.filters.from).toBe(dayKey(0));
    expect(captured.filters.to).toBe(dayKey(0));
  });
});

describe("OrderHistoryTab — a deep link to one order", () => {
  it("opens on All time, since the order may not be from today", async () => {
    url.search = "tab=history&order=order-from-last-week";
    await renderHistory();
    expect(captured.filters.from).toBe("");
    expect(captured.filters.to).toBe("");
  });
});

describe("sanitizeHistoryFilters", () => {
  it("falls back to the defaults for anything that isn't an object", () => {
    expect(sanitizeHistoryFilters(null, HISTORY_FILTERS_DEFAULTS)).toEqual(
      HISTORY_FILTERS_DEFAULTS
    );
    expect(sanitizeHistoryFilters("junk", HISTORY_FILTERS_DEFAULTS)).toEqual(
      HISTORY_FILTERS_DEFAULTS
    );
  });

  it("defaults to today, not all time", () => {
    expect(HISTORY_FILTERS_DEFAULTS.datePreset).toBe("today");
  });

  it("takes the new date default from an unversioned state, and drops the shift that drove the old window", () => {
    const out = sanitizeHistoryFilters(
      {
        status: "READY",
        datePreset: "custom",
        from: "2026-09-01T01:00:00.000Z",
        to: "2026-09-01T09:00:00.000Z",
        shiftId: "shift-1",
        activeFilterKeys: ["status", "dateRange", "shift"],
      },
      HISTORY_FILTERS_DEFAULTS
    );
    expect(out.status).toBe("READY");
    expect(out.datePreset).toBe("today");
    expect(out.from).toBe("");
    expect(out.to).toBe("");
    expect(out.shiftId).toBe("ALL");
    // "dateRange" is no longer an optional filter, so a saved one is dropped.
    expect(out.activeFilterKeys).toEqual(["status", "shift"]);
  });

  it("keeps everything from a state saved at the current version", () => {
    const saved = {
      ...HISTORY_FILTERS_DEFAULTS,
      datePreset: "custom" as const,
      from: "2026-09-01",
      to: "2026-09-07",
    };
    expect(sanitizeHistoryFilters(saved, HISTORY_FILTERS_DEFAULTS)).toEqual(saved);
  });

  it("does not take a made-up preset at its word", () => {
    const out = sanitizeHistoryFilters(
      { ...HISTORY_FILTERS_DEFAULTS, datePreset: "next-century" },
      HISTORY_FILTERS_DEFAULTS
    );
    expect(out.datePreset).toBe("today");
  });
});

describe("resolveHistoryRange", () => {
  const NOW = new Date(2026, 8, 19, 15, 0, 0);

  it("derives a preset's dates from the day it is NOW, whatever was saved beside it", () => {
    expect(resolveHistoryRange("today", "2020-01-01", "2020-01-01", NOW)).toEqual({
      from: "2026-09-19",
      to: "2026-09-19",
    });
    expect(resolveHistoryRange("last7", "", "", NOW)).toEqual({
      from: "2026-09-13",
      to: "2026-09-19",
    });
  });

  it("is unbounded for all time", () => {
    expect(resolveHistoryRange("all", "2026-01-01", "2026-01-02", NOW)).toEqual({
      from: "",
      to: "",
    });
  });

  it("uses exactly what was stored for a custom range, datetimes included", () => {
    expect(resolveHistoryRange("custom", "2026-09-01", "2026-09-07", NOW)).toEqual({
      from: "2026-09-01",
      to: "2026-09-07",
    });
    expect(
      resolveHistoryRange("custom", "2026-09-01T01:00:00.000Z", "2026-09-01T09:00:00.000Z", NOW)
    ).toEqual({ from: "2026-09-01T01:00:00.000Z", to: "2026-09-01T09:00:00.000Z" });
  });
});
