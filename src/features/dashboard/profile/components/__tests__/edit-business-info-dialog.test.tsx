import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RENDER_TEST_TIMEOUT,
  installDomPolyfills,
  renderIn,
} from "@/features/stores/shared/__tests__/helpers";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../hooks/use-profile", () => ({
  useUpdateBusiness: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
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

import {
  EditBusinessInfoDialog,
  buildBusinessPayload,
  businessFormDefaults,
  type EditBusinessInfoDialogBusiness,
} from "../edit-business-info-dialog";

const business: EditBusinessInfoDialogBusiness = {
  id: "b1",
  name: "Le Comptoir SAS",
  address: null,
  city: "Paris",
  country: "France",
  phone: null,
  email: "contact@comptoir.fr",
  website: null,
  timezone: "Europe/Paris",
};

function renderDialog(value: EditBusinessInfoDialogBusiness | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  renderIn(
    "en",
    <QueryClientProvider client={client}>
      <EditBusinessInfoDialog open onOpenChange={onOpenChange} business={value} userId="u1" />
    </QueryClientProvider>
  );
  return { onOpenChange };
}

const timezoneTrigger = () => screen.getByLabelText("Business time zone");
const countryTrigger = () => screen.getByLabelText("Country");

function pickTimezone(search: string, name: RegExp) {
  fireEvent.click(timezoneTrigger());
  fireEvent.change(screen.getByPlaceholderText("Search for a city or time zone…"), {
    target: { value: search },
  });
  fireEvent.click(screen.getByRole("option", { name }));
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
}

beforeAll(installDomPolyfills);
beforeEach(() => {
  h.mutateAsync.mockReset();
  h.mutateAsync.mockResolvedValue({});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("<EditBusinessInfoDialog> — business timezone", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("shows the current zone with its offset and the helper text", () => {
    renderDialog(business);
    expect(timezoneTrigger()).toHaveTextContent(/Europe\/Paris \(UTC\+0[12]:00\)/);
    expect(screen.getByText("Used for attendance, shifts and reports.")).toBeInTheDocument();
  });

  it("saves a newly picked zone through useUpdateBusiness", async () => {
    const { onOpenChange } = renderDialog(business);

    pickTimezone("Makassar", /Asia\/Makassar/);
    expect(timezoneTrigger()).toHaveTextContent("Asia/Makassar (UTC+08:00)");
    save();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "Le Comptoir SAS", timezone: "Asia/Makassar" });
    // The country wasn't touched, so it isn't rewritten.
    expect(payload).not.toHaveProperty("country");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("saves a new zone for a business with no email (the wizard never sets one)", async () => {
    const { onOpenChange } = renderDialog({ ...business, email: null });

    pickTimezone("Makassar", /Asia\/Makassar/);
    save();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ timezone: "Asia/Makassar" });
    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
    expect(screen.queryByText("Invalid email format")).not.toBeInTheDocument();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("an unchanged zone is not sent", async () => {
    renderDialog(business);
    save();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).not.toHaveProperty("timezone");
  });
});

describe("<EditBusinessInfoDialog> — business country", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("keeps legacy text it doesn't recognise until a country is picked", async () => {
    renderDialog({ ...business, country: "Bali" });

    expect(countryTrigger()).toHaveTextContent("Bali");
    expect(screen.getByText(/Saved as “Bali”/)).toBeInTheDocument();
    save();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).not.toHaveProperty("country");
  });

  it("a picked country is saved as its English name", async () => {
    renderDialog({ ...business, country: "Bali" });

    fireEvent.click(countryTrigger());
    fireEvent.click(screen.getByRole("option", { name: /Indonesia/ }));
    save();

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ country: "Indonesia" });
  });
});

describe("buildBusinessPayload", () => {
  it("'Other country' saves the typed name", () => {
    const initial = businessFormDefaults(business);
    const payload = buildBusinessPayload(
      { ...initial, countryCode: "ZZ", country: " Japan " },
      initial,
      false
    );
    expect(payload.country).toBe("Japan");
  });

  it("a new business always sends its timezone", () => {
    const initial = businessFormDefaults(null);
    const payload = buildBusinessPayload(
      { ...initial, name: "New Co", timezone: "Europe/Paris" },
      { ...initial, timezone: "Europe/Paris" },
      true
    );
    expect(payload.timezone).toBe("Europe/Paris");
  });
});
