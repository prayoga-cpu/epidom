"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

// Schema for bulk import validation
const bulkImportSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  type: z.enum(["material", "product", "supplier", "recipe"]),
  data: z.array(z.record(z.any())).min(1, "At least one record is required"),
});

// Type for import result with detailed stats
interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
  details?: {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: Array<{ index: number; message: string }>;
  };
}

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
 * Import materials with createMany for efficiency
 */
async function importMaterials(data: any[], storeId: string): Promise<ImportResult> {
  try {
    // Filter out records without required fields
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each material requires at least a 'name' field.",
      };
    }

    // Clean up data - ensure correct types
    const cleanedData = validData.map((item) => ({
      storeId: item.storeId,
      sku: item.sku || undefined,
      name: String(item.name).trim(),
      description: item.description || undefined,
      category: item.category || undefined,
      unit: item.unit || "pcs",
      unitCost: Number(item.unitCost) || 0,
      currentStock: Number(item.currentStock) || 0,
      minStock: Number(item.minStock) || 0,
      maxStock: item.maxStock ? Number(item.maxStock) : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const result = await prisma.material.createMany({
      data: cleanedData,
      skipDuplicates: true,
    });

    return {
      success: true,
      count: result.count,
      details: {
        attempted: data.length,
        succeeded: result.count,
        failed: data.length - result.count,
        errors: [],
      },
    };
  } catch (error) {
    console.error("Material import error:", error);
    return {
      success: false,
      error: `Material import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Import products with createMany for efficiency
 */
async function importProducts(data: any[], storeId: string): Promise<ImportResult> {
  try {
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each product requires at least a 'name' field.",
      };
    }

    const cleanedData = validData.map((item) => ({
      storeId: item.storeId,
      sku: item.sku || undefined,
      name: String(item.name).trim(),
      description: item.description || undefined,
      category: item.category || undefined,
      unit: item.unit || "pcs",
      costPrice: Number(item.costPrice) || 0,
      sellingPrice: Number(item.sellingPrice) || 0,
      currentStock: Number(item.currentStock) || 0,
      minStock: Number(item.minStock) || 0,
      maxStock: item.maxStock ? Number(item.maxStock) : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const result = await prisma.product.createMany({
      data: cleanedData,
      skipDuplicates: true,
    });

    return {
      success: true,
      count: result.count,
      details: {
        attempted: data.length,
        succeeded: result.count,
        failed: data.length - result.count,
        errors: [],
      },
    };
  } catch (error) {
    console.error("Product import error:", error);
    return {
      success: false,
      error: `Product import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Import suppliers
 */
async function importSuppliers(data: any[], storeId: string): Promise<ImportResult> {
  try {
    const validData = data.filter(
      (item) => item.name && typeof item.name === "string" && item.name.trim()
    );

    if (validData.length === 0) {
      return {
        success: false,
        error: "No valid records found. Each supplier requires at least a 'name' field.",
      };
    }

    const cleanedData = validData.map((item) => ({
      storeId: item.storeId,
      name: String(item.name).trim(),
      contactPerson: item.contactPerson || undefined,
      email: item.email || undefined,
      phone: item.phone || undefined,
      address: item.address || undefined,
      city: item.city || undefined,
      country: item.country || undefined,
      notes: item.notes || undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const result = await prisma.supplier.createMany({
      data: cleanedData,
      skipDuplicates: true,
    });

    return {
      success: true,
      count: result.count,
      details: {
        attempted: data.length,
        succeeded: result.count,
        failed: data.length - result.count,
        errors: [],
      },
    };
  } catch (error) {
    console.error("Supplier import error:", error);
    return {
      success: false,
      error: `Supplier import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Import recipes - uses individual creates for better error handling
 * since recipes may have complex validation
 */
async function importRecipes(data: any[], storeId: string): Promise<ImportResult> {
  const errors: Array<{ index: number; message: string }> = [];
  let successCount = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Skip rows without name
    if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
      errors.push({ index: i + 1, message: "Missing required field: name" });
      continue;
    }

    try {
      // Handle ingredients_text specially
      let instructions = item.instructions || "";
      if (item.ingredients_text) {
        instructions = instructions
          ? `${instructions}\n\n--- Imported Ingredients ---\n${item.ingredients_text}`
          : `--- Imported Ingredients ---\n${item.ingredients_text}`;
      }

      await prisma.recipe.create({
        data: {
          storeId: item.storeId,
          name: String(item.name).trim(),
          description: item.description || null,
          category: item.category || null,
          yieldQuantity: Number(item.yieldQuantity) || 1,
          yieldUnit: item.yieldUnit || "batch",
          productionTimeMinutes: Number(item.productionTimeMinutes) || 0,
          instructions: instructions || null,
          costPerBatch: Number(item.costPerBatch) || 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      });
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ index: i + 1, message: message.slice(0, 100) });
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    details: {
      attempted: data.length,
      succeeded: successCount,
      failed: errors.length,
      errors: errors.slice(0, 10), // Limit error details
    },
  };
}
