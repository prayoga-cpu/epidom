import { describe, it, expect } from "vitest";
import { computeRecipeCost, ingredientCost } from "../recipe-cost";

describe("ingredientCost", () => {
  it("prices the quantity used from the pack price and size", () => {
    // 1 kg of flour for 1.20, 500 g used → 0.60
    expect(
      ingredientCost({ name: "flour", packPrice: 1.2, packSize: 1000, quantityUsed: 500 })
    ).toBeCloseTo(0.6);
  });

  it("is 0 for an incomplete line instead of NaN or Infinity", () => {
    expect(ingredientCost({ name: "", packPrice: 5, packSize: 0, quantityUsed: 10 })).toBe(0);
    expect(
      ingredientCost({ name: "", packPrice: Number.NaN, packSize: 10, quantityUsed: 10 })
    ).toBe(0);
    expect(ingredientCost({ name: "", packPrice: -5, packSize: 10, quantityUsed: 10 })).toBe(0);
  });
});

describe("computeRecipeCost", () => {
  const nasiGoreng = {
    ingredients: [
      { name: "Beras", packPrice: 15000, packSize: 1000, quantityUsed: 800 }, // 12.000
      { name: "Telur", packPrice: 30000, packSize: 10, quantityUsed: 4 }, // 12.000
      { name: "Bumbu", packPrice: 8000, packSize: 1, quantityUsed: 1 }, // 8.000
    ],
    portions: 4,
    extraPerPortion: 1000,
    targetFoodCost: 0.3,
  };

  it("works out the batch, the portion and the price for a target share", () => {
    const r = computeRecipeCost(nasiGoreng);
    expect(r.ingredientCosts).toEqual([12000, 12000, 8000]);
    expect(r.batchCost).toBe(32000);
    expect(r.costPerPortion).toBe(9000); // 32.000 / 4 + 1.000
    expect(r.suggestedPrice).toBeCloseTo(30000);
    expect(r.foodCostShare).toBeNull();
  });

  it("gives the food-cost share and margin at the visitor's own price", () => {
    const r = computeRecipeCost({ ...nasiGoreng, sellingPrice: 25000 });
    expect(r.foodCostShare).toBeCloseTo(0.36);
    expect(r.grossMarginPerPortion).toBe(16000);
    expect(r.grossMarginShare).toBeCloseTo(0.64);
  });

  it("says plainly when the price doesn't cover the cost", () => {
    const r = computeRecipeCost({ ...nasiGoreng, sellingPrice: 8000 });
    expect(r.grossMarginPerPortion).toBe(-1000);
  });

  it("treats zero or odd portion counts as one portion, and refuses a nonsense target", () => {
    expect(computeRecipeCost({ ...nasiGoreng, portions: 0 }).costPerPortion).toBe(33000);
    expect(computeRecipeCost({ ...nasiGoreng, portions: 2.7 }).costPerPortion).toBe(17000);
    expect(computeRecipeCost({ ...nasiGoreng, targetFoodCost: 0 }).suggestedPrice).toBeNull();
    expect(computeRecipeCost({ ...nasiGoreng, targetFoodCost: 1.5 }).suggestedPrice).toBeNull();
  });
});
