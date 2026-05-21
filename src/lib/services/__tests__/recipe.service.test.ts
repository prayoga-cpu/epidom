/**
 * Recipe Service Tests
 *
 * Unit tests for recipe business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock modules directly with inline mocks
vi.mock("@/lib/repositories/recipe.repository", () => ({
  recipeRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateWithIngredients: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    belongsToStore: vi.fn(),
    existsByName: vi.fn(),
    addIngredient: vi.fn(),
    duplicate: vi.fn(),
    findByCategory: vi.fn(),
    findByIngredient: vi.fn(),
  },
}));

vi.mock("@/lib/repositories/material.repository", () => ({
  materialRepository: {
    findById: vi.fn(),
  },
}));

// Import after mocking
import { RecipeService } from "../recipe.service";
import { recipeRepository } from "@/lib/repositories/recipe.repository";
import { materialRepository } from "@/lib/repositories/material.repository";

// Mock recipe data
const mockRecipe = {
  id: "recipe-1",
  storeId: "store-1",
  name: "Chocolate Cake",
  description: "Delicious chocolate cake",
  category: "Cakes",
  yieldQuantity: new Prisma.Decimal(1),
  yieldUnit: "piece",
  productionTimeMinutes: 60,
  instructions: "Mix and bake",
  costPerBatch: new Prisma.Decimal(15.0),
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [],
};

// Get mocked functions
const mockedRecipeRepo = vi.mocked(recipeRepository);
const mockedMaterialRepo = vi.mocked(materialRepository);

describe("RecipeService", () => {
  let service: RecipeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecipeService();
  });

  describe("getRecipes", () => {
    it("should return recipes with total count", async () => {
      mockedRecipeRepo.findAll.mockResolvedValue({
        recipes: [mockRecipe],
        total: 1,
      });

      const result = await service.getRecipes("store-1", {});

      expect(mockedRecipeRepo.findAll).toHaveBeenCalledWith("store-1", {});
      expect(result.recipes).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getRecipeById", () => {
    it("should return recipe when found", async () => {
      mockedRecipeRepo.findById.mockResolvedValue(mockRecipe);

      const result = await service.getRecipeById("recipe-1");

      expect(result).toEqual(mockRecipe);
    });

    it("should return null when not found", async () => {
      mockedRecipeRepo.findById.mockResolvedValue(null);

      const result = await service.getRecipeById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createRecipe", () => {
    it("should throw error if recipe name already exists", async () => {
      mockedRecipeRepo.existsByName.mockResolvedValue(true);

      const input = {
        storeId: "store-1",
        name: "Existing Recipe",
        yieldQuantity: 1,
        yieldUnit: "piece",
        productionTimeMinutes: 60,
      };

      await expect(service.createRecipe(input)).rejects.toThrow(
        'Recipe with name "Existing Recipe" already exists'
      );
    });

    it("should create recipe when name is unique", async () => {
      mockedRecipeRepo.existsByName.mockResolvedValue(false);
      mockedRecipeRepo.create.mockResolvedValue(mockRecipe);

      const input = {
        storeId: "store-1",
        name: "Chocolate Cake",
        yieldQuantity: 1,
        yieldUnit: "piece",
        productionTimeMinutes: 60,
      };

      const result = await service.createRecipe(input);

      expect(mockedRecipeRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockRecipe);
    });
  });

  describe("updateRecipe", () => {
    it("should throw error if recipe does not belong to store", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(false);

      await expect(
        service.updateRecipe("recipe-1", "other-store", { name: "Updated" })
      ).rejects.toThrow("Recipe not found or does not belong to this store");
    });

    it("should update recipe when valid", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(true);
      mockedRecipeRepo.existsByName.mockResolvedValue(false);
      mockedRecipeRepo.updateWithIngredients.mockResolvedValue({
        ...mockRecipe,
        name: "Updated Cake",
      });

      const result = await service.updateRecipe("recipe-1", "store-1", {
        name: "Updated Cake",
      });

      expect(result.name).toBe("Updated Cake");
    });
  });

  describe("deleteRecipe", () => {
    it("should throw error if recipe does not belong to store", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(false);

      await expect(service.deleteRecipe("recipe-1", "other-store")).rejects.toThrow(
        "Recipe not found or does not belong to this store"
      );
    });

    it("should delete recipe when valid", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(true);
      mockedRecipeRepo.delete.mockResolvedValue(mockRecipe);

      const result = await service.deleteRecipe("recipe-1", "store-1");

      expect(mockedRecipeRepo.delete).toHaveBeenCalledWith("recipe-1");
      expect(result).toEqual(mockRecipe);
    });
  });

  describe("bulkDeleteRecipes", () => {
    it("should throw error if any recipe does not belong to store", async () => {
      mockedRecipeRepo.findByIds.mockResolvedValue([
        { ...mockRecipe, id: "recipe-1", storeId: "store-1" },
        { ...mockRecipe, id: "recipe-2", storeId: "other-store" },
      ]);

      await expect(service.bulkDeleteRecipes(["recipe-1", "recipe-2"], "store-1")).rejects.toThrow(
        "Some recipes do not belong to this store"
      );
    });

    it("should delete all recipes when valid", async () => {
      mockedRecipeRepo.findByIds.mockResolvedValue([
        { ...mockRecipe, id: "recipe-1", storeId: "store-1" },
        { ...mockRecipe, id: "recipe-2", storeId: "store-1" },
      ]);
      mockedRecipeRepo.bulkDelete.mockResolvedValue({ count: 2 });

      const result = await service.bulkDeleteRecipes(["recipe-1", "recipe-2"], "store-1");

      expect(result.count).toBe(2);
    });
  });

  describe("addIngredient", () => {
    it("should throw error if recipe does not belong to store", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(false);

      await expect(
        service.addIngredient("recipe-1", "other-store", "mat-1", 100, "g")
      ).rejects.toThrow("Recipe not found or does not belong to this store");
    });

    it("should throw error if material does not belong to store", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(true);
      mockedMaterialRepo.findById.mockResolvedValue({
        id: "mat-1",
        storeId: "other-store",
      } as any);

      await expect(service.addIngredient("recipe-1", "store-1", "mat-1", 100, "g")).rejects.toThrow(
        "Material not found or does not belong to this store"
      );
    });

    it("should add ingredient when valid", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(true);
      mockedMaterialRepo.findById.mockResolvedValue({
        id: "mat-1",
        storeId: "store-1",
      } as any);
      mockedRecipeRepo.addIngredient.mockResolvedValue({
        id: "ing-1",
        recipeId: "recipe-1",
        materialId: "mat-1",
        quantity: new Prisma.Decimal(100),
        unit: "g",
        notes: null,
      });

      const result = await service.addIngredient("recipe-1", "store-1", "mat-1", 100, "g");

      expect(result.materialId).toBe("mat-1");
    });
  });

  describe("duplicateRecipe", () => {
    it("should throw error if recipe does not belong to store", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(false);

      await expect(
        service.duplicateRecipe("recipe-1", "Copy of Cake", "other-store")
      ).rejects.toThrow("Recipe not found or does not belong to this store");
    });

    it("should duplicate recipe when valid", async () => {
      mockedRecipeRepo.belongsToStore.mockResolvedValue(true);
      mockedRecipeRepo.existsByName.mockResolvedValue(false);
      mockedRecipeRepo.duplicate.mockResolvedValue({
        ...mockRecipe,
        id: "recipe-2",
        name: "Copy of Cake",
      });

      const result = await service.duplicateRecipe("recipe-1", "Copy of Cake", "store-1");

      expect(result.name).toBe("Copy of Cake");
    });
  });

  describe("getRecipesByCategory", () => {
    it("should return recipes filtered by category", async () => {
      mockedRecipeRepo.findByCategory.mockResolvedValue([mockRecipe]);

      const result = await service.getRecipesByCategory("store-1", "Cakes");

      expect(mockedRecipeRepo.findByCategory).toHaveBeenCalledWith("store-1", "Cakes");
      expect(result).toHaveLength(1);
    });
  });

  describe("getRecipesByMaterial", () => {
    it("should return recipes using the material", async () => {
      mockedRecipeRepo.findByIngredient.mockResolvedValue([mockRecipe]);

      const result = await service.getRecipesByMaterial("mat-1", "store-1");

      expect(result).toHaveLength(1);
    });
  });
});
