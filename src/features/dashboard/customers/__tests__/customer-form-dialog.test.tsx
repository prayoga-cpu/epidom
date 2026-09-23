import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { mockUseI18n } = await import("./helpers");
  return { useI18n: mockUseI18n };
});
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeUseCurrency } = await import("./helpers");
  return { useCurrency: makeUseCurrency(() => "EUR") };
});
vi.mock("@/components/ui/phone-input", async () => {
  const { PhoneInputStub } = await import("./helpers");
  return { PhoneInput: PhoneInputStub };
});
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { get: vi.fn(), post: h.post, patch: h.patch } };
});

import { CustomerFormDialog } from "../components/customer-form-dialog";
import { apiError, makeCustomer, makeDetail, renderWithQuery } from "./helpers";

const DUPLICATE = "A customer with this phone number already exists (Marie Dupont)";

function renderDialog(props: { customer?: ReturnType<typeof makeCustomer> | null } = {}) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <CustomerFormDialog
      storeId="s1"
      open
      onOpenChange={onOpenChange}
      customer={props.customer ?? null}
    />
  );
  return { onOpenChange };
}

// The real PhoneInput doesn't forward the FormControl's id either, so its <label>
// is not wired to the input: reach it by type, as the stub and the library both
// render an <input type="tel">.
const phoneInput = () => document.querySelector<HTMLInputElement>('input[type="tel"]')!;
const nameInput = () => screen.getByLabelText("customers.form.name") as HTMLInputElement;
const emailInput = () => screen.getByLabelText("customers.form.email") as HTMLInputElement;
const submit = (name: string) => screen.getByRole("button", { name });

function typePhone(value: string) {
  fireEvent.change(phoneInput(), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.post.mockResolvedValue(makeCustomer());
  h.patch.mockResolvedValue(makeDetail());
});

describe("CustomerFormDialog — add", () => {
  it("shows the add title and starts empty", () => {
    renderDialog();
    expect(screen.getByText("customers.form.addTitle")).toBeInTheDocument();
    expect(nameInput().value).toBe("");
    expect(emailInput().value).toBe("");
  });

  it("starts the phone input on the store currency's country", () => {
    renderDialog();
    expect(phoneInput().dataset.defaultCountry).toBe("FR");
  });

  it("refuses an empty name without calling the API", async () => {
    renderDialog();
    fireEvent.click(submit("customers.form.add"));

    expect(await screen.findByText("customers.form.errors.nameRequired")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it("refuses a malformed email without calling the API", async () => {
    renderDialog();
    fireEvent.change(nameInput(), { target: { value: "Marie Dupont" } });
    fireEvent.change(emailInput(), { target: { value: "not-an-email" } });
    fireEvent.click(submit("customers.form.add"));

    expect(await screen.findByText("customers.form.errors.emailInvalid")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it("posts only the fields that were filled in, then closes and confirms", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(nameInput(), { target: { value: "  Marie Dupont " } });
    typePhone("+33612345678");
    fireEvent.click(submit("customers.form.add"));

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith("/stores/s1/customers", {
        name: "Marie Dupont",
        phone: "+33612345678",
      })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.toastSuccess).toHaveBeenCalledWith("Marie Dupont added");
  });

  it.each([
    [409, "conflict"],
    [400, "bad request"],
  ])("keeps the dialog open and pins a %s phone error under the phone input", async (status) => {
    h.post.mockRejectedValue(
      apiError(status, "Rejected", [{ field: "phone", message: DUPLICATE }])
    );
    const { onOpenChange } = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "Marie Dupont" } });
    typePhone("+33612345678");
    fireEvent.click(submit("customers.form.add"));

    const message = await screen.findByText(DUPLICATE);
    // Under the phone field specifically, not the name or a toast.
    expect(message.closest("[data-slot=form-item]")!.contains(phoneInput())).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(h.toastSuccess).not.toHaveBeenCalled();
    expect(h.toastError).not.toHaveBeenCalled();
    // What the cashier typed is still there to fix.
    expect(nameInput().value).toBe("Marie Dupont");
  });

  it("clears the server's phone error as soon as the number is changed", async () => {
    h.post.mockRejectedValue(apiError(409, "Conflict", [{ field: "phone", message: DUPLICATE }]));
    renderDialog();
    fireEvent.change(nameInput(), { target: { value: "Marie Dupont" } });
    typePhone("+33612345678");
    fireEvent.click(submit("customers.form.add"));
    await screen.findByText(DUPLICATE);

    typePhone("+33698765432");

    await waitFor(() => expect(screen.queryByText(DUPLICATE)).toBeNull());
  });

  it("falls back to a toast for a failure that isn't tied to a field", async () => {
    h.post.mockRejectedValue(apiError(500, "Server exploded"));
    const { onOpenChange } = renderDialog();
    fireEvent.change(nameInput(), { target: { value: "Marie Dupont" } });
    fireEvent.click(submit("customers.form.add"));

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Server exploded"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes without saving on Cancel", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "customers.form.cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.post).not.toHaveBeenCalled();
  });
});

describe("CustomerFormDialog — edit", () => {
  const customer = makeCustomer({
    name: "Marie Dupont",
    email: "marie@example.com",
    notes: "vegan",
  });

  it("is seeded from the customer and titled as an edit", () => {
    renderDialog({ customer });
    expect(screen.getByText("customers.form.editTitle")).toBeInTheDocument();
    expect(nameInput().value).toBe("Marie Dupont");
    expect(emailInput().value).toBe("marie@example.com");
    expect((screen.getByLabelText("customers.form.notes") as HTMLTextAreaElement).value).toBe(
      "vegan"
    );
  });

  it("PATCHes the full state, sending null for a field that was emptied", async () => {
    const { onOpenChange } = renderDialog({ customer });
    fireEvent.change(nameInput(), { target: { value: "Marie D." } });
    fireEvent.change(emailInput(), { target: { value: "" } });
    fireEvent.click(submit("customers.form.save"));

    await waitFor(() =>
      expect(h.patch).toHaveBeenCalledWith("/stores/s1/customers/c1", {
        name: "Marie D.",
        phone: "+33612345678",
        email: null,
        notes: "vegan",
      })
    );
    expect(h.post).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.toastSuccess).toHaveBeenCalledWith("Marie Dupont updated");
  });

  it("shows a server phone conflict under the phone input when editing too", async () => {
    h.patch.mockRejectedValue(apiError(409, "Conflict", [{ field: "phone", message: DUPLICATE }]));
    renderDialog({ customer });
    fireEvent.click(submit("customers.form.save"));

    const message = await screen.findByText(DUPLICATE);
    expect(message.closest("[data-slot=form-item]")!.contains(phoneInput())).toBe(true);
  });
});
