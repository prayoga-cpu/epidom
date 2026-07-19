import { describe, it, expect } from "vitest";
import { generateSku } from "../sku-generator";

describe("generateSku", () => {
  it("builds CATEGORY-NAME-suffix from letters only, uppercased", () => {
    const sku = generateSku("Dark Chocolate", "Chocolate");
    expect(sku).toMatch(/^CHO-DAR-\d{3}$/);
  });

  it("falls back to GEN when there is no category", () => {
    const sku = generateSku("Baguette");
    expect(sku).toMatch(/^GEN-BAG-\d{3}$/);
  });

  it("falls back to GEN when the category has no letters", () => {
    const sku = generateSku("Baguette", "123");
    expect(sku).toMatch(/^GEN-BAG-\d{3}$/);
  });

  it("falls back to ITM when the name has no letters", () => {
    const sku = generateSku("42", "Flour");
    expect(sku).toMatch(/^FLO-ITM-\d{3}$/);
  });

  it("handles short names/categories without padding", () => {
    const sku = generateSku("Oy", "Ab");
    expect(sku).toMatch(/^AB-OY-\d{3}$/);
  });

  it("produces different suffixes across repeated calls (not a hardcoded constant)", () => {
    const suffixes = new Set(
      Array.from({ length: 20 }, () => generateSku("Test", "Cat").split("-")[2])
    );
    expect(suffixes.size).toBeGreaterThan(1);
  });
});
