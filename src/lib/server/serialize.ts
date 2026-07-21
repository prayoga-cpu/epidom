/**
 * Serialization utilities for Server Components
 *
 * Converts Prisma Decimal objects to numbers so they can be safely
 * passed to Client Components as plain objects.
 */

import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import type { ProductionBatchWithRelations } from "@/lib/repositories/production-batch.repository";
import type { ProductWithRelations } from "@/lib/repositories/product.repository";
import type { RecipeWithIngredients as RecipeWithIngredientsRepo } from "@/lib/repositories/recipe.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import { decimalToNumber, type SerializedDecimal } from "@/types/prisma";

/**
 * Serialize MaterialWithSuppliers: Convert all Decimal fields to numbers
 *
 * Note: Uses 'as any' type assertion because we're intentionally converting
 * Prisma Decimal to number for client component serialization.
 * The return type still shows Decimal for API compatibility, but runtime values are numbers.
 */
export function serializeMaterial(material: MaterialWithSuppliers): MaterialWithSuppliers {
  return {
    ...material,
    unitCost: decimalToNumber(material.unitCost) as any,
    purchaseQuantity: decimalToNumber(material.purchaseQuantity) as any,
    currentStock: decimalToNumber(material.currentStock) as any,
    minStock: decimalToNumber(material.minStock) as any,
    maxStock: decimalToNumber(material.maxStock) as any,
    materialSuppliers: material.materialSuppliers.map((ms) => ({
      ...ms,
      price: decimalToNumber(ms.price) as any,
      purchaseQuantity: decimalToNumber(ms.purchaseQuantity) as any,
    })),
  };
}

/**
 * Serialize array of materials
 */
export function serializeMaterials(materials: MaterialWithSuppliers[]): MaterialWithSuppliers[] {
  return materials.map(serializeMaterial);
}

/**
 * Serialize SupplierWithRelations: Convert all Decimal fields to numbers
 *
 * Note: Uses 'as any' type assertion because we're intentionally converting
 * Prisma Decimal to number for client component serialization.
 * The return type still shows Decimal for API compatibility, but runtime values are numbers.
 */
export function serializeSupplier(supplier: SupplierWithRelations): SupplierWithRelations {
  return {
    ...supplier,
    materialSuppliers: supplier.materialSuppliers?.map((ms) => {
      if (!ms.material) {
        return {
          ...ms,
          price: decimalToNumber(ms.price) as any,
        } as any;
      }
      return {
        ...ms,
        price: decimalToNumber(ms.price) as any,
        purchaseQuantity: decimalToNumber(ms.purchaseQuantity) as any,
        material: {
          ...ms.material,
          unitCost: decimalToNumber(ms.material.unitCost) as any,
          purchaseQuantity: decimalToNumber(ms.material.purchaseQuantity) as any,
          currentStock: decimalToNumber(ms.material.currentStock) as any,
          minStock: decimalToNumber(ms.material.minStock) as any,
          maxStock: decimalToNumber(ms.material.maxStock) as any,
        },
      } as any;
    }),
  };
}

/**
 * Serialize array of suppliers
 */
export function serializeSuppliers(suppliers: SupplierWithRelations[]): SupplierWithRelations[] {
  return suppliers.map(serializeSupplier);
}

/**
 * Serialize ProductionBatchWithRelations: Convert all Decimal fields to numbers
 *
 * Note: Uses 'as any' type assertion because we're intentionally converting
 * Prisma Decimal to number for client component serialization.
 * The return type still shows Decimal for API compatibility, but runtime values are numbers.
 */
export function serializeProductionBatch(
  batch: ProductionBatchWithRelations
): ProductionBatchWithRelations {
  return {
    ...batch,
    plannedQuantity: decimalToNumber(batch.plannedQuantity) as any,
    actualQuantity:
      batch.actualQuantity !== null ? (decimalToNumber(batch.actualQuantity) as any) : null,
    recipe: batch.recipe
      ? ({
          ...batch.recipe,
          yieldQuantity: decimalToNumber(batch.recipe.yieldQuantity) as any,
          ingredients: batch.recipe.ingredients.map((ing) => {
            if (!ing.material) {
              return {
                ...ing,
                quantity: decimalToNumber(ing.quantity) as any,
              } as any;
            }
            return {
              ...ing,
              quantity: decimalToNumber(ing.quantity) as any,
              material: {
                ...ing.material,
                unitCost: decimalToNumber(ing.material.unitCost) as any,
                currentStock: decimalToNumber(ing.material.currentStock) as any,
              },
            } as any;
          }),
        } as any)
      : null,
    stockMovements: batch.stockMovements?.map((sm) => ({
      ...sm,
      quantity: decimalToNumber(sm.quantity) as any,
    })),
  };
}

/**
 * Serialize array of production batches
 */
export function serializeProductionBatches(
  batches: ProductionBatchWithRelations[]
): ProductionBatchWithRelations[] {
  return batches.map(serializeProductionBatch);
}

/**
 * Serialize ProductWithRelations: Convert all Decimal fields to numbers
 *
 * Note: Uses 'as any' type assertion because we're intentionally converting
 * Prisma Decimal to number for client component serialization.
 * The return type still shows Decimal for API compatibility, but runtime values are numbers.
 */
export function serializeProduct(product: ProductWithRelations): ProductWithRelations {
  return {
    ...product,
    costPrice: decimalToNumber(product.costPrice) as any,
    sellingPrice: decimalToNumber(product.sellingPrice) as any,
    currentStock: decimalToNumber(product.currentStock) as any,
    minStock: decimalToNumber(product.minStock) as any,
    maxStock: decimalToNumber(product.maxStock) as any,
  };
}

/**
 * Serialize array of products
 */
export function serializeProducts(products: ProductWithRelations[]): ProductWithRelations[] {
  return products.map(serializeProduct);
}

/**
 * Serialize RecipeWithIngredients: Convert all Decimal fields to numbers
 * Uses type assertion because serialized version has numbers instead of Decimals
 */
export function serializeRecipe(recipe: RecipeWithIngredientsRepo): RecipeWithIngredients {
  // Explicitly serialize all fields to ensure Decimal objects are converted
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    yieldQuantity: decimalToNumber(recipe.yieldQuantity),
    yieldUnit: recipe.yieldUnit,
    productionTimeMinutes: recipe.productionTimeMinutes,
    instructions: recipe.instructions,
    costPerBatch: decimalToNumber(recipe.costPerBatch),
    storeId: recipe.storeId,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    ingredients: recipe.ingredients.map((ing) => ({
      id: ing.id,
      recipeId: ing.recipeId,
      materialId: ing.materialId,
      quantity: decimalToNumber(ing.quantity),
      unit: ing.unit,
      notes: ing.notes,
      material: {
        id: ing.material.id,
        name: ing.material.name,
        unit: ing.material.unit,
        unitCost: decimalToNumber(ing.material.unitCost),
        currentStock: decimalToNumber(ing.material.currentStock),
      },
    })),
    recipeProducts: recipe.recipeProducts?.map((rp) => ({
      id: rp.id,
      recipeId: rp.recipeId,
      productId: rp.productId,
      isDefault: rp.isDefault,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
      product: {
        id: rp.product.id,
        sku: rp.product.sku,
        name: rp.product.name,
        description: rp.product.description,
        category: rp.product.category,
        costPrice: decimalToNumber(rp.product.costPrice),
        sellingPrice: decimalToNumber(rp.product.sellingPrice),
        currentStock: decimalToNumber(rp.product.currentStock),
        unit: rp.product.unit,
        productionTime: rp.product.productionTime,
        shelfLife: rp.product.shelfLife,

        createdAt: rp.product.createdAt,
        updatedAt: rp.product.updatedAt,
        storeId: rp.product.storeId,
        minStock: decimalToNumber(rp.product.minStock),
        maxStock: decimalToNumber(rp.product.maxStock),
      },
    })),
  } as RecipeWithIngredients;
}

/**
 * Serialize array of recipes
 */
export function serializeRecipes(recipes: RecipeWithIngredientsRepo[]): RecipeWithIngredients[] {
  return recipes.map(serializeRecipe);
}
