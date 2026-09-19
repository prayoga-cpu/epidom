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
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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

const STORAGE_KEY = "epidom-pos-queue-filters-store-1";

const posA = makeOrder({ id: "p1", orderNumber: "POS-A", source: "POS", queueNumber: 1 });
const posB = makeOrder({
  id: "p2",
  orderNumber: "POS-B",
  source: "POS",
  queueNumber: 2,
  status: "READY",
});
const online = makeOrder({ id: "w1", orderNumber: "WEB-A", source: "STOREFRONT", queueNumber: 3 });

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
      makeOrder({ id: "g1", orderNumber: "GO-1", source: "GOFOOD" }),
      makeOrder({ id: "g2", orderNumber: "GR-1", source: "GRABFOOD" }),
      makeOrder({ id: "m1", orderNumber: "MAN-1", source: "MANUAL" }),
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
