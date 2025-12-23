"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ENTITY_UNIQUE_FIELDS } from "@/lib/ai/import-schema";
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

    // 1. Process Suppliers (Auto-create if missing)
    const supplierNames = [
      ...new Set(
        validData
          .map((d) => d.supplierName)
          .filter((n) => typeof n === "string" && n.trim().length > 0)
      ),
    ] as string[];

    const supplierMap = new Map<string, string>(); // Name (lowercase) -> ID

    if (supplierNames.length > 0) {
      // Find existing suppliers
      const existingSuppliers = await prisma.supplier.findMany({
        where: {
          storeId,
          name: { in: supplierNames, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });

      existingSuppliers.forEach((s) => supplierMap.set(s.name.toLowerCase(), s.id));

      // Identify missing suppliers
      const missingSupplierNames = supplierNames.filter(
        (name) => !supplierMap.has(name.toLowerCase())
      );

      // Create missing suppliers
      if (missingSupplierNames.length > 0) {
        await prisma.supplier.createMany({
          data: missingSupplierNames.map((name) => ({
            name,
            storeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          skipDuplicates: true,
        });

        // Fetch newly created suppliers to get their IDs
        const newSuppliers = await prisma.supplier.findMany({
          where: {
            storeId,
            name: { in: missingSupplierNames, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });

        newSuppliers.forEach((s) => supplierMap.set(s.name.toLowerCase(), s.id));
      }
    }

    let successCount = 0;
    const errors: Array<{ index: number; message: string }> = [];

    // Process each material individually to handle relationships properly
    for (let i = 0; i < validData.length; i++) {
      const item = validData[i];
      try {
        let supplierId = undefined;
        if (item.supplierName && typeof item.supplierName === "string") {
          supplierId = supplierMap.get(item.supplierName.trim().toLowerCase());
        }

        // Prepare supplier relation data if supplier exists
        const materialSuppliersCreate = supplierId
          ? {
              create: {
                supplierId,
                price: Number(item.supplierPrice) || Number(item.unitCost) || 0,
                isPreferred: true,
              },
            }
          : undefined;

        await prisma.material.create({
          data: {
            storeId: item.storeId,
            sku:
              item.sku ||
              `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            name: String(item.name).trim(),
            description: item.description || undefined,
            category: item.category || undefined,
            unit: item.unit || "kg",
            unitCost: Number(item.unitCost) || 0,
            currentStock: Number(item.currentStock) || 0,
            minStock: Number(item.minStock) || 0,
            maxStock: item.maxStock ? Number(item.maxStock) : undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            // Create relation to supplier
            materialSuppliers: materialSuppliersCreate,
          },
        });
        successCount++;
      } catch (error) {
        // Skip duplicates (unique constraint violation) silently like createMany does
        // record others
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (!msg.includes("Unique constraint")) {
          errors.push({ index: i + 1, message: msg.slice(0, 100) });
        }
      }
    }

    return {
      success: successCount > 0,
      count: successCount,
      details: {
        attempted: data.length,
        succeeded: successCount,
        failed: data.length - successCount,
        errors: errors.slice(0, 10),
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

  // 1. Group by Recipe Name to handle multi-row ingredients
  const groups: Record<string, any[]> = {};
  data.forEach((item, index) => {
    const name = item.name ? String(item.name).trim() : null;
    if (!name) {
      errors.push({ index: index + 1, message: "Missing recipe name" });
      return;
    }
    if (!groups[name]) groups[name] = [];
    groups[name].push({ ...item, originalIndex: index + 1 });
  });

  const recipeNames = Object.keys(groups);

  for (const name of recipeNames) {
    const rows = groups[name];
    const mainRow = rows[0]; // Use first row for main recipe data

    try {
      // Prepare Ingredients
      const ingredientsToCreate: any[] = [];

      // Process ingredients from all rows in this group
      for (const row of rows) {
        const ingName = row.ingredient_name || row.ingredientName;
        if (ingName && typeof ingName === "string" && ingName.trim()) {
          const cleanIngName = ingName.trim();

          // Find or Create Material
          let material = await prisma.material.findFirst({
            where: { storeId, name: { equals: cleanIngName, mode: "insensitive" } },
            select: { id: true },
          });

          if (!material) {
            // Check for supplier info to cascade create/link
            let supplierId = undefined;
            const supplierName = row.ingredient_supplier;

            if (supplierName && typeof supplierName === "string" && supplierName.trim()) {
              const cleanSupName = supplierName.trim();
              const existingSupplier = await prisma.supplier.findFirst({
                where: { storeId, name: { equals: cleanSupName, mode: "insensitive" } },
                select: { id: true },
              });

              if (existingSupplier) {
                supplierId = existingSupplier.id;
              } else {
                const newSupplier = await prisma.supplier.create({
                  data: {
                    storeId,
                    name: cleanSupName,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                  select: { id: true },
                });
                supplierId = newSupplier.id;
              }
            }

            // Auto-create material if missing with extended info from recipe row
            material = await prisma.material.create({
              data: {
                storeId,
                name: cleanIngName,
                unit: row.ingredient_unit || row.ingredientUnit || "kg",
                // Prefer provided SKU, otherwise generate one
                sku:
                  row.ingredient_sku ||
                  `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                unitCost: Number(row.ingredient_price) || 0,
                currentStock: Number(row.ingredient_stock) || 0,
                category: "Imported",
                // Link supplier if found/created
                materialSuppliers: supplierId
                  ? {
                      create: {
                        supplierId,
                        price: Number(row.ingredient_price) || 0,
                        isPreferred: true,
                      },
                    }
                  : undefined,
              },
              select: { id: true },
            });
          }

          // Add to ingredients list
          // Check if this material is already added to this recipe to avoid duplicates
          if (!ingredientsToCreate.some((i) => i.materialId === material!.id)) {
            ingredientsToCreate.push({
              materialId: material.id,
              quantity: Number(row.ingredient_qty) || Number(row.ingredientQuantity) || 1,
              unit: row.ingredient_unit || row.ingredientUnit || "kg",
            });
          }
        }
      }

      // Format instructions
      let instructions = mainRow.instructions || "";
      // If we have ingredients_text (bulk text) but no structured ingredients, we append it
      // Or if we just want to preserve it
      if (mainRow.ingredients_text) {
        instructions = instructions
          ? `${instructions}\n\n--- Imported Ingredients ---\n${mainRow.ingredients_text}`
          : `--- Imported Ingredients ---\n${mainRow.ingredients_text}`;
      }

      await prisma.recipe.create({
        data: {
          storeId,
          name,
          description: mainRow.description || null,
          category: mainRow.category || null,
          yieldQuantity: Number(mainRow.yieldQuantity) || 1,
          yieldUnit: mainRow.yieldUnit || "batch",
          productionTimeMinutes: Number(mainRow.productionTimeMinutes) || 0,
          instructions: instructions || null,
          costPerBatch: Number(mainRow.costPerBatch) || 0,
          createdAt: mainRow.createdAt || new Date(),
          updatedAt: mainRow.updatedAt || new Date(),
          ingredients:
            ingredientsToCreate.length > 0
              ? {
                  create: ingredientsToCreate,
                }
              : undefined,
        },
      });
      successCount += rows.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      // Log error on the main row, but maybe applies to the whole group
      errors.push({ index: mainRow.originalIndex, message: message.slice(0, 100) });
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    details: {
      attempted: data.length,
      succeeded: successCount,
      failed: errors.length, // Only counts failed main items roughly
      errors: errors.slice(0, 10),
    },
  };
}

// ============================================================================
// SMART ALL-IN-ONE MULTI-ENTITY IMPORT
// ============================================================================

// Schema for multi-entity import
const multiEntityImportSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  data: z.array(z.record(z.any())).min(1, "At least one record is required"),
});

// Extended result type for multi-entity import
interface MultiEntityImportResult {
  success: boolean;
  error?: string;
  summary: {
    suppliers: { attempted: number; succeeded: number };
    materials: { attempted: number; succeeded: number };
    recipes: { attempted: number; succeeded: number };
    products: { attempted: number; succeeded: number };
    totalSucceeded: number;
  };
}

/**
 * Detect which entity type a row best matches based on filled fields.
 * Priority: Recipe > Material > Product > Supplier (most specific first)
 * Uses centralized field definitions from import-schema.ts (DRY principle)
 */
function detectEntityType(
  row: Record<string, unknown>
): "supplier" | "material" | "recipe" | "product" | null {
  const hasValue = (field: string) =>
    row[field] !== undefined && row[field] !== "" && row[field] !== null;

  // Check in order of specificity (most specific first)
  if (ENTITY_UNIQUE_FIELDS.recipe.some(hasValue)) return "recipe";
  if (ENTITY_UNIQUE_FIELDS.material.some(hasValue)) return "material";
  if (ENTITY_UNIQUE_FIELDS.product.some(hasValue)) return "product";
  if (ENTITY_UNIQUE_FIELDS.supplier.some(hasValue)) return "supplier";

  // Default: if has 'name' only, treat as supplier (simplest entity)
  if (hasValue("name")) return "supplier";

  return null;
}

/**
 * Smart All-in-One Multi-Entity Import
 *
 * This function:
 * 1. Analyzes each row to detect its entity type
 * 2. Groups rows by entity type
 * 3. Imports in dependency order: Supplier → Material → Recipe → Product
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

    const { storeId, data } = validationResult.data;

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

    // 4. Group rows by detected entity type
    const grouped: {
      supplier: Record<string, any>[];
      material: Record<string, any>[];
      recipe: Record<string, any>[];
      product: Record<string, any>[];
    } = {
      supplier: [],
      material: [],
      recipe: [],
      product: [],
    };

    const now = new Date();
    for (const row of data) {
      const entityType = detectEntityType(row);
      if (entityType) {
        grouped[entityType].push({
          ...row,
          storeId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 5. Import in dependency order
    const summary = { ...defaultSummary };

    // 5a. Suppliers first (no dependencies)
    if (grouped.supplier.length > 0) {
      summary.suppliers.attempted = grouped.supplier.length;
      const result = await importSuppliers(grouped.supplier, storeId);
      summary.suppliers.succeeded = result.count || 0;
    }

    // 5b. Materials second (may reference suppliers)
    if (grouped.material.length > 0) {
      summary.materials.attempted = grouped.material.length;
      const result = await importMaterials(grouped.material, storeId);
      summary.materials.succeeded = result.count || 0;
    }

    // 5c. Recipes third (reference materials, may cascade-create materials & suppliers)
    if (grouped.recipe.length > 0) {
      summary.recipes.attempted = grouped.recipe.length;
      const result = await importRecipes(grouped.recipe, storeId);
      summary.recipes.succeeded = result.count || 0;
    }

    // 5d. Products last (may reference recipes)
    if (grouped.product.length > 0) {
      summary.products.attempted = grouped.product.length;
      const result = await importProducts(grouped.product, storeId);
      summary.products.succeeded = result.count || 0;
    }

    // 6. Calculate totals
    summary.totalSucceeded =
      summary.suppliers.succeeded +
      summary.materials.succeeded +
      summary.recipes.succeeded +
      summary.products.succeeded;

    // 7. Revalidate cache
    revalidatePath(`/store/${storeId}/data`);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Multi-Entity Import Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during import.",
      summary: defaultSummary,
    };
  }
}
