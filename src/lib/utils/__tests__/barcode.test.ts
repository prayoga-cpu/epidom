import { describe, it, expect } from "vitest";
import { parseImportedBarcode } from "../barcode";

describe("parseImportedBarcode", () => {
  it("treats a missing or blank cell as 'no barcode' — never an error, never a value", () => {
    for (const v of [undefined, null, "", "   ", "\t"]) {
      expect(parseImportedBarcode(v), JSON.stringify(v)).toEqual({});
    }
  });

  it("stringifies the NUMBER a spreadsheet hands over for a numeric cell", () => {
    expect(parseImportedBarcode(8991234567890)).toEqual({ barcode: "8991234567890" });
  });

  it("trims and keeps the case (the POS scanner matches exactly)", () => {
    expect(parseImportedBarcode("  AbC-123 ")).toEqual({ barcode: "AbC-123" });
  });

  it("refuses what the product form would refuse, with a row-level message", () => {
    for (const bad of ["12 34", "abc$", "é1", "x".repeat(65)]) {
      const out = parseImportedBarcode(bad);
      expect(out.barcode, bad).toBeUndefined();
      expect(out.error, bad).toMatch(/Barcode ".*" is invalid/);
    }
  });

  it("does not echo an arbitrarily long cell into the error", () => {
    expect(parseImportedBarcode("x".repeat(500)).error!.length).toBeLessThan(160);
  });
});
