import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
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
vi.mock("@/components/ui/date-range-field", () => ({
  DateRangeField: () => <div data-testid="range" />,
}));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import { ShiftsClient } from "../shifts-client";

const get = vi.mocked(apiClient.get);

const STAFF = [{ id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" }];

function row(overrides: Record<string, unknown> = {}) {
  return {
    shiftId: "clshift000000000000000001",
    staffId: "clstaff000000000000000001",
    staffName: "Sam",
    // No "Z": local time, so same-day vs overnight doesn't depend on the runner's zone.
    openedAt: "2026-09-18T10:00:00",
    closedAt: "2026-09-18T18:00:00",
    isOpen: false,
    isFlagged: false,
    openingCash: 50_000,
    cashSales: 80_000,
    cashRefunds: 0,
    tips: 0,
    pettyIn: 0,
    pettyOut: 0,
    drops: 0,
    tipPayouts: 0,
    unlinkedCashSales: 0,
    expectedCash: 130_000,
    closingCash: 130_000,
    cashDifference: 0,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ShiftsClient storeId="s1" staff={STAFF} />
    </QueryClientProvider>
  );
}

const reportCalls = () =>
  get.mock.calls.filter(([url]) => String(url).endsWith("/finance/cash-reconciliation"));
const logCalls = () => get.mock.calls.filter(([url]) => String(url).endsWith("/schedule/log"));

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) =>
    url.endsWith("/finance/cash-reconciliation") ? { shifts: [row()] } : { records: [] }
  );
});

describe("ShiftsClient — the shift report", () => {
  it("reads the store's cash reconciliation for the chosen period", async () => {
    renderPage();
    await screen.findByText("Sam");

    const [url, params] = reportCalls()[0] as [string, Record<string, string>];
    expect(url).toBe("/stores/s1/finance/cash-reconciliation");
    expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(params.to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(params.staffId).toBeUndefined();
  });

  it("one row per shift: who, when, the opening cash, what it should hold and what was counted", async () => {
    renderPage();
    const shift = (await screen.findByText("Sam")).closest("tr")!;

    expect(
      within(shift).getByText("DT(2026-09-18T10:00:00) – T(2026-09-18T18:00:00)")
    ).toBeInTheDocument();
    expect(within(shift).getByText("IDR 50000")).toBeInTheDocument(); // opening cash
    expect(within(shift).getByText("IDR 80000")).toBeInTheDocument(); // cash sales
    expect(within(shift).getAllByText("IDR 130000")).toHaveLength(2); // expected + counted
    expect(within(shift).getByText("pos.shift.differenceBalanced")).toBeInTheDocument();
  });

  it("a short drawer is flagged: red row, the amount with no sign, and counted in the summary", async () => {
    get.mockImplementation(async (url: string) =>
      url.endsWith("/finance/cash-reconciliation")
        ? {
            shifts: [
              row({ isFlagged: true, closingCash: 125_000, cashDifference: -5_000 }),
              row({ shiftId: "clshift000000000000000002", staffName: "Alex" }),
            ],
          }
        : { records: [] }
    );
    renderPage();
    const shift = (await screen.findByText("Sam")).closest("tr")!;

    expect(shift.className).toContain("bg-destructive/5");
    const chip = within(shift).getByText("pos.shift.differenceShort IDR 5000");
    expect(chip.className).toContain("text-destructive");

    // Summary strip: 2 shifts, 1 that doesn't balance, net −5000.
    expect(screen.getByText("pages.shiftsStatShifts").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("pages.shiftsStatFlagged").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("pages.shiftsStatNet").nextElementSibling).toHaveTextContent(
      "IDR -5000"
    );
  });

  it("a shift still open says so and shows no count or difference yet — not an invented zero", async () => {
    get.mockImplementation(async (url: string) =>
      url.endsWith("/finance/cash-reconciliation")
        ? {
            shifts: [
              row({ isOpen: true, closedAt: null, closingCash: null, cashDifference: null }),
            ],
          }
        : { records: [] }
    );
    renderPage();
    const shift = (await screen.findByText("Sam")).closest("tr")!;

    expect(within(shift).getByText("pages.financeShiftStatusOpen")).toBeInTheDocument();
    expect(within(shift).queryByText(/pos\.shift\.difference/)).toBeNull();
    // Counted and Difference cells: dashes.
    expect(within(shift).getAllByText("—")).toHaveLength(2);
  });

  it("each shift links to its full report in a new tab, for reading", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /pos\.shift\.openReport/ });

    expect(link).toHaveAttribute(
      "href",
      "/store/s1/pos/orders/daily-report?shiftId=clshift000000000000000001&print=0"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("an overnight shift repeats the date on its end time", async () => {
    get.mockImplementation(async (url: string) =>
      url.endsWith("/finance/cash-reconciliation")
        ? { shifts: [row({ openedAt: "2026-09-18T22:00:00", closedAt: "2026-09-19T02:10:00" })] }
        : { records: [] }
    );
    renderPage();
    expect(
      await screen.findByText("DT(2026-09-18T22:00:00) – DT(2026-09-19T02:10:00)")
    ).toBeInTheDocument();
  });

  it("no shifts in the period, and a failed load, each say so", async () => {
    get.mockResolvedValue({ shifts: [] });
    const { unmount } = renderPage();
    expect(await screen.findByText("pages.noData")).toBeInTheDocument();
    expect(screen.queryByText("pages.shiftsStatShifts")).toBeNull();
    unmount();

    get.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("pages.financeLoadError")).toBeInTheDocument();
  });
});

describe("ShiftsClient — the cash log", () => {
  const openCashLog = () =>
    fireEvent.mouseDown(screen.getByRole("tab", { name: "pages.shiftsCashLogTab" }), {
      button: 0,
    });

  it("is not fetched until its tab is opened", async () => {
    renderPage();
    await screen.findByText("Sam");
    expect(logCalls()).toHaveLength(0);
  });

  it("asks for the cash kinds ONLY — the shifts page never mixes attendance back in", async () => {
    renderPage();
    await screen.findByText("Sam");
    openCashLog();

    await waitFor(() => expect(logCalls()).toHaveLength(1));
    const [url, params] = logCalls()[0] as [string, Record<string, string>];
    expect(url).toBe("/stores/s1/schedule/log");
    expect(params.type).toBe("CASH_IN,CASH_OUT");
  });

  it("shows each movement's amount and the reason the money moved", async () => {
    get.mockImplementation(async (url: string) =>
      url.endsWith("/schedule/log")
        ? {
            records: [
              {
                id: "movement-1",
                timestamp: "2026-09-18T12:30:00",
                staffName: "Sam",
                type: "CASH_OUT",
                notes: "Ice delivery",
                amount: 25_000,
              },
            ],
          }
        : { shifts: [row()] }
    );
    renderPage();
    await screen.findByText("Sam");
    openCashLog();

    expect(await screen.findByText("IDR 25000")).toBeInTheDocument();
    expect(screen.getByText("Ice delivery")).toBeInTheDocument();
    expect(screen.getByText("clockInOut.typeCashOut")).toBeInTheDocument();
  });
});

describe("ShiftsClient — the cash log labels what a row IS", () => {
  const openCashLog = () =>
    fireEvent.mouseDown(screen.getByRole("tab", { name: "pages.shiftsCashLogTab" }), {
      button: 0,
    });
  const record = (overrides: Record<string, unknown>) => ({
    id: "x",
    timestamp: "2026-09-18T10:00:00",
    staffName: "Sam",
    type: "CASH_IN",
    origin: "movement",
    notes: null,
    amount: 1000,
    ...overrides,
  });

  // A shift's opening float and its closing COUNT are statements of what is in the drawer,
  // not money crossing it. Labelled "Cash In" / "Cash Out" they read as movements, and a
  // manager summing the tab counted balances twice.
  it("a shift's float and count are not labelled Cash In / Cash Out — only a real movement is", async () => {
    get.mockImplementation(async (url: string) =>
      url.endsWith("/schedule/log")
        ? {
            records: [
              record({ id: "s1-in", type: "CASH_IN", origin: "shift-open", amount: 50_000 }),
              record({
                id: "s1-out",
                type: "CASH_OUT",
                origin: "shift-close",
                amount: 125_000,
                notes: "short 5k",
              }),
              record({
                id: "movement-1",
                type: "CASH_OUT",
                origin: "movement",
                amount: 25_000,
                notes: "Ice delivery",
              }),
            ],
          }
        : { shifts: [row()] }
    );
    renderPage();
    await screen.findByText("Sam");
    openCashLog();

    expect(await screen.findByText("pages.shiftsCashOpened")).toBeInTheDocument();
    expect(screen.getByText("pages.shiftsCashClosed")).toBeInTheDocument();
    // Exactly one row is a genuine movement, so exactly one Cash Out badge — and no Cash In.
    expect(screen.getAllByText("clockInOut.typeCashOut")).toHaveLength(1);
    expect(screen.queryByText("clockInOut.typeCashIn")).toBeNull();
    expect(screen.getByText("short 5k")).toBeInTheDocument();
  });
});
