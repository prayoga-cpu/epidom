import { describe, it, expect } from "vitest";
import { generateSku, skuFromName } from "../sku-generator";

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

describe("skuFromName", () => {
  it("turns a name into an uppercase, accent-free, dash-separated code", () => {
    expect(skuFromName("Pâte à banana", new Set())).toBe("PATE-A-BANANA");
    expect(skuFromName("L’Espresso du Plan B", new Set())).toBe("L-ESPRESSO-DU-PLAN-B");
    expect(skuFromName("  Thé Vert / Noir ", new Set())).toBe("THE-VERT-NOIR");
  });

  it("numbers a code that is already taken, and reserves what it hands out", () => {
    const taken = new Set(["LATTE"]);
    expect(skuFromName("Latte", taken)).toBe("LATTE-2");
    expect(skuFromName("latte", taken)).toBe("LATTE-3");
    expect(taken.has("LATTE-3")).toBe(true);
  });

  it("falls back to ITEM for a name with nothing usable, and caps the length", () => {
    expect(skuFromName("★★★", new Set())).toBe("ITEM");
    const long = skuFromName("Chocolat chaud viennois à la crème fouettée maison", new Set());
    expect(long.length).toBeLessThanOrEqual(32);
    expect(long.endsWith("-")).toBe(false);
  });
});
