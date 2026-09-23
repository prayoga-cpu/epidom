import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    // The description carries a {store} placeholder the component fills in.
    t: (k: string) => (k === "pos.switchStore.confirmDesc" ? "Switch to {store}" : k),
  }),
}));

// The global setup's router mock builds a fresh push() per call, so it can't be asserted on.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const mockStores = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-stores", () => ({
  useStores: () => mockStores(),
}));

import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { PosModeStoreSwitcher } from "../pos-mode-store-switcher";

const ALPHA = { id: "store-001", name: "Alpha", city: "Paris", accessRole: "owner" };
const BETA = { id: "store-002", name: "Beta", city: null, accessRole: "owner" };

function withStores(stores: unknown[]) {
  mockStores.mockReturnValue({ data: stores, isLoading: false });
}

/** The cart only needs a line to count — the switcher reads `items.length`. */
function putSaleInCart() {
  usePosCart.setState({ items: [{ id: "line-1" } as never] });
}

function renderSwitcher() {
  const onNavigate = vi.fn();
  const view = render(<PosModeStoreSwitcher storeId="store-001" onNavigate={onNavigate} />);
  return { onNavigate, ...view };
}

function openList() {
  fireEvent.click(screen.getByRole("button", { name: /dashboard\.storeSelector\.label/ }));
  return within(screen.getByRole("list"));
}

describe("PosModeStoreSwitcher", () => {
  beforeEach(() => {
    usePosCart.getState().clearCart();
    withStores([ALPHA, BETA]);
  });

  it("shows the store you're in on the button, with the list collapsed", () => {
    renderSwitcher();
    expect(
      screen.getByRole("button", { name: "dashboard.storeSelector.label: Alpha" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("expands to every store and marks the current one", () => {
    renderSwitcher();
    const list = openList();
    expect(list.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-current", "true");
    expect(list.getByRole("button", { name: /Beta/ })).not.toHaveAttribute("aria-current");
  });

  it("opens the other store's POS — not its Back Office — and closes the menu", () => {
    const { onNavigate } = renderSwitcher();
    fireEvent.click(openList().getByRole("button", { name: /Beta/ }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/store/store-002/pos");
    // Nothing to confirm when there's no sale to lose.
    expect(screen.queryByText("pos.switchStore.confirmTitle")).toBeNull();
  });

  it("choosing the store you're already in just collapses the list", () => {
    const { onNavigate } = renderSwitcher();
    fireEvent.click(openList().getByRole("button", { name: /Alpha/ }));

    expect(push).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).toBeNull();
  });

  describe("with a sale in progress (the cart isn't scoped to a store)", () => {
    it("asks first, and neither clears the cart nor navigates until confirmed", async () => {
      putSaleInCart();
      const { onNavigate } = renderSwitcher();
      fireEvent.click(openList().getByRole("button", { name: /Beta/ }));

      expect(await screen.findByText("pos.switchStore.confirmTitle")).toBeInTheDocument();
      expect(screen.getByText("Switch to Beta")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
      expect(usePosCart.getState().items).toHaveLength(1);
    });

    it("cancelling keeps the sale and stays put", async () => {
      putSaleInCart();
      const { onNavigate } = renderSwitcher();
      fireEvent.click(openList().getByRole("button", { name: /Beta/ }));

      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByText("pos.switchStore.confirmTitle")).toBeNull());
      expect(push).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
      expect(usePosCart.getState().items).toHaveLength(1);
    });

    it("confirming clears the sale, then switches", async () => {
      putSaleInCart();
      const { onNavigate } = renderSwitcher();
      fireEvent.click(openList().getByRole("button", { name: /Beta/ }));

      fireEvent.click(await screen.findByRole("button", { name: "pos.switchStore.confirmAction" }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/store/store-002/pos"));
      expect(usePosCart.getState().items).toHaveLength(0);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe("a linked staff account's stores", () => {
    it("opens the page that role can reach", () => {
      withStores([
        ALPHA,
        {
          id: "store-003",
          name: "Gamma",
          city: null,
          accessRole: "staff",
          staffHomePath: "/store/store-003/pos/orders",
        },
      ]);
      renderSwitcher();
      fireEvent.click(openList().getByRole("button", { name: /Gamma/ }));

      expect(push).toHaveBeenCalledWith("/store/store-003/pos/orders");
    });

    it("disables a store where the role has no POS page, instead of linking somewhere that bounces", () => {
      withStores([
        ALPHA,
        { id: "store-004", name: "Delta", city: null, accessRole: "staff", staffHomePath: null },
      ]);
      renderSwitcher();
      const delta = openList().getByRole("button", { name: /Delta/ });

      expect(delta).toBeDisabled();
      fireEvent.click(delta);
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("when there's nothing to show", () => {
    it("renders nothing if the store list failed to load — Back to Stores is still there", () => {
      mockStores.mockReturnValue({ data: undefined, isLoading: false });
      const { container } = renderSwitcher();
      expect(container).toBeEmptyDOMElement();
    });

    it("renders no button while the list is still loading", () => {
      mockStores.mockReturnValue({ data: undefined, isLoading: true });
      renderSwitcher();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
