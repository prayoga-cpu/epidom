import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { COUNTRIES, OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import { CountrySelect, buildCountryOptions } from "../country-select";
import { normalizeSearchText, searchSelectFilter } from "../search-select";
import { RENDER_TEST_TIMEOUT, installDomPolyfills, renderIn } from "./helpers";

beforeAll(installDomPolyfills);

function Controlled({
  initial = "",
  onChange,
}: {
  initial?: string;
  onChange: (code: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CountrySelect
      value={value}
      onChange={(code) => {
        setValue(code);
        onChange(code);
      }}
    />
  );
}

const trigger = () => screen.getAllByRole("combobox")[0];
const optionTexts = () => screen.getAllByRole("option").map((option) => option.textContent ?? "");

describe("buildCountryOptions", () => {
  it("puts France and Indonesia first, the rest sorted by localized name, Other last", () => {
    const options = buildCountryOptions("fr", "Autre pays");
    expect(options).toHaveLength(COUNTRIES.length + 1);
    expect(options[0]).toMatchObject({ value: "FR", label: "France" });
    expect(options[1]).toMatchObject({ value: "ID", label: "Indonésie" });
    expect(options.at(-1)).toMatchObject({
      value: OTHER_COUNTRY_CODE,
      label: "Autre pays",
      pinned: true,
    });

    const middle = options.slice(2, -1).map((option) => option.label);
    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    expect(middle).toEqual([...middle].sort((a, b) => collator.compare(a, b)));
    // French order, not English: Germany is "Allemagne", so it comes first.
    expect(middle[0]).toBe("Allemagne");
  });

  it("sorts by the Indonesian name in id", () => {
    const labels = buildCountryOptions("id", "Negara lain").map((option) => option.label);
    expect(labels.slice(0, 2)).toEqual(["Prancis", "Indonesia"]);
    expect(labels.at(-1)).toBe("Negara lain");
  });

  it("keeps the English name and code as search keywords", () => {
    const germany = buildCountryOptions("fr", "Autre pays").find((option) => option.value === "DE");
    expect(germany?.keywords).toEqual(expect.arrayContaining(["Germany", "DE"]));
    expect(germany?.leading).toBe("🇩🇪");
  });
});

describe("searchSelectFilter", () => {
  it("is accent- and case-insensitive", () => {
    expect(normalizeSearchText("Côte d’Ivoire")).toBe("cote d'ivoire");
    expect(searchSelectFilter("ID", "indonesie", ["Indonésie", "Indonesia"])).toBe(1);
    expect(searchSelectFilter("CI", "ivoire", ["Côte d’Ivoire"])).toBeGreaterThan(0);
    expect(searchSelectFilter("FR", "allem", ["France"])).toBe(0);
  });

  it("ignores hyphens, apostrophes and spaces between words", () => {
    // Real Intl French names, as buildCountryOptions("fr") produces them.
    const names = (code: string) => [
      new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code,
    ];
    expect(names("US")[0]).toBe("États-Unis");
    expect(searchSelectFilter("US", "etats unis", names("US"))).toBeGreaterThan(0);
    expect(searchSelectFilter("GB", "royaume uni", names("GB"))).toBeGreaterThan(0);
    expect(searchSelectFilter("NL", "pays bas", names("NL"))).toBeGreaterThan(0);
    expect(searchSelectFilter("CI", "cote divoire", names("CI"))).toBeGreaterThan(0);
    expect(searchSelectFilter("CI", "cote d ivoire", names("CI"))).toBeGreaterThan(0);
    expect(searchSelectFilter("US", "etatsunis", names("US"))).toBeGreaterThan(0);
    // Still a real filter: other names don't match, and punctuation alone matches nothing.
    expect(searchSelectFilter("FR", "pays bas", names("FR"))).toBe(0);
    expect(searchSelectFilter("FR", "-", names("FR"))).toBe(0);
    expect(searchSelectFilter("US", "' -", names("US"))).toBe(0);
  });

  it("matches a code only exactly", () => {
    expect(searchSelectFilter("ID", "id", ["Indonésie"])).toBe(1);
    expect(searchSelectFilter("IE", "i", ["Irlande"])).toBe(1); // by name
    expect(searchSelectFilter("DE", "d", ["Allemagne"])).toBe(0);
  });
});

describe("<CountrySelect>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("shows the placeholder until a country is chosen", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    expect(trigger()).toHaveTextContent("Choisissez un pays");
  });

  it("shows the flag and the localized name of the selected country", () => {
    renderIn("fr", <CountrySelect value="DE" onChange={vi.fn()} />);
    expect(trigger()).toHaveTextContent("🇩🇪");
    expect(trigger()).toHaveTextContent("Allemagne");
  });

  it("lists France, Indonesia first and Other country last", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    fireEvent.click(trigger());
    const texts = optionTexts();
    expect(texts).toHaveLength(COUNTRIES.length + 1);
    expect(texts[0]).toContain("France");
    expect(texts[1]).toContain("Indonésie");
    expect(texts.at(-1)).toContain("Autre pays");
  });

  it("finds a country by its French name, with or without accents", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    fireEvent.click(trigger());
    const search = screen.getByPlaceholderText("Rechercher un pays…");

    fireEvent.change(search, { target: { value: "Indonésie" } });
    let texts = optionTexts();
    expect(texts[0]).toContain("Indonésie");
    expect(texts.some((text) => text.includes("France"))).toBe(false);
    // "Other country" stays reachable whatever the search.
    expect(texts.at(-1)).toContain("Autre pays");

    fireEvent.change(search, { target: { value: "etats" } });
    texts = optionTexts();
    expect(texts[0]).toContain("États-Unis");
  });

  it("finds hyphenated French names typed with spaces", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    fireEvent.click(trigger());
    const search = screen.getByPlaceholderText("Rechercher un pays…");

    for (const [query, expected] of [
      ["royaume uni", "Royaume-Uni"],
      ["pays bas", "Pays-Bas"],
      ["etats unis", "États-Unis"],
    ] as const) {
      fireEvent.change(search, { target: { value: query } });
      expect(optionTexts()[0]).toContain(expected);
    }
  });

  it("finds a country by its English name in French", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByPlaceholderText("Rechercher un pays…"), {
      target: { value: "Germany" },
    });
    expect(optionTexts()[0]).toContain("Allemagne");
  });

  it("says nothing matches but still offers Other country", () => {
    renderIn("fr", <CountrySelect value="" onChange={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByPlaceholderText("Rechercher un pays…"), {
      target: { value: "Atlantide" },
    });
    expect(screen.getByText("Aucun pays ne correspond à votre recherche.")).toBeInTheDocument();
    expect(optionTexts()).toEqual(["Autre pays"]);
  });

  it("selects a country and closes", () => {
    const onChange = vi.fn();
    renderIn("fr", <Controlled onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByPlaceholderText("Rechercher un pays…"), {
      target: { value: "indon" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Indonésie/ }));
    expect(onChange).toHaveBeenCalledWith("ID");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Indonésie");
  });

  it("selects Other country", () => {
    const onChange = vi.fn();
    renderIn("en", <Controlled onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: /Other country/ }));
    expect(onChange).toHaveBeenCalledWith(OTHER_COUNTRY_CODE);
    expect(trigger()).toHaveTextContent("Other country");
  });

  it("forwards form wiring to the trigger", () => {
    renderIn(
      "en",
      <CountrySelect value="" onChange={vi.fn()} id="country" aria-invalid disabled />
    );
    const button = trigger();
    expect(button).toHaveAttribute("id", "country");
    expect(button).toHaveAttribute("aria-invalid", "true");
    expect(button).toBeDisabled();
  });
});
