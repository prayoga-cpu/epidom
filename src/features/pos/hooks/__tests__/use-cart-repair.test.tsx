import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const { toast } = vi.hoisted(() => ({ toast: { warning: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

const api = vi.hoisted(() => {
  class ApiClientError extends Error {
    constructor(
      public readonly response: any,
      public readonly status: number
    ) {
      super(response.error.message);
    }
  }
  return { get: vi.fn(), ApiClientError };
});
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: api.get },
  ApiClientError: api.ApiClientError,
}));

import { useCartRepair } from "../use-cart-repair";
import { usePosCart } from "../use-pos-cart";
import { posMenuKey } from "../use-pos-menu";

const STORE = "store-1";

const refusal = (items: Array<{ menuItemId: string; name: string }>) =>
  new api.ApiClientError(
    { error: { message: "No longer available", details: { reason: "ITEMS_UNAVAILABLE", items } } },
    422
  );

const menuOf = (...items: Array<{ id: string; name: string; price: number }>) => ({
  categories: [{ name: "All", items: items.map((i) => ({ ...i, isAvailable: true })) }],
  total: items.length,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCartRepair(STORE), { wrapper });
  return { repair: result.current, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  usePosCart.getState().clearCart();
  usePosCart.getState().addItem("old-flan", "Flan", 15, 2);
  usePosCart.getState().addItem("old-tarte", "Tarte", 20, 1);
  usePosCart.getState().addItem("ok-latte", "Latte", 8, 1);
});

describe("useCartRepair", () => {
  it("leaves every other failure to the caller: no fetch, no cart change, no toast", async () => {
    const { repair } = setup();

    expect(await repair(new Error("network"))).toBeNull();
    expect(
      await repair(new api.ApiClientError({ error: { message: "Cash short" } }, 422))
    ).toBeNull();

    expect(api.get).not.toHaveBeenCalled();
    expect(usePosCart.getState().items).toHaveLength(3);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("re-links what the current menu still sells, removes the rest, re-totals and says so", async () => {
    api.get.mockResolvedValue(
      menuOf(
        { id: "new-flan", name: "Flan", price: 16 },
        { id: "ok-latte", name: "Latte", price: 8 }
      )
    );
    const { repair } = setup();

    const result = await repair(
      refusal([
        { menuItemId: "old-flan", name: "Flan" },
        { menuItemId: "old-tarte", name: "Tarte" },
      ])
    );

    expect(api.get).toHaveBeenCalledWith(`/stores/${STORE}/pos/menu`);
    const cart = usePosCart.getState();
    expect(cart.items.map((i) => [i.menuItemId, i.unitPrice, i.quantity])).toEqual([
      ["new-flan", 16, 2],
      ["ok-latte", 8, 1],
    ]);
    expect(cart.subtotal).toBe(40);
    expect(result?.removed).toEqual(["Tarte"]);
    expect(toast.warning).toHaveBeenCalledWith(
      "pos.checkout.cartRepaired.title",
      expect.objectContaining({
        description:
          "pos.checkout.cartRepaired.removed pos.checkout.cartRepaired.relinked pos.checkout.cartRepaired.review",
      })
    );
  });

  it("falls back to the cached menu when the refetch fails, and still removes the refused lines", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    const { repair, client } = setup();
    // The stale copy: it still lists the very id the server refused.
    client.setQueryData(posMenuKey(STORE), menuOf({ id: "old-flan", name: "Flan", price: 15 }));

    await repair(refusal([{ menuItemId: "old-flan", name: "Flan" }]));

    expect(usePosCart.getState().items.map((i) => i.menuItemId)).toEqual(["old-tarte", "ok-latte"]);
  });

  it("says the cart was emptied when nothing is left", async () => {
    api.get.mockResolvedValue(menuOf());
    const { repair } = setup();

    const result = await repair(
      refusal([
        { menuItemId: "old-flan", name: "Flan" },
        { menuItemId: "old-tarte", name: "Tarte" },
        { menuItemId: "ok-latte", name: "Latte" },
      ])
    );

    expect(result?.items).toEqual([]);
    expect(usePosCart.getState().items).toEqual([]);
    expect(toast.warning).toHaveBeenCalledWith(
      "pos.checkout.cartRepaired.title",
      expect.objectContaining({ description: "pos.checkout.cartRepaired.emptied" })
    );
  });
});
