"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  importCatalogRows,
  importMaterials,
  importProducts,
  importRecipes,
  importSuppliers,
  multiEntityImportSchema,
  type ImportResult,
  type MultiEntityImportResult,
} from "@/lib/services/catalog-import.service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

// Schema for bulk import validation
const bulkImportSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  type: z.enum(["material", "product", "supplier", "recipe"]),
  data: z.array(z.record(z.any())).min(1, "At least one record is required"),
});

/**
 * Bulk import data into the database.
 * Handles materials, products, suppliers, and recipes.
 * Uses transactions for atomicity where possible.
 */
export async function bulkImportData(
  input: z.infer<typeof bulkImportSchema>
): Promise<ImportResult> {
  try {
    // 1. Authentication check
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // 2. Validate input
    const validationResult = bulkImportSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { storeId, type, data } = validationResult.data;

    // 3. Verify store access
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: { userId: session.user.id },
      },
      select: { id: true },
    });

    if (!store) {
      return { success: false, error: "You don't have access to this store." };
    }

    // 4. Prepare data with common fields
    const now = new Date();
    const preparedData = data.map((item) => ({
      ...item,
      storeId,
      createdAt: now,
      updatedAt: now,
    }));

    // 5. Execute import based on type
    let result: ImportResult;

    switch (type) {
      case "material":
        result = await importMaterials(preparedData, storeId);
        break;
      case "product":
        result = await importProducts(preparedData, storeId);
        break;
      case "supplier":
        result = await importSuppliers(preparedData, storeId);
        break;
      case "recipe":
        result = await importRecipes(preparedData, storeId);
        break;
      default:
        return { success: false, error: "Invalid import type" };
    }

    // 6. Revalidate cache
    if (result.success) {
      revalidatePath(`/store/${storeId}/data`);
    }

    return result;
  } catch (error) {
    console.error("Bulk Import Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during import.",
    };
  }
}

/**
 * Smart All-in-One Multi-Entity Import
 *
 * This function:
 * 1. Analyzes each row to detect its entity type
 * 2. Groups rows by entity type
 * 3. Imports in dependency order: Supplier → Material → Recipe → Product → MenuItem
 * 4. Returns a detailed breakdown of results
 */
export async function bulkImportMultiEntity(
  input: z.infer<typeof multiEntityImportSchema>
): Promise<MultiEntityImportResult> {
  const defaultSummary = {
    suppliers: { attempted: 0, succeeded: 0 },
    materials: { attempted: 0, succeeded: 0 },
    recipes: { attempted: 0, succeeded: 0 },
    products: { attempted: 0, succeeded: 0 },
    menu_items: { attempted: 0, succeeded: 0 },
    totalSucceeded: 0,
  };

  try {
    // 1. Authentication check
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Unauthorized. Please log in.", summary: defaultSummary };
    }

    // 2. Validate input
    const validationResult = multiEntityImportSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.errors.map((e) => e.message).join(", "),
        summary: defaultSummary,
      };
    }

    const { storeId, data, fallbackEntityType } = validationResult.data;

    // 3. Verify store access
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: { userId: session.user.id },
      },
      select: { id: true },
    });

    if (!store) {
      return {
        success: false,
        error: "You don't have access to this store.",
        summary: defaultSummary,
      };
    }

    const result = await importCatalogRows(storeId, data, fallbackEntityType);

    // Revalidate cache
    revalidatePath(`/store/${storeId}/data`);

    return result;
  } catch (error) {
    console.error("Multi-Entity Import Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during import.",
      summary: defaultSummary,
    };
  }
}
