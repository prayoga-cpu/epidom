import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  RENDER_TEST_TIMEOUT,
  installDomPolyfills,
  mockBrowserTimezone,
  renderIn,
} from "@/features/stores/shared/__tests__/helpers";
import type { Store } from "../../hooks/use-stores";

const h = vi.hoisted(() => ({
  stores: { current: [] as unknown[] },
  mutate: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../hooks/use-stores", () => ({
  useStores: () => ({ data: h.stores.current }),
  useCreateStore: () => ({ mutate: h.mutate, isPending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/stores",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
// The real one imports phone-input.css, which vitest's PostCSS setup can't load.
vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: ({
    value,
    onChange,
    defaultCountry,
  }: {
    value?: string;
    onChange?: (value: string | undefined) => void;
    defaultCountry?: string;
  }) => (
    <input
      type="tel"
      aria-label="phone"
      data-default-country={defaultCountry}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || undefined)}
    />
  ),
}));

import { CreateStoreDialog } from "../create-store-dialog";

function store(overrides: Partial<Store>): Store {
  return {
    id: "s",
    businessId: "b1",
    name: "Store",
    address: null,
    city: null,
    country: null,
    phone: null,
    email: null,
    image: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    accessRole: "owner",
    ...overrides,
  };
}

// Listed newest first on purpose: the dialog must pick the OLDEST as the default source.
const newer = store({
  id: "s-new",
  name: "Warung Senja",
  country: "Indonesia",
  createdAt: "2026-05-01T00:00:00.000Z",
});
const oldest = store({
  id: "s-old",
  name: "Le Comptoir",
  country: "France",
  createdAt: "2025-01-01T00:00:00.000Z",
});
const staffOnly = store({
  id: "s-staff",
  name: "Somewhere I Work",
  country: "Belgium",
  createdAt: "2024-01-01T00:00:00.000Z",
  accessRole: "staff",
});

function openDialog(props: Parameters<typeof CreateStoreDialog>[0] = {}) {
  renderIn("en", <CreateStoreDialog {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /Create a store/ }));
  return screen.getByRole("dialog");
}

function typeName(dialog: HTMLElement, value: string) {
  fireEvent.change(within(dialog).getByLabelText(/Store name/), { target: { value } });
}

function submit(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Create store" }));
}

beforeAll(installDomPolyfills);
beforeEach(() => {
  h.stores.current = [];
  h.mutate.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("<CreateStoreDialog>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("asks the essentials first — name, country, city, then currency & payments — with details tucked away", () => {
    h.stores.current = [newer, oldest];
    const dialog = openDialog();

    const labels = Array.from(dialog.querySelectorAll("label")).map((label) =>
      label.textContent?.replace(/\s+/g, " ").trim()
    );
    expect(labels.slice(0, 4)).toEqual([
      "Store name *",
      "Country *",
      "City (optional)",
      "Use the same currency and payment settings as Le Comptoir",
    ]);
    const financeHeading = within(dialog).getByText("Currency & payments");
    const detailsToggle = within(dialog).getByRole("button", { name: /More details/ });
    expect(
      financeHeading.compareDocumentPosition(detailsToggle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // "More details" (image, address, phone, email) is closed by default.
    expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
    const region = document.getElementById(detailsToggle.getAttribute("aria-controls")!);
    expect(region).toHaveAttribute("hidden");
    expect(within(region!).getByText("Address")).toBeInTheDocument();

    fireEvent.click(detailsToggle);
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    expect(region).not.toHaveAttribute("hidden");
  });

  it("with a store already, the subtitle is about adding another location", () => {
    h.stores.current = [oldest];
    const dialog = openDialog();
    expect(within(dialog).getByText("Add another location to your business.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Create your first store.")).toBeNull();
  });

  it("with no store yet (staff-only rows don't count), the subtitle says 'first store'", () => {
    h.stores.current = [staffOnly];
    const dialog = openDialog();
    expect(within(dialog).getByText("Create your first store.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("switch")).toBeNull();
  });

  it("the copy switch is on by default with a store, and hides the market summary until turned off", () => {
    h.stores.current = [oldest];
    const dialog = openDialog();

    const toggle = within(dialog).getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).queryByTestId("market-summary")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    // The country defaults to the oldest store's (France), so its market is shown.
    expect(within(dialog).getByTestId("market-summary")).toHaveTextContent("EUR (€)");
  });

  it("with several stores, 'Copy from' defaults to the oldest", () => {
    h.stores.current = [newer, oldest];
    const dialog = openDialog();
    expect(within(dialog).getByLabelText("Copy from")).toHaveTextContent("Le Comptoir");
  });

  it("sends countryCode and a copy financeSource, then opens the new store's dashboard", async () => {
    h.stores.current = [newer, oldest];
    h.mutate.mockImplementation((_input, options) => options.onSuccess({ id: "new-store" }));
    const dialog = openDialog();

    typeName(dialog, "  Rue Neuve ");
    submit(dialog);

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual({
      name: "Rue Neuve",
      countryCode: "FR",
      financeSource: { mode: "copy", storeId: "s-old" },
    });
    expect(h.toastSuccess).toHaveBeenCalledWith("Store created successfully");
    expect(h.push).toHaveBeenCalledWith("/store/new-store/dashboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("with the switch off, the store starts from its country's settings", async () => {
    h.stores.current = [oldest];
    const dialog = openDialog();

    typeName(dialog, "Rue Neuve");
    fireEvent.click(within(dialog).getByRole("switch"));
    submit(dialog);

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual({
      name: "Rue Neuve",
      countryCode: "FR",
      financeSource: { mode: "country" },
    });
  });

  it("the business's country is the default when no store has a recognisable one", async () => {
    h.stores.current = [store({ id: "s1", name: "Legacy", country: "Bali" })];
    const dialog = openDialog({ businessCountry: "Indonésie" });

    typeName(dialog, "Kopi Dua");
    submit(dialog);

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toMatchObject({ countryCode: "ID" });
  });

  it("with no store at all, the country comes from the browser and the market summary shows", async () => {
    mockBrowserTimezone("Europe/Paris");
    h.stores.current = [];
    const dialog = openDialog();

    await waitFor(() =>
      expect(within(dialog).getByTestId("market-summary")).toHaveTextContent("EUR (€)")
    );
    typeName(dialog, "Chez Nous");
    submit(dialog);

    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0][0]).toEqual({
      name: "Chez Nous",
      countryCode: "FR",
      financeSource: { mode: "country" },
    });
  });

  it("warns when the store to copy from is in a country with another currency", () => {
    h.stores.current = [oldest];
    const dialog = openDialog();

    fireEvent.click(within(dialog).getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: /Indonesia/ }));

    expect(
      within(dialog).getByText(
        "Le Comptoir uses EUR. Turn this off to use this country's currency and payment methods."
      )
    ).toBeInTheDocument();
  });

  it("warns from the source's real currency when its country is blank (a legacy store)", () => {
    const legacy = store({ id: "s-legacy", name: "Toko Satu", country: null });
    h.stores.current = [legacy];
    const dialog = openDialog({ businessCountry: "France", sourceCurrencyById: { "s-legacy": "IDR" } });

    // France comes from the business; the copy switch stays on by default.
    expect(within(dialog).getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(
      within(dialog).getByText(
        "Toko Satu uses IDR. Turn this off to use this country's currency and payment methods."
      )
    ).toBeInTheDocument();

    // Turning it off (the store starts from France's settings) clears the warning.
    fireEvent.click(within(dialog).getByRole("switch"));
    expect(within(dialog).queryByText(/Toko Satu uses IDR/)).toBeNull();
  });

  it("the real currency outranks the one the source's country implies", () => {
    // Saved as France, but its settings are in IDR: copying into France still warns…
    h.stores.current = [oldest];
    const dialog = openDialog({ sourceCurrencyById: { "s-old": "IDR" } });
    expect(within(dialog).getByText(/Le Comptoir uses IDR/)).toBeInTheDocument();
  });

  it("no warning when the source already uses the chosen country's currency", () => {
    // …and a blank-country source already in EUR opening a French store is fine.
    h.stores.current = [store({ id: "s-legacy", name: "Chez Eux", country: null })];
    const dialog = openDialog({ businessCountry: "France", sourceCurrencyById: { "s-legacy": "EUR" } });
    expect(within(dialog).queryByText(/Chez Eux uses/)).toBeNull();
  });

  it("does not submit without a name", async () => {
    h.stores.current = [oldest];
    const dialog = openDialog();
    submit(dialog);

    expect(await within(dialog).findByText("Enter your store's name.")).toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("an error keeps the dialog open and shows the server's message", async () => {
    h.stores.current = [oldest];
    h.mutate.mockImplementation((_input, options) =>
      options.onError(new Error("A store with this name already exists in your business"))
    );
    const dialog = openDialog();

    typeName(dialog, "Le Comptoir");
    submit(dialog);

    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith(
        "A store with this name already exists in your business"
      )
    );
    expect(h.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
