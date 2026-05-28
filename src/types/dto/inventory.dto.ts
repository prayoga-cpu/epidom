/**
 * Inventory Data Transfer Objects (DTOs)
 *
 * These types represent inventory-related data structures
 * (products, ingredients, recipes, suppliers, stock movements)
 */

import type { Decimal } from "@prisma/client/runtime/client";

// Product DTO
export interface ProductDto {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  costPrice: Decimal;
  sellingPrice: Decimal;
  currentStock: Decimal;
  unit: string;
  minStockLevel: Decimal;
  criticalLevel: Decimal | null;
  productionTime: number | null;
  shelfLife: number | null;

  createdAt: Date;
  updatedAt: Date;
}

// Product with recipe
export interface ProductWithRecipeDto extends ProductDto {
  recipe: RecipeDto | null;
}

// Ingredient DTO
export interface IngredientDto {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  unit: string;
  unitCost: Decimal;
  currentStock: Decimal;
  minStockLevel: Decimal;
  criticalLevel: Decimal | null;
  supplierId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// Ingredient with supplier
export interface IngredientWithSupplierDto extends IngredientDto {
  supplier: SupplierDto | null;
}

// Recipe DTO
export interface RecipeDto {
  id: string;
  storeId: string;
  productId: string;
  batchSize: Decimal;
  batchUnit: string;
  instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Recipe with ingredients
export interface RecipeWithIngredientsDto extends RecipeDto {
  ingredients: RecipeIngredientDto[];
}

// Recipe ingredient DTO
export interface RecipeIngredientDto {
  id: string;
  recipeId: string;
  materialId: string;
  ingredient: IngredientDto;
  quantity: Decimal;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
}

// Supplier DTO
export interface SupplierDto {
  id: string;
  storeId: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// Stock movement DTO
export interface StockMovementDto {
  id: string;
  productId: string | null;
  materialId: string | null;
  type: "PURCHASE" | "PRODUCTION_IN" | "PRODUCTION_OUT" | "SALE" | "ADJUSTMENT" | "WASTE";
  quantity: Decimal;
  unit: string;
  balanceAfter: Decimal;
  orderId: string | null;
  productionBatchId: string | null;
  notes: string | null;
  createdAt: Date;
}

// Stock movement with related entities
export interface StockMovementDetailDto extends StockMovementDto {
  product?: ProductDto;
  ingredient?: IngredientDto;
}

// Production batch DTO
export interface ProductionBatchDto {
  id: string;
  storeId: string;
  batchNumber: string;
  productId: string;
  recipeId: string | null;
  plannedQuantity: Decimal;
  actualQuantity: Decimal | null;
  unit: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledDate: Date;
  completedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Production batch with product and recipe
export interface ProductionBatchDetailDto extends ProductionBatchDto {
  product: ProductDto;
  recipe: RecipeWithIngredientsDto | null;
}
