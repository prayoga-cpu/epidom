/**
 * Inventory Validation Schemas Tests
 *
 * Tests for product, ingredient, and recipe Zod schemas.
 */

import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  createIngredientSchema,
  updateIngredientSchema,
  createRecipeSchema,
  updateRecipeSchema,
  materialFilterSchema,
  bulkDeleteSchema,
  addMaterialSupplierSchema,
} from "../inventory.schemas";

// Valid CUID format: c + 24 lowercase alphanumeric characters = 25 total
const validCuid1 = "clz1234567890abcdefghijkl"; // 25 chars
const validCuid2 = "clz1234567890abcdefghijkm"; // 25 chars

describe("createProductSchema", () => {
  const validProduct = {
    storeId: validCuid1,
    sku: "PROD-001",
    name: "Chocolate Cake",
    costPrice: 10.0,
    sellingPrice: 25.0,
  };

  it("should validate valid product", () => {
    const result = createProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("should reject selling price less than cost price", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      costPrice: 30.0,
      sellingPrice: 20.0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes("sellingPrice"))).toBe(true);
    }
  });

  it("should reject missing SKU", () => {
    const { sku, ...withoutSku } = validProduct;
    const result = createProductSchema.safeParse(withoutSku);
    expect(result.success).toBe(false);
  });

  it("should reject missing name", () => {
    const { name, ...withoutName } = validProduct;
    const result = createProductSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it("should accept optional fields", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      description: "A delicious cake",
      category: "Cakes",
      currentStock: 50,
      minStock: 10,
      maxStock: 100,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateProductSchema", () => {
  it("should validate partial update", () => {
    const result = updateProductSchema.safeParse({ name: "Updated Cake" });
    expect(result.success).toBe(true);
  });

  it("should validate empty update", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate price update", () => {
    const result = updateProductSchema.safeParse({
      costPrice: 15.0,
      sellingPrice: 35.0,
    });
    expect(result.success).toBe(true);
  });
});

describe("createIngredientSchema", () => {
  const validIngredient = {
    storeId: validCuid1,
    sku: "ING-001",
    name: "Flour",
    unit: "kg",
    unitCost: 2.5,
  };

  it("should validate valid ingredient", () => {
    const result = createIngredientSchema.safeParse(validIngredient);
    expect(result.success).toBe(true);
  });

  it("should reject multiple preferred suppliers", () => {
    const result = createIngredientSchema.safeParse({
      ...validIngredient,
      suppliers: [
        { supplierId: validCuid1, price: 2.5, isPreferred: true },
        { supplierId: validCuid2, price: 2.3, isPreferred: true },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes("suppliers"))).toBe(true);
    }
  });

  it("should accept single preferred supplier", () => {
    const result = createIngredientSchema.safeParse({
      ...validIngredient,
      suppliers: [
        { supplierId: validCuid1, price: 2.5, isPreferred: true },
        { supplierId: validCuid2, price: 2.3, isPreferred: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional stock fields", () => {
    const result = createIngredientSchema.safeParse({
      ...validIngredient,
      currentStock: 100,
      minStock: 10,
      maxStock: 200,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateIngredientSchema", () => {
  it("should validate partial update", () => {
    const result = updateIngredientSchema.safeParse({ name: "Updated Flour" });
    expect(result.success).toBe(true);
  });

  it("should reject multiple preferred suppliers in update", () => {
    const result = updateIngredientSchema.safeParse({
      suppliers: [
        { supplierId: validCuid1, price: 2.5, isPreferred: true },
        { supplierId: validCuid2, price: 2.3, isPreferred: true },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("createRecipeSchema", () => {
  const validRecipe = {
    storeId: validCuid1,
    name: "Chocolate Cake Recipe",
    yieldQuantity: 1,
    yieldUnit: "piece",
    productionTimeMinutes: 60,
  };

  it("should validate valid recipe", () => {
    const result = createRecipeSchema.safeParse(validRecipe);
    expect(result.success).toBe(true);
  });

  it("should accept recipe with ingredients", () => {
    const result = createRecipeSchema.safeParse({
      ...validRecipe,
      ingredients: [
        {
          materialId: validCuid1,
          quantity: 500,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative yield quantity", () => {
    const result = createRecipeSchema.safeParse({
      ...validRecipe,
      yieldQuantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative production time", () => {
    const result = createRecipeSchema.safeParse({
      ...validRecipe,
      productionTimeMinutes: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRecipeSchema", () => {
  it("should validate partial update", () => {
    const result = updateRecipeSchema.safeParse({ name: "Updated Recipe" });
    expect(result.success).toBe(true);
  });

  it("should validate ingredient update", () => {
    const result = updateRecipeSchema.safeParse({
      ingredients: [
        {
          materialId: validCuid1,
          quantity: 600,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("materialFilterSchema", () => {
  it("should validate valid filters", () => {
    const result = materialFilterSchema.safeParse({
      search: "flour",
      category: "Dry Goods",
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = materialFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
      expect(result.data.skip).toBe(0);
      expect(result.data.take).toBe(50);
    }
  });

  it("should coerce string numbers", () => {
    const result = materialFilterSchema.safeParse({
      skip: "10",
      take: "25",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip).toBe(10);
      expect(result.data.take).toBe(25);
    }
  });

  it("should reject invalid sortBy", () => {
    const result = materialFilterSchema.safeParse({
      sortBy: "invalidField",
    });
    expect(result.success).toBe(false);
  });
});

describe("bulkDeleteSchema", () => {
  it("should validate valid IDs array", () => {
    const result = bulkDeleteSchema.safeParse({
      ids: [validCuid1, validCuid2],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty IDs array", () => {
    const result = bulkDeleteSchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });

  it("should reject invalid ID format", () => {
    const result = bulkDeleteSchema.safeParse({
      ids: ["invalid-id"],
    });
    expect(result.success).toBe(false);
  });
});

describe("addMaterialSupplierSchema", () => {
  it("should validate valid supplier addition", () => {
    const result = addMaterialSupplierSchema.safeParse({
      supplierId: validCuid1,
      price: 2.5,
      isPreferred: true,
    });
    expect(result.success).toBe(true);
  });

  it("should apply default isPreferred", () => {
    const result = addMaterialSupplierSchema.safeParse({
      supplierId: validCuid1,
      price: 2.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPreferred).toBe(false);
    }
  });

  it("should reject negative price", () => {
    const result = addMaterialSupplierSchema.safeParse({
      supplierId: validCuid1,
      price: -5,
    });
    expect(result.success).toBe(false);
  });
});
