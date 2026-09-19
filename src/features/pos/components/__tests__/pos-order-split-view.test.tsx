import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c ?? ""} ${v}`,
  }),
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

// The one thing that decides docked column vs bottom sheet.
const isLg = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/hooks/use-min-width", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hooks/use-min-width")>()),
  useMinWidth: () => isLg.value,
}));

import { PosOrderSplitView } from "../pos-order-split-view";
import { makeOrder } from "./order-queue-fixtures";

const counts = { ALL: 2, CONFIRMED: 2, IN_PRODUCTION: 0, READY: 0, HELD: 0 };
const a = makeOrder({ id: "a", orderNumber: "POS-A", queueNumber: 1, customerName: "Ani" });
const b = makeOrder({ id: "b", orderNumber: "POS-B", queueNumber: 2, customerName: "Budi" });

function renderView(props: Partial<React.ComponentProps<typeof PosOrderSplitView>> = {}) {
  const onStatusFilterChange = vi.fn();
  const utils = render(
    <PosOrderSplitView
      orders={[a, b]}
      storeId="store-1"
      statusCounts={counts}
      statusFilter="ALL"
      onStatusFilterChange={onStatusFilterChange}
      onUpdateStatus={vi.fn()}
      {...props}
    />
  );
  return { ...utils, onStatusFilterChange };
}

beforeEach(() => {
  isLg.value = true;
});

describe("PosOrderSplitView — three columns (lg+)", () => {
  it("shows the rail, the list and an empty detail column before anything is picked", () => {
    renderView();
    expect(
      screen.getByRole("navigation", { name: "pos.queue.statusRailLabel" })
    ).toBeInTheDocument();
    expect(screen.getByText("POS-A")).toBeInTheDocument();
    expect(screen.getByText("POS-B")).toBeInTheDocument();
    expect(screen.getByText("pos.queue.detailEmptyTitle")).toBeInTheDocument();
  });

  it("docks the picked order's details beside the list — no sheet", () => {
    renderView();
    fireEvent.click(screen.getByText("POS-B"));
    // Once in the row, once as the header of the docked panel.
    expect(screen.getAllByText("POS-B")).toHaveLength(2);
    expect(screen.getByTestId("primary-action")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("pos.queue.detailEmptyTitle")).not.toBeInTheDocument();
  });

  it("swaps the details when another row is picked", () => {
    renderView();
    fireEvent.click(screen.getByText("POS-A"));
    expect(screen.getAllByText("#1").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByText("POS-B"));
    expect(screen.getAllByText("POS-A")).toHaveLength(1);
    expect(screen.getAllByText("POS-B")).toHaveLength(2);
  });

  it("forgets the selection when the order leaves the visible list", () => {
    const { rerender } = renderView();
    fireEvent.click(screen.getByText("POS-A"));
    expect(screen.getAllByText("POS-A")).toHaveLength(2);

    // e.g. the cashier switched tab / status, or typed a search that hides it.
    rerender(
      <PosOrderSplitView
        orders={[b]}
        storeId="store-1"
        statusCounts={counts}
        statusFilter="ALL"
        onStatusFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    );
    expect(screen.queryByText("POS-A")).not.toBeInTheDocument();
    expect(screen.getByText("pos.queue.detailEmptyTitle")).toBeInTheDocument();
  });

  it("passes rail taps up as a status filter", () => {
    const { onStatusFilterChange } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /pos\.status\.ready/ }));
    expect(onStatusFilterChange).toHaveBeenCalledWith("READY");
  });

  it("keeps the rail and shows the empty notice when nothing matches", () => {
    renderView({
      orders: [],
      emptyState: <p>nothing here</p>,
      statusFilter: "HELD",
    });
    expect(screen.getByText("nothing here")).toBeInTheDocument();
    // The cashier must still be able to change status from here.
    expect(screen.getByRole("button", { name: /pos\.queue\.all/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("PosOrderSplitView — below lg", () => {
  beforeEach(() => {
    isLg.value = false;
  });

  it("opens the details in a bottom sheet when a row is tapped", () => {
    renderView();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("POS-B"));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("pos.queue.detailTitle")).toBeInTheDocument();
    expect(within(sheet).getByText("POS-B")).toBeInTheDocument();
    expect(within(sheet).getByTestId("primary-action")).toBeInTheDocument();
  });

  it("does not mount a second, hidden copy of the details behind the sheet", () => {
    renderView();
    fireEvent.click(screen.getByText("POS-B"));
    // Row + sheet header only — the docked column is fed nothing below lg.
    expect(screen.getAllByText("POS-B")).toHaveLength(2);
    expect(screen.getAllByTestId("primary-action")).toHaveLength(1);
  });

  it("clears the selection when the sheet is dismissed", () => {
    renderView();
    fireEvent.click(screen.getByText("POS-B"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
