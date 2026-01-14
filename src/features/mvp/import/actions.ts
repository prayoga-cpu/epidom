"use server";

/**
 * MVP Import Server Actions
 *
 * Server-side actions for importing products
 */

import { prisma } from "@/lib/prisma";
import type { ImportPreviewProduct } from "./types";

interface ImportProductsInput {
  storeId: string;
  products: ImportPreviewProduct[];
}

interface ImportProductsResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ sku: string; message: string }>;
}

/**
 * Import products into the database
 */
export async function importProducts(
  input: ImportProductsInput
): Promise<ImportProductsResult> {
  const { storeId, products } = input;

  if (!storeId) {
    throw new Error("Store ID is required");
  }

  if (!products || products.length === 0) {
    throw new Error("No products to import");
  }

  const errors: Array<{ sku: string; message: string }> = [];
  let imported = 0;
  let skipped = 0;

  // Process products in batches
  for (const product of products) {
    try {
      // Validate required fields
      if (!product.sku || !product.name) {
        errors.push({ sku: product.sku || "Unknown", message: "Missing SKU or name" });
        skipped++;
        continue;
      }

      if (product.costPrice < 0 || product.sellingPrice < 0) {
        errors.push({ sku: product.sku, message: "Prices cannot be negative" });
        skipped++;
        continue;
      }

      if (product.currentStock < 0) {
        errors.push({ sku: product.sku, message: "Stock cannot be negative" });
        skipped++;
        continue;
      }

      // Upsert product (create if not exists, update if exists)
      await prisma.product.upsert({
        where: {
          storeId_sku: {
            storeId,
            sku: product.sku,
          },
        },
        update: {
          name: product.name,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          currentStock: product.currentStock,
          category: product.category || null,
          unit: product.unit || "piece",
          updatedAt: new Date(),
        },
        create: {
          storeId,
          sku: product.sku,
          name: product.name,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          currentStock: product.currentStock,
          category: product.category || null,
          unit: product.unit || "piece",
        },
      });

      imported++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ sku: product.sku, message });
      skipped++;
    }
  }

  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors,
  };
}

/**
 * Get current products count for a store
 */
export async function getProductsCount(storeId: string): Promise<number> {
  return prisma.product.count({
    where: { storeId },
  });
}
