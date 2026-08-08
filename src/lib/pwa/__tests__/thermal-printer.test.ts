/**
 * Thermal Printer Receipt Builder Tests
 *
 * Regression coverage for the store-name truncation bug ("TAHOMA CAFE &
 * EATERY" printing as "TAHOMA CAFE & EA") and the tax/service-charge line
 * items that were silently dropped from the printed receipt.
 */
import { describe, it, expect } from "vitest";
import { wrapText, buildEscPos, type ReceiptData } from "../thermal-printer";

function decode(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

const BASE_RECEIPT: ReceiptData = {
  storeName: "Epidom POS",
  orderNumber: "POS-20260808-0001",
  date: "08/08/2026 18:35",
  items: [{ name: "Salt Bread", quantity: 1, unitPrice: 25000, total: 25000 }],
  subtotal: 25000,
  total: 25000,
  paymentMethod: "CASH",
};

describe("wrapText", () => {
  it("wraps on word boundaries instead of cutting mid-word", () => {
    const lines = wrapText("TAHOMA CAFE & EATERY", 16);
    expect(lines.join(" ")).toBe("TAHOMA CAFE & EATERY");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(16);
  });

  it("hard-breaks a single word longer than the column width", () => {
    const lines = wrapText("Supercalifragilisticexpialidocious", 10);
    expect(lines.join("")).toBe("Supercalifragilisticexpialidocious");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
  });

  it("preserves explicit newlines as hard line breaks", () => {
    const lines = wrapText("Terima kasih!\nSilakan datang kembali", 32);
    expect(lines).toEqual(["Terima kasih!", "Silakan datang kembali"]);
  });

  it("returns an empty array for empty input", () => {
    expect(wrapText("", 32)).toEqual([]);
  });
});

describe("buildEscPos", () => {
  it("never truncates a long store name (regression: TAHOMA CAFE & EATERY bug)", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, storeName: "TAHOMA CAFE & EATERY", width: 32 })
    );
    expect(output).toContain("EATERY");
    expect(output).not.toContain("TAHOMA CAFE & EA\n");
  });

  it("does not truncate a long item name", () => {
    const longName = "Konsultasi model rambut, Potong rambut, Cuci rambut, Hair tonic";
    const output = decode(
      buildEscPos({
        ...BASE_RECEIPT,
        items: [{ name: longName, quantity: 1, unitPrice: 74999, total: 74999 }],
        width: 32,
      })
    );
    expect(output).toContain("Hair tonic");
  });

  it("prints a tax line when tax is present, using the store's tax label", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, tax: 2500, taxLabel: "PB1 (10%)", width: 32 })
    );
    expect(output).toContain("PB1 (10%)");
  });

  it("omits the tax line when there is no tax", () => {
    const output = decode(buildEscPos({ ...BASE_RECEIPT, width: 32 }));
    expect(output).not.toContain("Pajak");
  });

  it("prints TUNAI/KEMBALI for cash payments with an amount tendered", () => {
    const output = decode(
      buildEscPos({ ...BASE_RECEIPT, paymentMethod: "CASH", amountTendered: 30000, change: 5000 })
    );
    expect(output).toContain("TUNAI");
    expect(output).toContain("KEMBALI");
  });

  it("prints a LUNAS marker instead of TUNAI/KEMBALI for non-cash payments", () => {
    const output = decode(buildEscPos({ ...BASE_RECEIPT, paymentMethod: "QRIS" }));
    expect(output).toContain("LUNAS");
    expect(output).not.toContain("TUNAI");
  });

  it("wraps the store name narrower on 58mm (32 cols) than 80mm (48 cols)", () => {
    const name = "TAHOMA CAFE & EATERY";
    const narrow = wrapText(name, Math.floor(32 / 2));
    const wide = wrapText(name, Math.floor(48 / 2));
    expect(narrow.length).toBeGreaterThanOrEqual(wide.length);
  });
});
