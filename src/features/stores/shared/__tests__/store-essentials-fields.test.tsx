import { useMemo } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/components/lang/i18n-provider";
import { Form } from "@/components/ui/form";
import { OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import { StoreEssentialsFields, type StoreEssentialsFieldsProps } from "../store-essentials-fields";
import {
  createStoreEssentialsSchema,
  storeEssentialsDefaultValues,
  type StoreEssentialsInput,
  type StoreEssentialsValues,
} from "../schema";
import {
  RENDER_TEST_TIMEOUT,
  installDomPolyfills,
  mockBrowserTimezone,
  renderIn,
} from "./helpers";

beforeAll(installDomPolyfills);
afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({
  onSubmit,
  defaults,
  fieldProps,
}: {
  onSubmit: (values: StoreEssentialsValues) => void;
  defaults?: Partial<StoreEssentialsInput>;
  fieldProps?: StoreEssentialsFieldsProps;
}) {
  const { t } = useI18n();
  const schema = useMemo(() => createStoreEssentialsSchema(t), [t]);
  const form = useForm<StoreEssentialsInput, unknown, StoreEssentialsValues>({
    resolver: zodResolver(schema),
    defaultValues: storeEssentialsDefaultValues(defaults),
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <StoreEssentialsFields {...fieldProps} />
        <button type="submit">submit</button>
      </form>
    </Form>
  );
}

const countryTrigger = () => screen.getAllByRole("combobox")[0];
const submit = () => fireEvent.click(screen.getByRole("button", { name: "submit" }));

function pickCountry(name: RegExp) {
  fireEvent.click(countryTrigger());
  fireEvent.click(screen.getByRole("option", { name }));
}

describe("<StoreEssentialsFields>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("asks name, country, city, business type, in that order, then the market summary", () => {
    mockBrowserTimezone("Europe/Paris");
    const { container } = renderIn("en", <Harness onSubmit={vi.fn()} />);
    const labels = Array.from(container.querySelectorAll("label")).map((label) =>
      label.textContent?.replace(/\s+/g, " ").trim()
    );
    expect(labels).toEqual([
      "Store name *",
      "Country *",
      "City (optional)",
      "Type of business (optional)",
    ]);
    const summary = screen.getByTestId("market-summary");
    const chips = screen.getByRole("group", { name: /Type of business/ });
    expect(chips.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pre-fills the country from the browser's timezone", async () => {
    mockBrowserTimezone("Europe/Paris");
    renderIn("en", <Harness onSubmit={vi.fn()} />);
    await waitFor(() => expect(countryTrigger()).toHaveTextContent("France"));
    expect(screen.getByTestId("market-summary")).toHaveTextContent("EUR (€)");
  });

  it("never overwrites a country already in the form", async () => {
    mockBrowserTimezone("Europe/Paris");
    renderIn("en", <Harness onSubmit={vi.fn()} defaults={{ countryCode: "ID" }} />);
    await waitFor(() => expect(countryTrigger()).toHaveTextContent("Indonesia"));
    expect(screen.getByTestId("market-summary")).toHaveTextContent("IDR (Rp)");
  });

  it("leaves the country empty when auto-detect is off", () => {
    mockBrowserTimezone("Europe/Paris");
    renderIn("en", <Harness onSubmit={vi.fn()} fieldProps={{ autoDetectCountry: false }} />);
    expect(countryTrigger()).toHaveTextContent("Choose a country");
    expect(screen.queryByTestId("market-summary")).not.toBeInTheDocument();
  });

  it("shows localized errors for a missing name and country", async () => {
    const onSubmit = vi.fn();
    renderIn("fr", <Harness onSubmit={onSubmit} fieldProps={{ autoDetectCountry: false }} />);
    submit();
    expect(await screen.findByText("Indiquez le nom de votre établissement.")).toBeInTheDocument();
    expect(screen.getByText("Choisissez le pays de votre établissement.")).toBeInTheDocument();
    expect(countryTrigger()).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the essentials", async () => {
    mockBrowserTimezone("America/Lima");
    const onSubmit = vi.fn();
    renderIn("fr", <Harness onSubmit={onSubmit} fieldProps={{ autoFocusName: true }} />);

    const name = screen.getByLabelText(/Nom de l'établissement/);
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "  Le Petit Four " } });
    fireEvent.change(screen.getByPlaceholderText("ex. Lyon"), { target: { value: "Lyon" } });
    pickCountry(/France/);
    fireEvent.click(screen.getByRole("button", { name: "Boulangerie-pâtisserie" }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Le Petit Four",
      countryCode: "FR",
      city: "Lyon",
      businessType: "bakery",
      currency: undefined,
    });
  });

  it("asks for a currency for Other country, and drops it for a listed country", async () => {
    mockBrowserTimezone("Europe/Paris");
    const onSubmit = vi.fn();
    renderIn("en", <Harness onSubmit={onSubmit} defaults={{ name: "Mama's Kitchen" }} />);
    await waitFor(() => expect(countryTrigger()).toHaveTextContent("France"));

    pickCountry(/Other country/);
    const currencyPicker = await screen.findByRole("combobox", { name: "Currency" });
    await waitFor(() => expect(currencyPicker).toHaveTextContent("USD"));

    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      countryCode: OTHER_COUNTRY_CODE,
      currency: "USD",
    });

    pickCountry(/Singapore/);
    expect(screen.queryByRole("combobox", { name: "Currency" })).not.toBeInTheDocument();
    expect(screen.getByTestId("market-summary")).toHaveTextContent("SGD");
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ countryCode: "SG", currency: undefined });
  });

  it("clears a business type the form started with when its chip is tapped again", async () => {
    // react-hook-form's useController falls back to the mount-time value when a
    // field becomes undefined, so a cleared chip used to snap back to pressed.
    mockBrowserTimezone("Europe/Paris");
    const onSubmit = vi.fn();
    renderIn(
      "en",
      <Harness
        onSubmit={onSubmit}
        defaults={{ name: "Le Fournil", countryCode: "FR", businessType: "bakery" }}
      />
    );
    const bakery = () => screen.getByRole("button", { name: "Bakery" });
    expect(bakery()).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(bakery());
    await waitFor(() => expect(bakery()).toHaveAttribute("aria-pressed", "false"));
    screen
      .getByRole("group", { name: /Type of business/ })
      .querySelectorAll("button")
      .forEach((chip) => expect(chip).toHaveAttribute("aria-pressed", "false"));

    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].businessType).toBeUndefined();

    // And the toggle keeps working afterwards.
    fireEvent.click(screen.getByRole("button", { name: "Café" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Café" })).toHaveAttribute("aria-pressed", "true")
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0].businessType).toBe("cafe");
  });

  it("hides the business type and the market summary on request", async () => {
    mockBrowserTimezone("Europe/Paris");
    renderIn(
      "en",
      <Harness
        onSubmit={vi.fn()}
        fieldProps={{
          showBusinessType: false,
          showMarketSummary: false,
          nameLabel: "Location name",
          namePlaceholder: "e.g. Downtown",
        }}
      />
    );
    await waitFor(() => expect(countryTrigger()).toHaveTextContent("France"));
    expect(screen.queryByRole("group", { name: /Type of business/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("market-summary")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Location name/)).toHaveAttribute("placeholder", "e.g. Downtown");
  });
});
