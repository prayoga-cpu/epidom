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
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../hooks/use-stores", () => ({
  useUpdateStore: () => ({ mutate: h.update, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
// The real one imports phone-input.css, which vitest's PostCSS setup can't load.
vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <input
      type="tel"
      aria-label="phone"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || undefined)}
    />
  ),
}));

import { EditStoreDialog } from "../edit-store-dialog";

function store(overrides: Partial<Store>): Store {
  return {
    id: "s1",
    businessId: "b1",
    name: "Le Comptoir",
    address: "12 rue de la Paix",
    city: "Paris",
    country: "France",
    phone: null,
    email: null,
    image: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    accessRole: "owner",
    ...overrides,
  };
}

function openDialog(value: Store) {
  renderIn("en", <EditStoreDialog store={value} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.getByRole("dialog");
}

const countryTrigger = (dialog: HTMLElement) => within(dialog).getAllByRole("combobox")[0];

function save(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Update Store" }));
}

beforeAll(installDomPolyfills);
beforeEach(() => {
  h.update.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("<EditStoreDialog>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("keeps a legacy country the list doesn't know, shows it, and never sends it back", async () => {
    // Even with a browser that would guess France, nothing is auto-filled on edit.
    mockBrowserTimezone("Europe/Paris");
    const dialog = openDialog(store({ country: "Bali" }));

    expect(countryTrigger(dialog)).toHaveTextContent("Bali");
    expect(within(dialog).getByText(/Saved as “Bali”/)).toBeInTheDocument();

    save(dialog);
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    const payload = h.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty("countryCode");
    expect(payload).not.toHaveProperty("country");
    expect(payload).toMatchObject({ name: "Le Comptoir", city: "Paris" });
  });

  it("replaces the legacy text only when the owner picks a country", async () => {
    const dialog = openDialog(store({ country: "Bali" }));

    fireEvent.click(countryTrigger(dialog));
    fireEvent.click(screen.getByRole("option", { name: /Indonesia/ }));
    expect(within(dialog).queryByText(/Saved as “Bali”/)).toBeNull();

    save(dialog);
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).toMatchObject({ countryCode: "ID" });
  });

  it("pre-fills a recognised spelling and leaves it untouched when unchanged", async () => {
    const dialog = openDialog(store({ country: "Indonésie" }));
    expect(countryTrigger(dialog)).toHaveTextContent("Indonesia");

    save(dialog);
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).not.toHaveProperty("countryCode");
  });

  it("'Other country' needs its name when editing, instead of silently keeping the old country", async () => {
    const dialog = openDialog(store({ country: "France" }));

    fireEvent.click(countryTrigger(dialog));
    fireEvent.click(screen.getByRole("option", { name: "Other country" }));
    // Required here (the server can't store an empty name), not "(optional)".
    const nameLabel = within(dialog).getByText("Country name").closest("label");
    expect(nameLabel).toHaveTextContent("*");
    expect(nameLabel).not.toHaveTextContent("(optional)");

    save(dialog);
    expect(await within(dialog).findByText("Enter the country name.")).toBeInTheDocument();
    expect(h.update).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByPlaceholderText("e.g. Japan"), {
      target: { value: " Japan " },
    });
    save(dialog);
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).toMatchObject({ countryCode: "ZZ", country: "Japan" });
  });

  it("has no finance block — currency and payments point to Profile → Fees & Taxes", () => {
    const dialog = openDialog(store({}));

    expect(within(dialog).queryByText("Currency & payments")).toBeNull();
    expect(within(dialog).queryByRole("switch")).toBeNull();
    expect(within(dialog).queryByTestId("market-summary")).toBeNull();
    expect(
      within(dialog).getByText("Currency and payments are managed in Profile → Fees & Taxes.")
    ).toBeInTheDocument();
  });

  it("opens with the details section expanded and the store's values filled in", () => {
    const dialog = openDialog(store({ email: "hello@comptoir.fr" }));

    const toggle = within(dialog).getByRole("button", { name: /More details/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByDisplayValue("12 rue de la Paix")).toBeVisible();
    expect(within(dialog).getByDisplayValue("hello@comptoir.fr")).toBeVisible();
  });
});
