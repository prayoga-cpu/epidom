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

import { PosOrderQueue } from "../pos-order-queue";
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

async function renderQueue() {
  // usePersistedState applies its saved value in a mount effect; let it land.
  await act(async () => {
    render(<PosOrderQueue storeId="store-1" />);
  });
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const openTab = (name: RegExp) => fireEvent.mouseDown(tab(name), { button: 0 });
const visible = (text: string) => screen.queryByText(text) !== null;

beforeEach(() => {
  localStorage.clear();
  url.search = "";
  queue.orders = [posA, posB, online];
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
