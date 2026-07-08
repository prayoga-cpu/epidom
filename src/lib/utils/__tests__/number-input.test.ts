/**
 * Number Input Utilities Tests
 *
 * Regression coverage for the comma-decimal parsing bug: `parseNumberInput`
 * (backed by `parseFloat`) silently truncates comma-decimal input —
 * `parseFloat("0,02")` returns `0`, not `0.02` — blocking French-locale users
 * (and anyone using a comma) from entering small decimals like 0,02 or 0,002.
 */

import { describe, it, expect } from "vitest";
import { parseLocaleDecimal } from "../number-input";

describe("parseLocaleDecimal", () => {
  it("parses comma-decimal input", () => {
    expect(parseLocaleDecimal("0,02")).toBe(0.02);
    expect(parseLocaleDecimal("0,002")).toBe(0.002);
    expect(parseLocaleDecimal("1,5")).toBe(1.5);
  });

  it("parses period-decimal input", () => {
    expect(parseLocaleDecimal("0.02")).toBe(0.02);
    expect(parseLocaleDecimal("1.5")).toBe(1.5);
  });

  it("parses plain integers", () => {
    expect(parseLocaleDecimal("100")).toBe(100);
    expect(parseLocaleDecimal("0")).toBe(0);
  });

  it("handles a trailing separator with no fractional digits", () => {
    expect(parseLocaleDecimal("12,")).toBe(12);
    expect(parseLocaleDecimal("12.")).toBe(12);
  });

  it("returns undefined for empty input", () => {
    expect(parseLocaleDecimal("")).toBeUndefined();
  });

  it("returns undefined for unparseable input", () => {
    expect(parseLocaleDecimal("abc")).toBeUndefined();
  });

  it("parses negative values", () => {
    expect(parseLocaleDecimal("-0,5")).toBe(-0.5);
    expect(parseLocaleDecimal("-1.25")).toBe(-1.25);
  });
});
