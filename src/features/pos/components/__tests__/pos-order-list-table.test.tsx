import { describe, it, expect, vi } from "vitest";
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

import { PosOrderListTable } from "../pos-order-list-table";
import { makeOrder } from "./order-queue-fixtures";

/** The <td>s of the body row that contains `text`. */
const cellsOfRow = (text: string) =>
  within(screen.getByText(text).closest("tr") as HTMLElement).getAllByRole("cell");

describe("PosOrderListTable", () => {
  it("has exactly the six columns: order no., time, queue, customer, table, total", () => {
    render(<PosOrderListTable orders={[makeOrder()]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "pos.queue.colOrder",
      "pos.queue.colTime",
      "pos.queue.colQueue",
      "pos.queue.colCustomer",
      "pos.queue.colTable",
      "pos.queue.colTotal",
    ]);
  });

  it("shows each order's number, queue #, customer, table and total on its row", () => {
    render(<PosOrderListTable orders={[makeOrder()]} selectedId={null} onSelect={vi.fn()} />);
    const cells = cellsOfRow("POS-20260919-AB12CD");
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveTextContent("POS-20260919-AB12CD");
    expect(cells[2]).toHaveTextContent("#12");
    expect(cells[3]).toHaveTextContent("Budi");
    expect(cells[4]).toHaveTextContent("5");
    expect(cells[5]).toHaveTextContent("IDR 110000");
  });

  it("prefers the table label over the raw table number", () => {
    render(
      <PosOrderListTable
        orders={[makeOrder({ tableLabel: "Patio 2", tableNumber: "5" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(cellsOfRow("POS-20260919-AB12CD")[4]).toHaveTextContent("Patio 2");
  });

  it("shows a dash for a missing queue number and a missing table, never null/undefined", () => {
    render(
      <PosOrderListTable
        orders={[makeOrder({ queueNumber: null, tableNumber: null, tableLabel: null })]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    const cells = cellsOfRow("POS-20260919-AB12CD");
    expect(cells[2]).toHaveTextContent("–");
    expect(cells[4]).toHaveTextContent("–");
    expect(cells[2].textContent).not.toMatch(/null|undefined/);
  });

  it("selects on tap and on Enter / Space", () => {
    const onSelect = vi.fn();
    const a = makeOrder({ id: "a", orderNumber: "POS-A" });
    const b = makeOrder({ id: "b", orderNumber: "POS-B" });
    render(<PosOrderListTable orders={[a, b]} selectedId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("POS-A"));
    expect(onSelect).toHaveBeenLastCalledWith(a);

    const rowB = screen.getByText("POS-B").closest("tr") as HTMLElement;
    fireEvent.keyDown(rowB, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(b);
    fireEvent.keyDown(rowB, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("marks only the selected row", () => {
    const a = makeOrder({ id: "a", orderNumber: "POS-A" });
    const b = makeOrder({ id: "b", orderNumber: "POS-B" });
    render(<PosOrderListTable orders={[a, b]} selectedId="b" onSelect={vi.fn()} />);
    expect(screen.getByText("POS-B").closest("tr")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("POS-A").closest("tr")).not.toHaveAttribute("aria-current");
  });

  it("keeps rows at the 44px touch target and reachable by keyboard", () => {
    render(<PosOrderListTable orders={[makeOrder()]} selectedId={null} onSelect={vi.fn()} />);
    const row = screen.getByText("POS-20260919-AB12CD").closest("tr") as HTMLElement;
    expect(row.className).toContain("h-11");
    expect(row.className).toContain("touch-manipulation");
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("names each row's status for screen readers, since the dot is colour only", () => {
    render(
      <PosOrderListTable
        orders={[makeOrder({ status: "READY" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(cellsOfRow("POS-20260919-AB12CD")[0]).toHaveTextContent("pos.status.ready");
  });
});
