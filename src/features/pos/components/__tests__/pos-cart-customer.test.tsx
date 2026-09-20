import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const currencyMock = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  currencyMock.value = makeCurrencyMock("EUR");
  return { useCurrency: () => currencyMock.value };
});

const net = vi.hoisted(() => ({ online: true }));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => net.online }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { toast } from "sonner";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { PosCartCustomer, prefillFromQuery } from "../pos-cart-customer";
import { usePosCart } from "../../hooks/use-pos-cart";
import { useCustomerIntake } from "../../hooks/use-customer-display";
import type { CartCustomer } from "../../types/pos.types";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const cart = () => usePosCart.getState();

const row = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Alice Martin",
  phone: "+33612345678",
  email: null,
  notes: null,
  points: 120,
  memberSince: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  lifetimeSpend: 1200,
  orderCount: 6,
  lastOrderAt: null,
  ...over,
});

const alice: CartCustomer = {
  id: "c1",
  name: "Alice Martin",
  phone: "+33612345678",
  email: null,
  points: 120,
  lifetimeSpend: 1200,
};

const loyaltyOn = { enabled: true, spendPerPoint: 10, pointValue: 0.1, minRedeemPoints: 0 };

function mockApi(customers: unknown[] = [row()]) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/customers")) {
      return { customers, nextCursor: null, totalCount: customers.length } as any;
    }
    // GET /customers/[id] — the freshness read of an attached customer.
    return { ...row(), orders: [], loyaltyEntries: [] } as any;
  });
}

function renderRow() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <PosCartCustomer storeId="s1" />
    </Wrapper>
  );
}

beforeEach(() => {
  localStorage.clear();
  cart().clearCart();
  cart().setLoyaltyRules(null);
  net.online = true;
  get.mockReset();
  post.mockReset();
  mockApi();
  useCustomerIntake.getState().clear();
});

describe("PosCartCustomer — empty by default", () => {
  it("shows only a '+ Add Customer' row — no input, no pop-up", () => {
    renderRow();
    expect(screen.getByRole("button", { name: /Add Customer/ })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("expands IN PLACE into a search input when tapped", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives the '+ Add Customer' row a >=40px tap target", () => {
    renderRow();
    expect(screen.getByRole("button", { name: /Add Customer/ }).className).toContain("h-11");
  });
});

describe("PosCartCustomer — search as you type", () => {
  it("debounces, then queries GET /customers?q=&limit=8", async () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "al" } });
    fireEvent.change(input, { target: { value: "ali" } });

    // Generous timeout: the debounce is a real 250ms timer, and this suite
    // shares a busy machine with the rest of the run.
    await waitFor(
      () => expect(get).toHaveBeenCalledWith("/stores/s1/customers", { q: "ali", limit: "8" }),
      { timeout: 5000 }
    );
    // The three keystrokes collapsed into one request for the final text.
    const searched = get.mock.calls.filter((c) => c[0] === "/stores/s1/customers");
    expect(searched.some((c) => (c[1] as any).q === "a")).toBe(false);
    expect(searched.some((c) => (c[1] as any).q === "al")).toBe(false);
  });

  it("attaches the tapped result to the cart", async () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    fireEvent.click(await screen.findByText("Alice Martin"));

    expect(cart().customer).toEqual(alice);
    // Collapses back to the chip, and the search is gone.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByTestId("pos-cart-customer").textContent).toContain("Alice Martin");
  });

  it("says so when nothing matches", async () => {
    mockApi([]);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    expect(await screen.findByText("cashierCart.customer.noResults")).toBeTruthy();
  });
});

describe("PosCartCustomer — the attached chip", () => {
  it("shows name and lifetime spend in the store's currency (EUR, never IDR)", () => {
    cart().setCustomer(alice);
    renderRow();
    const chip = screen.getByTestId("pos-cart-customer");
    expect(chip.textContent).toContain("Alice Martin");
    expect(chip.textContent).toContain("Lifetime spend EUR 1200.00");
    // Every money call passed the store currency as the source currency.
    expect(currencyMock.value.formatPrice.mock.calls.length).toBeGreaterThan(0);
    for (const call of currencyMock.value.formatPrice.mock.calls) expect(call[1]).toBe("EUR");
  });

  it("shows points only when the store has loyalty on", () => {
    cart().setCustomer(alice);
    const { unmount } = renderRow();
    expect(screen.getByTestId("pos-cart-customer").textContent).not.toContain("120 pts");
    unmount();

    cart().setLoyaltyRules(loyaltyOn);
    renderRow();
    expect(screen.getByTestId("pos-cart-customer").textContent).toContain("120 pts");
  });

  it("detaches with a >=40px tap target", () => {
    cart().setCustomer(alice);
    renderRow();
    const detach = screen.getByRole("button", { name: "cashierCart.customer.detach" });
    expect(detach.className).toContain("h-11");
    expect(detach.className).toContain("w-11");
    fireEvent.click(detach);
    expect(cart().customer).toBeNull();
    expect(screen.getByRole("button", { name: /Add Customer/ })).toBeTruthy();
  });
});

describe("PosCartCustomer — new customer, inline", () => {
  const openCreate = () => {
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.newCustomer" }));
  };

  it("needs a WhatsApp number or a name — and nothing more", async () => {
    renderRow();
    openCreate();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));
    expect(await screen.findByText("cashierCart.customer.nameOrPhoneRequired")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("creates a customer from a WhatsApp number alone — name and email are optional", async () => {
    post.mockResolvedValue(row({ id: "c8", name: "+33688888888", phone: "+33688888888" }));
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.whatsappPlaceholder"), {
      target: { value: "+33688888888" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));

    await waitFor(() => expect(cart().customer?.id).toBe("c8"));
    // The absent name is sent as absent; the server names the record after the number.
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: undefined,
      phone: "+33688888888",
      email: undefined,
    });
  });

  it("can still be created from a name alone (no number)", async () => {
    post.mockResolvedValue(row({ id: "c7", name: "Walk-in Bob", phone: null }));
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder"), {
      target: { value: "Walk-in Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));
    await waitFor(() => expect(cart().customer?.id).toBe("c7"));
  });

  it("creates the customer and attaches them", async () => {
    post.mockResolvedValue(
      row({ id: "c9", name: "Bob", phone: "+33699999999", points: 0, lifetimeSpend: 0 })
    );
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByLabelText("cashierCart.customer.whatsappPlaceholder"), {
      target: { value: "+33699999999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));

    await waitFor(() => expect(cart().customer?.id).toBe("c9"));
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: "Bob",
      phone: "+33699999999",
      email: undefined,
    });
  });

  it("rejects a malformed email before calling the server", async () => {
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByLabelText("cashierCart.customer.emailOptionalPlaceholder"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));
    expect(await screen.findByText("cashierCart.customer.emailInvalid")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("on a 409 duplicate phone shows the hint and searches for the existing customer", async () => {
    post.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "CONFLICT", message: "Phone already used" } } as any,
        409
      )
    );
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder"), {
      target: { value: "Alicia" },
    });
    fireEvent.change(screen.getByLabelText("cashierCart.customer.whatsappPlaceholder"), {
      target: { value: "+33612345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));

    expect(await screen.findByText("cashierCart.customer.duplicateHint")).toBeTruthy();
    expect(cart().customer).toBeNull();
    // Back in search mode, pre-filled with the phone so the existing record is one tap away.
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("+33612345678");
  });

  it("surfaces another server error as a toast and stays on the form", async () => {
    post.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Boom" } } as any,
        500
      )
    );
    renderRow();
    openCreate();
    fireEvent.change(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Boom"));
    expect(screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder")).toBeTruthy();
  });
});

describe("PosCartCustomer — synced with the customer screen", () => {
  /** What the resolver leaves in the intake once a number turns out to be new. */
  const numberArrives = (over: Partial<ReturnType<typeof useCustomerIntake.getState>> = {}) =>
    act(() => {
      useCustomerIntake.setState({
        phone: "+33612345678",
        match: "new",
        name: "",
        email: "",
        receivedAt: 100,
        formOpenedFor: 0,
        ...over,
      });
    });

  const phoneField = () =>
    screen.getByLabelText("cashierCart.customer.whatsappPlaceholder") as HTMLInputElement;
  const nameField = () =>
    screen.getByLabelText("cashierCart.customer.nameOptionalPlaceholder") as HTMLInputElement;
  const emailField = () =>
    screen.getByLabelText("cashierCart.customer.emailOptionalPlaceholder") as HTMLInputElement;

  it("opens the new-customer form with the number the customer typed on their screen", () => {
    renderRow();
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();

    numberArrives();

    expect(phoneField().value).toBe("+33612345678");
    expect(screen.getByText("cashierCart.customer.fromDisplay")).toBeTruthy();
    // It must not pull focus off whatever the cashier is in the middle of.
    expect(document.activeElement).not.toBe(phoneField());
  });

  it("stays out of the way when the number belongs to an existing customer or is still being checked", () => {
    renderRow();
    numberArrives({ match: "existing" });
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
    numberArrives({ match: null });
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
    numberArrives({ match: "unknown" });
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
  });

  it("does not open over a customer who is already attached", () => {
    cart().setCustomer(alice);
    renderRow();
    numberArrives();
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
    expect(screen.getByTestId("pos-cart-customer")).toHaveTextContent("Alice Martin");
  });

  it("follows the name and email as the customer types them", () => {
    renderRow();
    numberArrives();
    act(() => useCustomerIntake.getState().setDetails("Claire", ""));
    expect(nameField().value).toBe("Claire");
    act(() => useCustomerIntake.getState().setDetails("Claire Moreau", "claire@example.com"));
    expect(nameField().value).toBe("Claire Moreau");
    expect(emailField().value).toBe("claire@example.com");
  });

  it("stops overwriting a field once the cashier has typed in it themselves", () => {
    renderRow();
    numberArrives();
    act(() => useCustomerIntake.getState().setDetails("Claire", ""));

    fireEvent.change(nameField(), { target: { value: "Claire M." } });
    act(() => useCustomerIntake.getState().setDetails("Claire Moreau", "claire@example.com"));

    // The cashier's name stands; the field they left alone still follows the customer.
    expect(nameField().value).toBe("Claire M.");
    expect(emailField().value).toBe("claire@example.com");
  });

  it("saves what the customer typed — one tap from the cashier — and attaches them", async () => {
    post.mockResolvedValue(row({ id: "c5", name: "Claire", phone: "+33612345678" }));
    renderRow();
    numberArrives();
    act(() => useCustomerIntake.getState().setDetails("Claire", "claire@example.com"));

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));

    await waitFor(() => expect(cart().customer?.id).toBe("c5"));
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: "Claire",
      phone: "+33612345678",
      email: "claire@example.com",
    });
  });

  it("does not spring back open after the cashier closes it, or after leaving and returning", () => {
    const view = renderRow();
    numberArrives();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));
    // Cancel returns to search; close that too.
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();

    view.unmount();
    renderRow();
    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
  });

  it("opens again for the NEXT number the customer submits", () => {
    renderRow();
    numberArrives();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));

    numberArrives({ phone: "+33699999999", receivedAt: 200 });
    expect(phoneField().value).toBe("+33699999999");
  });
});

describe("PosCartCustomer — offline", () => {
  it("disables the row with a hint and never calls the network", () => {
    net.online = false;
    renderRow();
    const add = screen.getByRole("button", { name: /Add Customer/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.textContent).toContain("cashierCart.customer.offlineHint");
    fireEvent.click(add);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("still lets an already-attached customer be removed", () => {
    net.online = false;
    cart().setCustomer(alice);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.detach" }));
    expect(cart().customer).toBeNull();
  });
});

describe("PosCartCustomer — never trusts a persisted balance", () => {
  it("re-reads GET /customers/[id] on mount and adopts the fresh points and spend", async () => {
    cart().setCustomer({ ...alice, points: 10, lifetimeSpend: 5 });
    get.mockImplementation(
      async () =>
        ({
          ...row({ points: 99, lifetimeSpend: 4321 }),
          orders: [],
          loyaltyEntries: [],
        }) as any
    );
    renderRow();

    await waitFor(() => expect(cart().customer?.points).toBe(99));
    expect(get).toHaveBeenCalledWith("/stores/s1/customers/c1");
    expect(cart().customer?.lifetimeSpend).toBe(4321);
  });

  it("keeps a points redemption in progress when only the balance refreshes", async () => {
    cart().setLoyaltyRules({
      enabled: true,
      spendPerPoint: 10,
      pointValue: 0.1,
      minRedeemPoints: 0,
    });
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setCustomer({ ...alice, points: 10 });
    cart().setRedeemPoints(5);
    renderRow();
    await waitFor(() => expect(cart().customer?.points).toBe(120));
    expect(cart().redeemPoints).toBe(5);
  });

  it("drops a customer who was deleted since (404) and says so", async () => {
    cart().setCustomer(alice);
    get.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "NOT_FOUND", message: "gone" } } as any,
        404
      )
    );
    renderRow();
    await waitFor(() => expect(cart().customer).toBeNull());
    expect(toast.error).toHaveBeenCalledWith("cashierCart.customer.gone");
  });

  it("keeps the customer on a transient failure (offline blip, 500)", async () => {
    cart().setCustomer(alice);
    get.mockRejectedValue(new Error("Network error occurred"));
    renderRow();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(cart().customer?.id).toBe("c1");
  });

  it("does not even try while offline", () => {
    net.online = false;
    cart().setCustomer(alice);
    renderRow();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("prefillFromQuery", () => {
  it("routes what was typed to the right field", () => {
    expect(prefillFromQuery("")).toEqual({ name: "", phone: "", email: "" });
    expect(prefillFromQuery("Alice")).toEqual({ name: "Alice", phone: "", email: "" });
    expect(prefillFromQuery("+33 6 12 34 56 78")).toEqual({
      name: "",
      phone: "+33 6 12 34 56 78",
      email: "",
    });
    expect(prefillFromQuery("a@b.co")).toEqual({ name: "", phone: "", email: "a@b.co" });
  });
});
