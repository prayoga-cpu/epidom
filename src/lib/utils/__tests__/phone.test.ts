import { describe, it, expect } from "vitest";
import { callingCodeForCurrency, normalizePhone, phoneSearchDigits } from "../phone";

describe("normalizePhone", () => {
  it("collapses every spelling of one number to the same E.164 string", () => {
    const spellings = [
      "+33 6 12 34 56 78",
      "+33-6-12-34-56-78",
      "0033 6 12 34 56 78",
      "+33 (0)6 12 34 56 78", // the bracketed trunk 0 must not leak into the number
      "+33.6.12.34.56.78",
    ];
    for (const s of spellings) expect(normalizePhone(s), s).toBe("+33612345678");
  });

  it("turns a national number into E.164 only when it knows the country", () => {
    expect(normalizePhone("06 12 34 56 78", { defaultCallingCode: "33" })).toBe("+33612345678");
    expect(normalizePhone("0812-3456-7890", { defaultCallingCode: "62" })).toBe("+6281234567890");
    // Typed with the country code but no "+".
    expect(normalizePhone("6281234567890", { defaultCallingCode: "62" })).toBe("+6281234567890");
    // No country to assume => refuse rather than guess (a wrong guess merges two people).
    expect(normalizePhone("0612345678")).toBeNull();
    expect(normalizePhone("612345678", { defaultCallingCode: "33" })).toBeNull();
  });

  it("rejects junk, too-short and too-long numbers", () => {
    for (const bad of [
      "",
      "   ",
      "abc",
      "+",
      "+0123456789",
      "+12345",
      "+1234567890123456",
      "12-ab-34",
    ]) {
      expect(normalizePhone(bad, { defaultCallingCode: "33" }), bad).toBeNull();
    }
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("is idempotent", () => {
    const once = normalizePhone("+62 812-3456-7890")!;
    expect(normalizePhone(once)).toBe(once);
  });
});

describe("callingCodeForCurrency", () => {
  it("maps the store currencies we support, case-insensitively", () => {
    expect(callingCodeForCurrency("IDR")).toBe("62");
    expect(callingCodeForCurrency("eur")).toBe("33");
    expect(callingCodeForCurrency("USD")).toBe("1");
  });
  it("returns undefined for an unknown or missing currency", () => {
    expect(callingCodeForCurrency("JPY")).toBeUndefined();
    expect(callingCodeForCurrency(null)).toBeUndefined();
  });
});

describe("phoneSearchDigits", () => {
  it("drops punctuation and the trunk 0 so a national query hits an E.164 row", () => {
    expect(phoneSearchDigits("06 12 34 56 78")).toBe("612345678");
    expect(phoneSearchDigits("+33 6 12")).toBe("33612");
    expect(phoneSearchDigits("0812-3456")).toBe("8123456");
  });
  it("returns null for queries too short to be a phone fragment", () => {
    expect(phoneSearchDigits("ana")).toBeNull();
    expect(phoneSearchDigits("06")).toBeNull();
    expect(phoneSearchDigits("12")).toBeNull();
  });
});
