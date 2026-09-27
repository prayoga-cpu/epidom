import { describe, it, expect } from "vitest";
import { CURRENCIES } from "@/lib/constants/currencies";
import {
  COUNTRIES,
  COUNTRY_CODES,
  OTHER_COUNTRY_CODE,
  countryCodeFromName,
  examplePrices,
  getCountry,
  guessCountryCode,
  isValidTimezone,
  resolveMarketDefaults,
} from "../markets";

/**
 * The country table decides a new store's currency, market, timezone and
 * customer language, and MenuItem.currency is fixed when an item is created:
 * a wrong row here prices a whole menu in the wrong currency.
 */

describe("French Polynesia and New Caledonia (CFP franc, not EUR)", () => {
  it.each([
    ["Pacific/Tahiti", "PF"],
    ["Pacific/Marquesas", "PF"],
    ["Pacific/Gambier", "PF"],
    ["Pacific/Noumea", "NC"],
  ])("a browser in %s guesses %s, not France", (browserTimezone, code) => {
    expect(guessCountryCode({ browserTimezone, uiLocale: "fr" })).toBe(code);
  });

  it("they resolve to XPF on the INTERNATIONAL market, keeping the local zone and French", () => {
    expect(
      resolveMarketDefaults({ countryCode: "PF", browserTimezone: "Pacific/Marquesas" })
    ).toEqual({
      countryCode: "PF",
      countryName: "French Polynesia",
      currency: "XPF",
      market: "INTERNATIONAL",
      timezone: "Pacific/Marquesas",
      locale: "fr",
    });
    expect(resolveMarketDefaults({ countryCode: "NC" })).toMatchObject({
      countryName: "New Caledonia",
      currency: "XPF",
      timezone: "Pacific/Noumea",
      locale: "fr",
    });
  });

  it("France keeps its EUR overseas departments and none of the XPF zones", () => {
    const france = getCountry("FR")!;
    expect(france.currency).toBe("EUR");
    expect(france.timezones).toContain("Indian/Reunion");
    expect(france.timezones).not.toContain("Pacific/Tahiti");
    expect(france.timezones).not.toContain("Pacific/Noumea");
  });

  it("the wizard and the store dialog accept the new codes", () => {
    expect(COUNTRY_CODES).toEqual(expect.arrayContaining(["PF", "NC", OTHER_COUNTRY_CODE]));
  });

  it("XPF placeholders are whole numbers of the right magnitude (XPF has no decimals)", () => {
    const prices = examplePrices("XPF");
    expect(prices.every(Number.isInteger)).toBe(true);
    expect(Math.min(...prices)).toBeGreaterThanOrEqual(100);
  });
});

describe("the country table", () => {
  it("never lists a timezone under two countries (the guess must be unambiguous)", () => {
    const owner = new Map<string, string>();
    for (const country of COUNTRIES) {
      for (const zone of country.timezones) {
        expect(owner.get(zone), `${zone} is listed under ${owner.get(zone)} and ${country.code}`)
          .toBeUndefined();
        owner.set(zone, country.code);
      }
    }
  });

  it("every timezone is one the runtime knows", () => {
    for (const country of COUNTRIES) {
      for (const zone of country.timezones) expect(isValidTimezone(zone), zone).toBe(true);
    }
  });

  it("every currency is one the site-wide currency pickers offer", () => {
    const known = new Set(CURRENCIES.map((c) => c.code));
    for (const country of COUNTRIES) {
      expect(known.has(country.currency), `${country.code}: ${country.currency}`).toBe(true);
    }
  });

  it("every stored English name reads back to its code (how a saved business is re-read)", () => {
    for (const country of COUNTRIES) {
      expect(countryCodeFromName(country.name), country.name).toBe(country.code);
    }
  });

  it("codes are unique, and the rest follow France and Indonesia alphabetically by English name", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(COUNTRIES.slice(0, 2).map((c) => c.code)).toEqual(["FR", "ID"]);
    const names = COUNTRIES.slice(2).map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    expect(names).toEqual(sorted);
  });
});
