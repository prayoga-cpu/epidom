import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { detectPriceCurrency, usePriceCurrency } from "../use-price-currency";

function inTimezone(timeZone: string) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  return vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat
  ) {
    return { ...original.call(this), timeZone };
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("detectPriceCurrency", () => {
  it("uses the currency of the country the device is in, when Epidom quotes it", () => {
    inTimezone("Europe/Paris");
    expect(detectPriceCurrency("en")).toBe("EUR");
  });

  it("an English-speaking visitor in Bali is quoted in rupiah", () => {
    inTimezone("Asia/Makassar");
    expect(detectPriceCurrency("en")).toBe("IDR");
  });

  it("falls back to the language's currency when the country's isn't one of the three", () => {
    inTimezone("Asia/Tokyo");
    expect(detectPriceCurrency("fr")).toBe("EUR");
    expect(detectPriceCurrency("en")).toBe("USD");
    expect(detectPriceCurrency("id")).toBe("IDR");
  });
});

describe("usePriceCurrency", () => {
  it("starts with the language's currency, then the detected one", async () => {
    inTimezone("Asia/Jakarta");
    const { result } = renderHook(() => usePriceCurrency("en"));
    expect(result.current[0]).toBe("IDR");
  });

  it("a change is remembered and wins over detection next time", () => {
    inTimezone("Europe/Paris");
    const first = renderHook(() => usePriceCurrency("fr"));
    expect(first.result.current[0]).toBe("EUR");
    act(() => first.result.current[1]("USD"));
    expect(first.result.current[0]).toBe("USD");
    first.unmount();

    const second = renderHook(() => usePriceCurrency("fr"));
    expect(second.result.current[0]).toBe("USD");
  });
});
