import { describe, it, expect } from "vitest";
import { convertUnit, isMassUnit, isVolumeUnit, areUnitsCompatible } from "../unit-conversion";

describe("convertUnit", () => {
  it("converts grams to kilograms", () => {
    expect(convertUnit(1000, "g", "kg")).toBe(1);
  });

  it("converts kilograms to grams", () => {
    expect(convertUnit(1, "kg", "g")).toBe(1000);
  });

  it("converts between milliliters and liters", () => {
    expect(convertUnit(1000, "ml", "l")).toBe(1);
    expect(convertUnit(1, "l", "ml")).toBe(1000);
  });

  it("returns the same quantity unchanged when units already match", () => {
    expect(convertUnit(500, "g", "g")).toBe(500);
  });

  it("is case-insensitive", () => {
    expect(convertUnit(1000, "G", "KG")).toBe(1);
  });

  it("leaves incompatible/count-based units unconverted", () => {
    expect(convertUnit(5, "pcs", "box")).toBe(5);
    expect(convertUnit(3, "kg", "pcs")).toBe(3);
  });

  it("never mixes mass and volume conversion factors", () => {
    // "l" and "kg" are different unit families - not directly convertible,
    // so the value should pass through unchanged rather than silently
    // applying the wrong factor.
    expect(convertUnit(2, "l", "kg")).toBe(2);
  });
});

describe("isMassUnit / isVolumeUnit", () => {
  it("classifies mass units", () => {
    for (const unit of ["mg", "g", "kg", "oz", "lb"]) {
      expect(isMassUnit(unit)).toBe(true);
      expect(isVolumeUnit(unit)).toBe(false);
    }
  });

  it("classifies volume units", () => {
    for (const unit of ["ml", "cl", "dl", "l"]) {
      expect(isVolumeUnit(unit)).toBe(true);
      expect(isMassUnit(unit)).toBe(false);
    }
  });

  it("treats count-based units as neither", () => {
    expect(isMassUnit("pcs")).toBe(false);
    expect(isVolumeUnit("pcs")).toBe(false);
  });
});

describe("areUnitsCompatible", () => {
  it("treats same-family units as compatible", () => {
    expect(areUnitsCompatible("g", "kg")).toBe(true);
    expect(areUnitsCompatible("ml", "l")).toBe(true);
  });

  it("treats cross-family units as incompatible", () => {
    expect(areUnitsCompatible("g", "ml")).toBe(false);
  });

  it("treats identical unrecognized units as compatible", () => {
    expect(areUnitsCompatible("pcs", "pcs")).toBe(true);
  });
});
