import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c ?? ""} ${v}`,
  }),
}));
// A query string a test can set — e.g. "unpaid=1", the link the unpaid alert opens.
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(url.search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

const queue = vi.hoisted(() => ({ orders: [] as any[] }));
vi.mock("../../hooks/use-pos-orders", () => ({
  usePosOrders: () => ({ data: queue.orders, isLoading: false }),
}));
vi.mock("../../hooks/use-pos-staff-list", () => ({ usePosStaffList: () => ({ data: [] }) }));
vi.mock("../../hooks/use-update-order-status", () => ({
  useUpdateOrderStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../hooks/use-kds-settings", () => ({
  useKdsSettings: () => ({ data: { kitchenDisplayEnabled: true }, isLoading: false }),
  useUpdateKdsSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// The store's open till, if any — null is "No shift".
const till = vi.hoisted(() => ({ shift: null as { id: string; openedAt: string } | null }));
vi.mock("../../hooks/use-active-shift", () => ({
  useActiveShift: () => ({ shift: till.shift, allowed: true, known: true }),
}));
// The Log is its own tab's business; here it only has to show up when picked.
vi.mock("../order-history-tab", () => ({
  OrderHistoryTab: () => <div data-testid="order-log" />,
}));
vi.mock("@/features/dashboard/data/custom-products/hooks/use-custom-products-settings", () => ({
  useCustomProductsSettings: () => ({ data: undefined }),
}));
vi.mock("../../hooks/use-order-queue-actions", () => ({
  useOrderQueueActions: () => ({
    handleCancel: vi.fn(),
    handleResume: vi.fn(),
    confirmDialog: null,
  }),
}));
vi.mock("../pos-order-primary-action", () => ({
  PosOrderPrimaryAction: () => <div data-testid="primary-action" />,
}));
vi.mock("@/lib/hooks/use-min-width", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hooks/use-min-width")>()),
  useMinWidth: () => true,
}));

import { PosOrdersTabs } from "../pos-orders-tabs";
import { makeOrder } from "./order-queue-fixtures";
import type { PosOrderDisplay } from "../../types/pos.types";

const STORAGE_KEY = "epidom-pos-queue-filters-store-1";

// The queue only shows TODAY's orders until told otherwise, so every fixture is
// placed today by default. Dates are built from the local clock, like the queue's
// own — a fixed ISO string would drift out of "today" (or straddle it, in some
// timezones) and quietly break these.
const TODAY = new Date().toISOString();
const YESTERDAY_NOON = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  new Date().getDate() - 1,
  12
).toISOString();
const orderToday = (overrides: Partial<PosOrderDisplay> = {}) =>
  makeOrder({ createdAt: TODAY, ...overrides });

const posA = orderToday({ id: "p1", orderNumber: "POS-A", source: "POS", queueNumber: 1 });
const posB = orderToday({
  id: "p2",
  orderNumber: "POS-B",
  source: "POS",
  queueNumber: 2,
  status: "READY",
});
const online = orderToday({ id: "w1", orderNumber: "WEB-A", source: "STOREFRONT", queueNumber: 3 });

const persist = (state: object) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

// The whole page, not the queue alone: its POS / Online ordering tabs are the
// page's top bar now, beside the Log.
async function renderQueue() {
  // usePersistedState applies its saved value in a mount effect; let it land.
  await act(async () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings={false} />);
  });
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const openTab = (name: RegExp) => fireEvent.mouseDown(tab(name), { button: 0 });
const visible = (text: string) => screen.queryByText(text) !== null;

beforeEach(() => {
  localStorage.clear();
  url.search = "";
  queue.orders = [posA, posB, online];
  till.shift = null;
});

describe("PosOrderQueue — POS / Online tabs", () => {
  it("opens on the POS tab and lists only the till's orders", async () => {
    await renderQueue();
    expect(tab(/tabPos/)).toHaveAttribute("aria-selected", "true");
    expect(visible("POS-A")).toBe(true);
    expect(visible("POS-B")).toBe(true);
    expect(visible("WEB-A")).toBe(false);
  });

  it("counts every open order under its tab, whatever is filtered", async () => {
    await renderQueue();
    expect(tab(/tabPos/)).toHaveTextContent("2");
    expect(tab(/tabOnline/)).toHaveTextContent("1");

    // A status filter narrows the list, never the tab counts.
    fireEvent.click(screen.getByRole("button", { name: /pos\.status\.ready/ }));
    expect(tab(/tabPos/)).toHaveTextContent("2");
  });

  it("switches to the online orders, and back", async () => {
    await renderQueue();
    openTab(/tabOnline/);
    expect(visible("WEB-A")).toBe(true);
    expect(visible("POS-A")).toBe(false);

    openTab(/tabPos/);
    expect(visible("POS-A")).toBe(true);
    expect(visible("WEB-A")).toBe(false);
  });

  it("files GoFood, GrabFood and manual orders under Online too", async () => {
    queue.orders = [
      posA,
      orderToday({ id: "g1", orderNumber: "GO-1", source: "GOFOOD" }),
      orderToday({ id: "g2", orderNumber: "GR-1", source: "GRABFOOD" }),
      orderToday({ id: "m1", orderNumber: "MAN-1", source: "MANUAL" }),
    ];
    await renderQueue();
    expect(tab(/tabOnline/)).toHaveTextContent("3");
    openTab(/tabOnline/);
    for (const n of ["GO-1", "GR-1", "MAN-1"]) expect(visible(n)).toBe(true);
    expect(visible("POS-A")).toBe(false);
  });

  it("reads a tab saved before the tabs existed ('ALL') as POS", async () => {
    persist({ sourceFilter: "ALL", view: "split", activeFilterKeys: ["source"] });
    await renderQueue();
    expect(tab(/tabPos/)).toHaveAttribute("aria-selected", "true");
    expect(visible("WEB-A")).toBe(false);
  });

  it("remembers the Online tab across visits", async () => {
    persist({ sourceFilter: "ONLINE", view: "split" });
    await renderQueue();
    expect(tab(/tabOnline/)).toHaveAttribute("aria-selected", "true");
    expect(visible("WEB-A")).toBe(true);
  });

  it("keeps the tabs and the status rail up when a tab has no orders", async () => {
    queue.orders = [posA, posB];
    await renderQueue();
    openTab(/tabOnline/);
    expect(screen.getByText("pos.queue.noMatches")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "pos.queue.statusRailLabel" })
    ).toBeInTheDocument();
    // …so the cashier can go straight back.
    openTab(/tabPos/);
    expect(visible("POS-A")).toBe(true);
  });

  it("does not treat the tab as a filter to be cleared", async () => {
    await renderQueue();
    openTab(/tabOnline/);
    fireEvent.change(screen.getByPlaceholderText("pos.queue.searchPlaceholder"), {
      target: { value: "zzz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pos\.queue\.clearFilters/ }));
    expect(tab(/tabOnline/)).toHaveAttribute("aria-selected", "true");
    expect(visible("WEB-A")).toBe(true);
  });
});

describe("PosOrderQueue — split view", () => {
  it("is the default, with the status rail instead of the status tiles", async () => {
    await renderQueue();
    expect(
      screen.getByRole("navigation", { name: "pos.queue.statusRailLabel" })
    ).toBeInTheDocument();
    // The "All" count exists once — in the rail — not a second time as a tile.
    expect(screen.getAllByRole("button", { name: /pos\.queue\.all/ })).toHaveLength(1);
  });

  it("finds an order by its queue number", async () => {
    await renderQueue();
    fireEvent.change(screen.getByPlaceholderText("pos.queue.searchPlaceholder"), {
      target: { value: "#2" },
    });
    expect(visible("POS-B")).toBe(true);
    expect(visible("POS-A")).toBe(false);
  });

  it("shows the picked order's details in the docked column", async () => {
    await renderQueue();
    expect(screen.getByText("pos.queue.detailEmptyTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("POS-B"));
    expect(screen.getAllByText("POS-B")).toHaveLength(2);
    expect(screen.getByTestId("primary-action")).toBeInTheDocument();
  });

  it("can be switched to the original card view, which keeps its status tiles", async () => {
    await renderQueue();
    fireEvent.click(screen.getByRole("button", { name: /pos\.queue\.viewGrid/ }));
    expect(
      screen.queryByRole("navigation", { name: "pos.queue.statusRailLabel" })
    ).not.toBeInTheDocument();
    // Tiles are back: "All" appears as a tile.
    expect(screen.getAllByRole("button", { name: /pos\.queue\.all/ }).length).toBeGreaterThan(0);
    // The tab still applies in every view.
    expect(visible("POS-A")).toBe(true);
    expect(visible("WEB-A")).toBe(false);
  });

  it("no longer offers 'Source' in the add-filter menu — the tabs replaced it", async () => {
    await renderQueue();
    const toolbar = screen
      .getByPlaceholderText("pos.queue.searchPlaceholder")
      .closest("div.flex-col")!;
    expect(
      within(toolbar as HTMLElement).queryByText("pos.filters.source")
    ).not.toBeInTheDocument();
  });
});

// ── Date scope: today's orders unless told otherwise ─────────────────────────

describe("PosOrderQueue — date scope", () => {
  const oldOrder = orderToday({
    id: "old1",
    orderNumber: "POS-OLD",
    source: "POS",
    queueNumber: 9,
    paymentStatus: "PENDING",
    createdAt: YESTERDAY_NOON,
  });
  const dateSelect = () => screen.getByRole("combobox", { name: "pos.filters.dateRange" });
  const resetButton = () => screen.queryByRole("button", { name: /pos\.filters\.resetToToday/ });

  beforeEach(() => {
    queue.orders = [posA, oldOrder];
  });

  it("opens on today: an order from yesterday is not listed", async () => {
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
    expect(visible("POS-A")).toBe(true);
    expect(visible("POS-OLD")).toBe(false);
  });

  it("counts only the orders in scope — no number on the page counts what the list hides", async () => {
    await renderQueue();
    expect(tab(/tabPos/)).toHaveTextContent("1");
    // The unpaid toggle's badge too: the one unpaid order is yesterday's.
    expect(screen.getByRole("button", { name: /pos\.queue\.unpaid/i })).not.toHaveTextContent("1");
  });

  it("shows older orders once the date is widened, and offers the way back", async () => {
    persist({ version: 2, datePreset: "all", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(visible("POS-A")).toBe(true);
    expect(visible("POS-OLD")).toBe(true);
    expect(tab(/tabPos/)).toHaveTextContent("2");

    fireEvent.click(resetButton()!);
    expect(visible("POS-OLD")).toBe(false);
    expect(visible("POS-A")).toBe(true);
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
  });

  it("has no reset button while it is already on today", async () => {
    await renderQueue();
    expect(resetButton()).toBeNull();
  });

  it("gives everyone the new default once — a state saved before the date existed opens on today", async () => {
    // No `version`: what every user who ever touched a filter has saved. Read as
    // "no date filter" it would leave them on all-time and the default would never reach them.
    persist({ sourceFilter: "POS", view: "split", unpaidOnly: false });
    await renderQueue();
    expect(visible("POS-OLD")).toBe(false);
    expect(resetButton()).toBeNull();
  });

  it("keeps a deliberate choice: All time, saved at the current version, is still All time", async () => {
    persist({ version: 2, datePreset: "all", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.all");
    expect(visible("POS-OLD")).toBe(true);
  });

  it("does not take a made-up saved preset at its word", async () => {
    persist({ version: 2, datePreset: "next-century", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
  });

  it("opens on All time from the unpaid alert's link, so every unpaid order is listed", async () => {
    url.search = "unpaid=1";
    await renderQueue();
    expect(visible("POS-OLD")).toBe(true);
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.all");
  });

  it("leaves the date alone when other filters are cleared", async () => {
    persist({ version: 2, datePreset: "all", sourceFilter: "POS", view: "split" });
    await renderQueue();
    fireEvent.change(screen.getByPlaceholderText("pos.queue.searchPlaceholder"), {
      target: { value: "zzz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pos\.queue\.clearFilters/ }));
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.all");
    expect(resetButton()).not.toBeNull();
  });

  it("shows the no-matches notice, toolbar and date control intact, when nothing is from today", async () => {
    queue.orders = [oldOrder];
    await renderQueue();
    expect(screen.getByText("pos.queue.noMatches")).toBeInTheDocument();
    // The cashier can still widen the date from here.
    expect(dateSelect()).toBeInTheDocument();
  });
});

describe("PosOrdersTabs — POS / Online ordering replace Active, History is the Log", () => {
  it("has no Active or History tab — POS, Online ordering and a separate Log", async () => {
    await renderQueue();
    const names = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(names).toHaveLength(3);
    expect(tab(/pos\.history\.logTab/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /activeTab|historyTab/ })).toBeNull();
    // Two lists, like the Stock page's Item | Delivery Order + Log.
    expect(screen.getAllByRole("tablist")).toHaveLength(2);
  });

  it("opens the Log, and keeps the POS / Online counts up while it is open", async () => {
    await renderQueue();
    openTab(/pos\.history\.logTab/);
    expect(screen.getByTestId("order-log")).toBeInTheDocument();
    expect(visible("POS-A")).toBe(false);
    expect(tab(/tabPos/)).toHaveTextContent("2");
    expect(tab(/tabOnline/)).toHaveTextContent("1");
    expect(tab(/tabPos/)).toHaveAttribute("aria-selected", "false");
  });

  it("goes from the Log straight to the queue on the source that was picked", async () => {
    await renderQueue();
    openTab(/pos\.history\.logTab/);
    openTab(/tabOnline/);
    expect(screen.queryByTestId("order-log")).toBeNull();
    expect(tab(/tabOnline/)).toHaveAttribute("aria-selected", "true");
    expect(visible("WEB-A")).toBe(true);
    expect(visible("POS-A")).toBe(false);
  });

  it("remembers the Log across visits", async () => {
    localStorage.setItem("epidom-pos-orders-tab-store-1", JSON.stringify({ tab: "history" }));
    await renderQueue();
    expect(screen.getByTestId("order-log")).toBeInTheDocument();
  });
});

describe("PosOrderQueue — the open till's shift", () => {
  const dateSelect = () => screen.getByRole("combobox", { name: "pos.filters.dateRange" });
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

  // Placed before the till opened. How long before doesn't matter: the shift
  // started after it, so it is not the shift's.
  const beforeShift = orderToday({
    id: "b1",
    orderNumber: "POS-BEFORE",
    source: "POS",
    queueNumber: 7,
    createdAt: hoursAgo(3),
  });

  beforeEach(() => {
    queue.orders = [posA, beforeShift];
    till.shift = { id: "shift-1", openedAt: hoursAgo(2) };
  });

  it("opens on the current shift: an order placed before the till opened is not listed", async () => {
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.shift");
    expect(visible("POS-A")).toBe(true);
    expect(visible("POS-BEFORE")).toBe(false);
    expect(tab(/tabPos/)).toHaveTextContent("1");
  });

  it("is the shift, not the day: a till opened yesterday still lists last night's orders", async () => {
    const d = new Date();
    till.shift = {
      id: "shift-1",
      openedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 11).toISOString(),
    };
    queue.orders = [
      posA,
      orderToday({
        id: "y1",
        orderNumber: "POS-LASTNIGHT",
        source: "POS",
        queueNumber: 8,
        createdAt: YESTERDAY_NOON,
      }),
    ];
    await renderQueue();
    expect(visible("POS-LASTNIGHT")).toBe(true);
    expect(visible("POS-A")).toBe(true);
  });

  it("is today again with no till open, with nothing to reset", async () => {
    till.shift = null;
    persist({ version: 3, datePreset: "shift", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");
    expect(screen.queryByRole("button", { name: /pos\.filters\.reset/ })).toBeNull();
  });

  it("keeps a deliberate Today while a till is open, and offers the way back to the shift", async () => {
    persist({ version: 3, datePreset: "today", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.today");

    fireEvent.click(screen.getByRole("button", { name: /pos\.filters\.resetToShift/ }));
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.shift");
    expect(visible("POS-BEFORE")).toBe(false);
    expect(screen.queryByRole("button", { name: /pos\.filters\.reset/ })).toBeNull();
  });

  it("moves a Today saved when Today was the default (v2) onto the shift", async () => {
    persist({ version: 2, datePreset: "today", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.shift");
  });

  it("but keeps any other v2 date, which was picked on purpose", async () => {
    persist({ version: 2, datePreset: "yesterday", sourceFilter: "POS", view: "split" });
    await renderQueue();
    expect(dateSelect()).toHaveTextContent("pos.history.dateRange.yesterday");
  });
});
