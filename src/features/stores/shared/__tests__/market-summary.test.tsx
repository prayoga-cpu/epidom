import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import { MarketSummary, buildCurrencyOptions } from "../market-summary";
import { RENDER_TEST_TIMEOUT, installDomPolyfills, renderIn } from "./helpers";

beforeAll(installDomPolyfills);

const summary = () => screen.getByTestId("market-summary");

describe("<MarketSummary>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("renders nothing without a country", () => {
    const { container } = renderIn("en", <MarketSummary countryCode="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what France sets up, in French", () => {
    renderIn("fr", <MarketSummary countryCode="FR" />);
    const panel = summary();
    expect(panel).toHaveTextContent("Configuré pour vous");
    expect(panel).toHaveTextContent("EUR (€)");
    expect(panel).toHaveTextContent("Europe/Paris");
    expect(panel).toHaveTextContent("Espèces");
    expect(panel).toHaveTextContent("Titre-Restaurant");
    expect(panel).toHaveTextContent("Chèque");
    expect(panel).toHaveTextContent("Uber Eats");
    expect(panel).toHaveTextContent("Deliveroo");
    expect(panel).toHaveTextContent("Just Eat");
    // The catch-all platform is not a real platform to announce.
    expect(panel).not.toHaveTextContent("Autre plateforme");
    expect(panel).not.toHaveTextContent("GoFood");
    expect(panel).toHaveTextContent(
      "Vous pourrez modifier la devise et les paiements plus tard dans Profil → Frais & Taxes."
    );
    // The zone is changed with the business info, not in Fees & Taxes.
    expect(panel).toHaveTextContent(
      "Le fuseau horaire est commun à tous vos établissements. Modifiez-le dans Profil → Informations sur l'entreprise."
    );
  });

  it("keeps the country's main zone when the browser is elsewhere", () => {
    renderIn("fr", <MarketSummary countryCode="FR" browserTimezone="Asia/Jakarta" />);
    expect(summary()).toHaveTextContent("Europe/Paris");
  });

  it("shows what Indonesia sets up, in Indonesian, with the browser's local zone", () => {
    renderIn("id", <MarketSummary countryCode="ID" browserTimezone="Asia/Makassar" />);
    const panel = summary();
    expect(panel).toHaveTextContent("IDR (Rp)");
    expect(panel).toHaveTextContent("Asia/Makassar");
    for (const method of ["Tunai / Cash", "QRIS", "GoPay", "OVO", "DANA", "ShopeePay"]) {
      expect(panel).toHaveTextContent(method);
    }
    for (const platform of ["GoFood", "GrabFood", "ShopeeFood"]) {
      expect(panel).toHaveTextContent(platform);
    }
    expect(panel).not.toHaveTextContent("Uber Eats");
    expect(panel).toHaveTextContent("Profil → Biaya & Pajak");
  });

  it("uses the international market for other listed countries", () => {
    renderIn("en", <MarketSummary countryCode="GB" />);
    const panel = summary();
    expect(panel).toHaveTextContent("GBP (£)");
    expect(panel).toHaveTextContent("Europe/London");
    expect(panel).toHaveTextContent("PayPal");
    expect(panel).toHaveTextContent("DoorDash");
    expect(panel).toHaveTextContent(
      "You can change the currency and payments later in Profile → Fees & Taxes."
    );
  });

  it("shows the time zone it is given instead of the country's", () => {
    // Create a store: the zone is the business's, whatever country the store is in.
    renderIn("en", <MarketSummary countryCode="ID" timezone="Europe/Paris" />);
    const panel = summary();
    expect(panel).toHaveTextContent("Time zone");
    expect(panel).toHaveTextContent("Europe/Paris");
    expect(panel).not.toHaveTextContent("Asia/Jakarta");
    expect(panel).toHaveTextContent("IDR (Rp)");
    // Where to change it: Business Information, never Fees & Taxes.
    expect(panel).toHaveTextContent(
      "The time zone is shared by all your stores. Change it in Profile → Business Information."
    );
  });

  it("hides the time zone row when told the zone is not set here", () => {
    renderIn("en", <MarketSummary countryCode="ID" browserTimezone="Asia/Jakarta" timezone={null} />);
    const panel = summary();
    expect(panel).not.toHaveTextContent("Time zone");
    expect(panel).not.toHaveTextContent("Asia/Jakarta");
    // The rest of the panel is unchanged.
    expect(panel).toHaveTextContent("IDR (Rp)");
    expect(panel).toHaveTextContent("QRIS");
    // No zone row, so no hint about where to change it.
    expect(panel).not.toHaveTextContent("Business Information");
  });

  it("shows the country's time zone when no override is given", () => {
    renderIn("en", <MarketSummary countryCode="ID" timezone={undefined} />);
    expect(summary()).toHaveTextContent("Asia/Jakarta");
  });

  it("shows the chosen currency as text for Other country without a handler", () => {
    renderIn("en", <MarketSummary countryCode={OTHER_COUNTRY_CODE} currency="XAF" />);
    expect(summary()).toHaveTextContent("XAF");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lets the owner pick the currency for Other country", () => {
    const onCurrencyChange = vi.fn();
    function Controlled() {
      const [currency, setCurrency] = useState("USD");
      return (
        <MarketSummary
          countryCode={OTHER_COUNTRY_CODE}
          currency={currency}
          browserTimezone="America/Lima"
          onCurrencyChange={(code) => {
            setCurrency(code);
            onCurrencyChange(code);
          }}
        />
      );
    }
    renderIn("fr", <Controlled />);

    // The browser's own zone is used as-is for Other.
    expect(summary()).toHaveTextContent("America/Lima");
    const picker = screen.getByRole("combobox", { name: "Devise" });
    expect(picker).toHaveTextContent("USD");

    fireEvent.click(picker);
    fireEvent.change(screen.getByPlaceholderText("Rechercher une devise…"), {
      target: { value: "yen" },
    });
    fireEvent.click(screen.getByRole("option", { name: /JPY/ }));
    expect(onCurrencyChange).toHaveBeenCalledWith("JPY");
    expect(screen.getByRole("combobox", { name: "Devise" })).toHaveTextContent("JPY");
  });
});

describe("buildCurrencyOptions", () => {
  it("lists USD, EUR and GBP first, then the rest by code, with localized names", () => {
    const options = buildCurrencyOptions("fr");
    expect(options.slice(0, 3).map((option) => option.value)).toEqual(["USD", "EUR", "GBP"]);
    const rest = options.slice(3).map((option) => option.value);
    expect(rest).toEqual([...rest].sort());
    const jpy = options.find((option) => option.value === "JPY");
    expect(jpy?.keywords).toEqual(expect.arrayContaining(["JPY", "Japanese Yen"]));
    expect(jpy?.label).toMatch(/^JPY · yen/i);
  });
});
