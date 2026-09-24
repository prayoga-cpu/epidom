import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createQueryWrapper, stubBrowserApis } from "./cart-test-utils";

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
import { useCustomerDisplaySettings } from "../../hooks/use-customer-display-settings";
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

const registeredTables = [
  { id: "t1", label: "A1", capacity: 4, status: "AVAILABLE" },
  { id: "t2", label: "V3", capacity: 2, status: "OCCUPIED" },
];

function mockApi(customers: unknown[] = [row()], tables: unknown[] = registeredTables) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/tables")) return tables as any;
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

/** The customer section's heading only renders inside the open dialog. */
const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  stubBrowserApis();
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

  it("opens a dialog with the pax and the customer search when tapped", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    expect(dialog()).toBeTruthy();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" })).toBeTruthy();
    // No autofocus on the search: an iPad keyboard would cover the pax picker.
    expect(document.activeElement).not.toBe(screen.getByRole("searchbox"));
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

  it("attaches the tapped result to the cart and keeps the dialog open", async () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    fireEvent.click(await screen.findByText("Alice Martin"));

    expect(cart().customer).toEqual(alice);
    // The search gives way to the attached customer; the dialog stays for the pax.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(dialog()).toBeTruthy();
    expect(screen.getByTestId("pos-cart-customer").textContent).toContain("Alice Martin");

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.done" }));
    expect(dialog()).toBeNull();
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

describe("PosCartCustomer — new customer, in the dialog", () => {
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
  const reviewButton = () =>
    screen.queryByRole("button", { name: /cashierCart\.customer\.reviewFromDisplay/ });
  const openReview = () => fireEvent.click(reviewButton()!);

  it("prepares the new-customer form without opening over the cashier; one tap opens it", () => {
    renderRow();
    numberArrives();

    // It must not pull focus off whatever the cashier is in the middle of.
    expect(dialog()).toBeNull();
    openReview();

    expect(phoneField().value).toBe("+33612345678");
    expect(screen.getByText("cashierCart.customer.fromDisplay")).toBeTruthy();
    expect(document.activeElement).not.toBe(phoneField());
  });

  it("switches an already-open dialog to the form in place", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    numberArrives();
    expect(phoneField().value).toBe("+33612345678");
  });

  it("stays out of the way when the number belongs to an existing customer or is still being checked", () => {
    renderRow();
    numberArrives({ match: "existing" });
    expect(reviewButton()).toBeNull();
    numberArrives({ match: null });
    expect(reviewButton()).toBeNull();
    numberArrives({ match: "unknown" });
    expect(reviewButton()).toBeNull();
  });

  it("does not open over a customer who is already attached", () => {
    cart().setCustomer(alice);
    renderRow();
    numberArrives();
    expect(reviewButton()).toBeNull();
    expect(screen.getByTestId("pos-cart-customer")).toHaveTextContent("Alice Martin");
  });

  it("follows the name and email as the customer types them", () => {
    renderRow();
    numberArrives();
    // Typed while the dialog was still closed: there once the cashier opens it.
    act(() => useCustomerIntake.getState().setDetails("Cla", ""));
    openReview();
    expect(nameField().value).toBe("Cla");
    act(() => useCustomerIntake.getState().setDetails("Claire", ""));
    expect(nameField().value).toBe("Claire");
    act(() => useCustomerIntake.getState().setDetails("Claire Moreau", "claire@example.com"));
    expect(nameField().value).toBe("Claire Moreau");
    expect(emailField().value).toBe("claire@example.com");
  });

  it("stops overwriting a field once the cashier has typed in it themselves", () => {
    renderRow();
    numberArrives();
    openReview();
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
    openReview();

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customer.saveAndAttach" }));

    await waitFor(() => expect(cart().customer?.id).toBe("c5"));
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: "Claire",
      phone: "+33612345678",
      email: "claire@example.com",
    });
  });

  it("does not come back after the cashier closes it, or after leaving and returning", () => {
    const view = renderRow();
    numberArrives();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.done" }));
    expect(reviewButton()).toBeNull();

    view.unmount();
    renderRow();
    expect(reviewButton()).toBeNull();
  });

  it("gets out of the way once the till saves the customer's submission and attaches them", () => {
    renderRow();
    numberArrives();
    openReview();
    expect(phoneField()).toBeTruthy();

    // What useCustomerIntakeResolver does when the customer presses Done.
    act(() => {
      cart().setCustomer({ ...alice, id: "c5", name: "Claire Moreau" });
      useCustomerIntake.getState().setAutoSave("saved");
    });

    expect(screen.queryByLabelText("cashierCart.customer.whatsappPlaceholder")).toBeNull();
    expect(screen.getByTestId("pos-cart-customer")).toHaveTextContent("Claire Moreau");

    // Detached again: back to a plain search, not the stale form.
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.remove" }));
    expect(screen.getByRole("searchbox")).toBeTruthy();
  });

  it("typing in the customer's form takes it over — the till leaves it for the cashier to save", () => {
    renderRow();
    numberArrives();
    openReview();
    expect(useCustomerIntake.getState().takenOverFor).toBe(0);

    fireEvent.change(nameField(), { target: { value: "Claire M." } });

    expect(useCustomerIntake.getState().takenOverFor).toBe(100);
  });

  it("dismissing the customer's form is a no to saving it", () => {
    renderRow();
    numberArrives();
    openReview();

    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));

    expect(useCustomerIntake.getState().takenOverFor).toBe(100);
  });

  it("closing the dialog while the customer is still typing does NOT stop the save", () => {
    renderRow();
    numberArrives();
    openReview();

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.done" }));

    expect(useCustomerIntake.getState().takenOverFor).toBe(0);
  });

  it("the cashier's own new-customer form never touches the customer screen's submission", () => {
    renderRow();
    act(() => useCustomerIntake.setState({ receivedAt: 100 }));
    fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
    fireEvent.click(screen.getByRole("button", { name: /cashierCart\.customer\.newCustomer/ }));

    fireEvent.change(nameField(), { target: { value: "Walk-in" } });

    expect(useCustomerIntake.getState().takenOverFor).toBe(0);
  });

  it("asks again for the NEXT number the customer submits", () => {
    renderRow();
    numberArrives();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.done" }));

    numberArrives({ phone: "+33699999999", receivedAt: 200 });
    openReview();
    expect(phoneField().value).toBe("+33699999999");
  });
});

describe("PosCartCustomer — offline", () => {
  it("still opens for the pax and a typed table, says the search needs a connection, and never calls the network", () => {
    net.online = false;
    renderRow();
    const add = screen.getByRole("button", { name: /Add Customer/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    fireEvent.click(add);

    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByText("cashierCart.customer.offlineHint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" }));
    expect(cart().guestCount).toBe(2);
    fireEvent.change(screen.getByLabelText("pos.checkout.tableOptional"), {
      target: { value: "Terrace" },
    });
    expect(cart().tableNumber).toBe("Terrace");
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

describe("PosCartCustomer — pax in the dialog", () => {
  const openDialog = () => fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));

  it("shows the dine-in pax on the row", () => {
    cart().setGuestCount(3);
    renderRow();
    expect(screen.getByRole("button", { name: /Add Customer/ }).textContent).toContain("3 pax");
  });

  it("edits one value two ways: − / + in the middle, number boxes underneath", () => {
    renderRow();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" }));
    expect(cart().guestCount).toBe(2);
    expect(screen.getByRole("radio", { name: "2" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: "6" }));
    expect(cart().guestCount).toBe(6);
    expect(screen.getByTestId("cart-guest-count").textContent).toBe("6");
    // Not closed by a pick: the cashier may still be on the table or the customer.
    expect(dialog()).toBeTruthy();
  });

  it("offers boxes 1 to 30, and + keeps going past them", () => {
    cart().setGuestCount(30);
    renderRow();
    openDialog();
    expect(screen.getAllByRole("radio")).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" }));
    expect(cart().guestCount).toBe(31);
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
  });

  it("takeaway has no pax, on the row or in the dialog", () => {
    cart().setOrderType("TAKEAWAY");
    renderRow();
    expect(screen.getByRole("button", { name: /Add Customer/ }).textContent).not.toContain("pax");
    openDialog();
    expect(screen.queryByRole("button", { name: "pos.checkout.guestCountIncrease" })).toBeNull();
    expect(screen.queryByLabelText("pos.checkout.tableOptional")).toBeNull();
  });
});

describe("PosCartCustomer — the table, linked to the registered tables", () => {
  const openDialog = () => fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));
  const tableSelect = () => screen.getByRole("combobox", { name: "pos.checkout.tableOptional" });
  const openTables = async () => {
    await waitFor(() => expect(get).toHaveBeenCalledWith("/stores/s1/tables"));
    fireEvent.keyDown(await waitFor(() => tableSelect()), { key: "Enter" });
  };

  it("lists the store's tables and links the one picked", async () => {
    renderRow();
    openDialog();
    await openTables();
    fireEvent.click(await screen.findByRole("option", { name: /A1/ }));

    expect(cart().tableId).toBe("t1");
    expect(cart().tableNumber).toBe("A1");
    expect(tableSelect()).toHaveTextContent("A1");

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customerDialog.done" }));
    expect(screen.getByRole("button", { name: /Add Customer/ }).textContent).toContain("Table A1");
  });

  it("Custom opens a box for an unregistered table, and typing drops any link", async () => {
    cart().setTable({ id: "t1", label: "A1" });
    renderRow();
    openDialog();
    await openTables();
    fireEvent.click(await screen.findByRole("option", { name: "cashierCart.table.customOption" }));

    const box = screen.getByLabelText("cashierCart.table.customPlaceholder") as HTMLInputElement;
    expect(cart().tableId).toBeNull();
    // The label carries over so "A1" can become "A1 terrace".
    expect(box.value).toBe("A1");
    fireEvent.change(box, { target: { value: "Terrace 2" } });
    expect(cart().tableNumber).toBe("Terrace 2");
    expect(cart().tableId).toBeNull();
  });

  it("No table clears it", async () => {
    cart().setTable({ id: "t1", label: "A1" });
    renderRow();
    openDialog();
    await openTables();
    fireEvent.click(await screen.findByRole("option", { name: "cashierCart.table.none" }));
    expect(cart().tableId).toBeNull();
    expect(cart().tableNumber).toBe("");
  });

  it("a store with no registered tables just gets the box", async () => {
    mockApi([row()], []);
    renderRow();
    openDialog();
    // The list answers empty: the dropdown gives way to a plain box.
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    const box = screen.getByLabelText("pos.checkout.tableOptional");
    fireEvent.change(box, { target: { value: "Bar 3" } });
    expect(cart().tableNumber).toBe("Bar 3");
  });
});

describe("PosCartCustomer — the customer display, from the dialog", () => {
  const openDialog = () => fireEvent.click(screen.getByRole("button", { name: /Add Customer/ }));

  beforeEach(() => useCustomerDisplaySettings.getState().setEnabled(false));

  it("switches the display on and asks the customer for their details on it", () => {
    const posted: unknown[] = [];
    const Original = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = class {
      onmessage = null;
      constructor(public name: string) {}
      postMessage(message: unknown) {
        posted.push(message);
      }
      close() {}
    } as unknown as typeof BroadcastChannel;
    try {
      renderRow();
      openDialog();
      const ask = screen.getByRole("button", { name: /cashierCart\.customerDisplay\.ask/ });
      expect((ask as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(screen.getByRole("switch", { name: /pos\.customerDisplay\.enable/ }));
      expect(useCustomerDisplaySettings.getState().enabled).toBe(true);

      fireEvent.click(ask);
      expect(posted).toContainEqual({ type: "ask-details" });
      expect(screen.getByRole("status").textContent).toBe("cashierCart.customerDisplay.waiting");
    } finally {
      globalThis.BroadcastChannel = Original;
    }
  });

  it("says what the customer typed and what the till found", () => {
    useCustomerDisplaySettings.getState().setEnabled(true);
    renderRow();
    openDialog();
    act(() => {
      useCustomerIntake.setState({ phone: "+33612345678", match: "new", receivedAt: 5 });
    });
    expect(screen.getByRole("status").textContent).toBe("cashierCart.customerDisplay.isNew");
  });

  it("says when the till is saving the new customer, has saved them, or could not", () => {
    useCustomerDisplaySettings.getState().setEnabled(true);
    renderRow();
    openDialog();
    const status = () => screen.getByRole("status").textContent;

    act(() => {
      useCustomerIntake.setState({ phone: "+33612345678", match: "new", receivedAt: 5 });
    });
    expect(status()).toBe("cashierCart.customerDisplay.isNew");

    act(() => useCustomerIntake.getState().setAutoSave("saving"));
    expect(status()).toBe("cashierCart.customerDisplay.saving");
    act(() => useCustomerIntake.getState().setAutoSave("failed"));
    expect(status()).toBe("cashierCart.customerDisplay.saveFailed");
    act(() => useCustomerIntake.getState().setAutoSave("saved"));
    expect(status()).toBe("cashierCart.customerDisplay.saved");
  });

  it("tells the cashier to save it themselves once they took the form over", () => {
    useCustomerDisplaySettings.getState().setEnabled(true);
    renderRow();
    openDialog();
    act(() => {
      useCustomerIntake.setState({
        phone: "+33612345678",
        match: "new",
        receivedAt: 5,
        takenOverFor: 5,
      });
    });
    expect(screen.getByRole("status").textContent).toBe("cashierCart.customerDisplay.isNewManual");
  });

  it("does not offer to ask once a customer is on the sale", () => {
    useCustomerDisplaySettings.getState().setEnabled(true);
    cart().setCustomer(alice);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Alice Martin/ }));
    expect(screen.queryByRole("button", { name: /cashierCart\.customerDisplay\.ask/ })).toBeNull();
    expect(screen.getByRole("button", { name: /pos\.customerDisplay\.openWindow/ })).toBeTruthy();
  });
});
