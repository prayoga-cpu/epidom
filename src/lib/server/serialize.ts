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
import { decimalToNumber, isPrismaDecimal, type SerializeDecimal } from "@/types/prisma";

/**
 * Deeply serializes an object, converting all Prisma.Decimal values to numbers.
 * Safe for nulls, undefined, arrays, and preserves Date objects.
 */
export function deepSerializeDecimal<T>(obj: T): SerializeDecimal<T> {
  if (obj === null || obj === undefined) {
    return obj as unknown as SerializeDecimal<T>;
  }

  if (isPrismaDecimal(obj)) {
    return decimalToNumber(obj) as unknown as SerializeDecimal<T>;
  }

  if (obj instanceof Date) {
    return obj as unknown as SerializeDecimal<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSerializeDecimal(item)) as unknown as SerializeDecimal<T>;
  }

  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerializeDecimal((obj as any)[key]);
      }
    }
    return serialized as SerializeDecimal<T>;
  }

  return obj as unknown as SerializeDecimal<T>;
}

/**
 * Serialize MaterialWithSuppliers
 */
export function serializeMaterial(
  material: MaterialWithSuppliers
): SerializeDecimal<MaterialWithSuppliers> {
  return deepSerializeDecimal(material);
}

/**
 * Serialize array of materials
 */
export function serializeMaterials(
  materials: MaterialWithSuppliers[]
): SerializeDecimal<MaterialWithSuppliers>[] {
  return deepSerializeDecimal(materials);
}

/**
 * Serialize SupplierWithRelations
 */
export function serializeSupplier(
  supplier: SupplierWithRelations
): SerializeDecimal<SupplierWithRelations> {
  return deepSerializeDecimal(supplier);
}

/**
 * Serialize array of suppliers
 */
export function serializeSuppliers(
  suppliers: SupplierWithRelations[]
): SerializeDecimal<SupplierWithRelations>[] {
  return deepSerializeDecimal(suppliers);
}

/**
 * Serialize ProductionBatchWithRelations
 */
export function serializeProductionBatch(
  batch: ProductionBatchWithRelations
): SerializeDecimal<ProductionBatchWithRelations> {
  return deepSerializeDecimal(batch);
}

/**
 * Serialize array of production batches
 */
export function serializeProductionBatches(
  batches: ProductionBatchWithRelations[]
): SerializeDecimal<ProductionBatchWithRelations>[] {
  return deepSerializeDecimal(batches);
}

/**
 * Serialize ProductWithRelations
 */
export function serializeProduct(
  product: ProductWithRelations
): SerializeDecimal<ProductWithRelations> {
  return deepSerializeDecimal(product);
}

/**
 * Serialize array of products
 */
export function serializeProducts(
  products: ProductWithRelations[]
): SerializeDecimal<ProductWithRelations>[] {
  return deepSerializeDecimal(products);
}

/**
 * Serialize RecipeWithIngredients (to match client-side type)
 */
export function serializeRecipe(recipe: RecipeWithIngredientsRepo): RecipeWithIngredients {
  return deepSerializeDecimal(recipe) as unknown as RecipeWithIngredients;
}

/**
 * Serialize array of recipes
 */
export function serializeRecipes(
  recipes: RecipeWithIngredientsRepo[]
): RecipeWithIngredients[] {
  return deepSerializeDecimal(recipes) as unknown as RecipeWithIngredients[];
}
