import { describe, expect, it } from "vitest";
import { parseGlobalNumber, parseImportedMoney } from "../import-number";

describe("parseGlobalNumber", () => {
  it("reads the common formats", () => {
    expect(parseGlobalNumber("$5,000.00")).toBe(5000);
    expect(parseGlobalNumber("1.500,50")).toBe(1500.5);
    expect(parseGlobalNumber("0,5")).toBe(0.5);
    expect(parseGlobalNumber("12,000")).toBe(12000);
    expect(parseGlobalNumber("1.000.000")).toBe(1000000);
    expect(parseGlobalNumber(42)).toBe(42);
  });

  it("is 0 for nothing usable", () => {
    expect(parseGlobalNumber("")).toBe(0);
    expect(parseGlobalNumber(null)).toBe(0);
    expect(parseGlobalNumber(undefined)).toBe(0);
    expect(parseGlobalNumber("abc")).toBe(0);
  });

  it("keeps a single dot as a decimal point: a quantity of 1.500 kg is one and a half", () => {
    expect(parseGlobalNumber("1.500")).toBe(1.5);
  });
});

describe("parseImportedMoney", () => {
  // The bug: "Rp 10.000" on an Indonesian menu was stored as Rp 10.
  it("reads dot-grouped thousands as thousands in a currency without decimals", () => {
    expect(parseImportedMoney("10.000", 0)).toBe(10000);
    expect(parseImportedMoney("Rp 25.000", 0)).toBe(25000);
    expect(parseImportedMoney("1.250.000", 0)).toBe(1250000);
    expect(parseImportedMoney("8.000 Ar", 0)).toBe(8000);
  });

  it("never turns a small decimal into thousands", () => {
    expect(parseImportedMoney("0.025", 0)).toBe(0.025);
    expect(parseImportedMoney("0.500", 0)).toBe(0.5);
  });

  // 1.375 per kilo is a real euro figure; 1375 would be the same mistake reversed.
  it("keeps the same shape a decimal in a currency with decimals", () => {
    expect(parseImportedMoney("1.375", 2)).toBe(1.375);
    expect(parseImportedMoney("1.375")).toBe(1.375);
    expect(parseImportedMoney("1.500", 3)).toBe(1.5);
  });

  it("leaves every other format to parseGlobalNumber", () => {
    for (const decimals of [0, 2]) {
      expect(parseImportedMoney("4.50", decimals)).toBe(4.5);
      expect(parseImportedMoney("4,50", decimals)).toBe(4.5);
      expect(parseImportedMoney("12.5", decimals)).toBe(12.5);
      expect(parseImportedMoney("1.500,50", decimals)).toBe(1500.5);
      expect(parseImportedMoney("12,000", decimals)).toBe(12000);
      expect(parseImportedMoney("12000", decimals)).toBe(12000);
      expect(parseImportedMoney(6000, decimals)).toBe(6000);
      expect(parseImportedMoney("", decimals)).toBe(0);
      expect(parseImportedMoney(undefined, decimals)).toBe(0);
    }
  });
});
