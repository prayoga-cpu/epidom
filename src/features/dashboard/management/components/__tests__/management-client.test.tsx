import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  params: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => "/store/s1/management",
  useSearchParams: () => h.params.current,
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("../../edit-stock/edit-stock", () => ({
  EditStockCard: () => <div>item-view</div>,
}));
vi.mock("../../edit-stock/reorder/reorder-panel", () => ({
  ReorderPanel: ({
    highlightMaterialId,
    onHighlightConsumed,
  }: {
    highlightMaterialId?: string | null;
    onHighlightConsumed?: () => void;
  }) => (
    <div>
      delivery-view:{highlightMaterialId ?? ""}
      <button onClick={onHighlightConsumed}>consume</button>
    </div>
  ),
}));
vi.mock("../../movements/movements-tab", () => ({
  MovementsTab: () => <div>log-view</div>,
}));

import { ManagementClient } from "../management-client";

function renderClient() {
  return render(<ManagementClient storeId="s1" />);
}

beforeEach(() => {
  window.localStorage.clear();
  h.params.current = new URLSearchParams();
});

describe("ManagementClient — Item | Delivery Order tabs + a separate Log tab", () => {
  it("shows Item and Delivery Order in one tab bar and Log in a separate one", () => {
    renderClient();

    const lists = screen.getAllByRole("tablist");
    expect(lists).toHaveLength(2);
    expect(
      within(lists[0])
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["management.item", "management.deliveryOrder"]);
    expect(
      within(lists[1])
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["management.log"]);

    expect(screen.getByRole("tab", { name: "management.item" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("item-view")).toBeInTheDocument();
  });

  it("switches to Delivery Order from its tab", () => {
    renderClient();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "management.deliveryOrder" }));

    expect(screen.getByText(/delivery-view/)).toBeInTheDocument();
    expect(screen.queryByText("item-view")).not.toBeInTheDocument();
    expect(h.replace).toHaveBeenCalledWith("/store/s1/management?tab=delivery", { scroll: false });
  });

  it("opens the stock log from the Log tab", () => {
    renderClient();

    const log = screen.getByRole("tab", { name: "management.log" });
    fireEvent.mouseDown(log);

    expect(screen.getByText("log-view")).toBeInTheDocument();
    expect(log).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "management.item" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(h.replace).toHaveBeenCalledWith("/store/s1/management?tab=log", { scroll: false });
  });

  it("does not switch to Log when keyboard focus passes over it", () => {
    renderClient();

    fireEvent.focus(screen.getByRole("tab", { name: "management.log" }));

    expect(screen.getByText("item-view")).toBeInTheDocument();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("reads the old ?tab=stock and ?tab=history links as Item and Log", () => {
    h.params.current = new URLSearchParams("tab=stock");
    const { unmount } = renderClient();
    expect(screen.getByText("item-view")).toBeInTheDocument();
    unmount();

    h.params.current = new URLSearchParams("tab=history");
    renderClient();
    expect(screen.getByText("log-view")).toBeInTheDocument();
  });

  it("sends an Alerts deep-link to Delivery Order and keeps it there once consumed", () => {
    h.params.current = new URLSearchParams("tab=log&highlight=m1");
    renderClient();

    expect(screen.getByText("delivery-view:m1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "management.deliveryOrder" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "consume" }));

    expect(h.replace).toHaveBeenCalledWith("/store/s1/management?tab=delivery", { scroll: false });
  });
});
