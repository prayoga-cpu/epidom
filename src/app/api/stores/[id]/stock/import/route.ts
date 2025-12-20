/**
 * @file api/stores/[id]/stock/import/route.ts
 * @description Stock Import API
 * Handles bulk import of stock levels via CSV file.
 */

import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { productService } from "@/lib/services/product.service";
import { parseCSV } from "@/lib/utils/csv-import";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { z } from "zod";

// Validation schema for stock import row
const stockImportRowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  type: z
    .enum(["material", "product", "Material", "Product"])
    .transform((val) => val.toLowerCase() as "material" | "product"),
  currentStock: z.coerce.number().min(0, "Current stock must be non-negative"),
});

/**
 * POST /api/stores/[id]/stock/import
 * Implements bulk update of stock levels from a CSV file.
 *
 * Flow:
 * 1. Validate Store Auth
 * 2. Parse CSV
 * 3. Iterate rows and update stock
 * 4. Return summary of success/failures
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "CSV file is required"),
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "File must be a CSV file"),
        { status: 400 }
      );
    }

    // Read and parse file
    const csvContent = await file.text();
    const rows = parseCSV(csvContent, true);

    if (rows.length === 0) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "CSV file is empty"),
        { status: 400 }
      );
    }

    // Process rows
    const results: Array<{
      sku: string;
      type: "material" | "product";
      success: boolean;
      message?: string;
    }> = [];

    for (const row of rows) {
      try {
        const validatedRow = stockImportRowSchema.parse(row);

        if (validatedRow.type === "material") {
          const material = await materialService.getMaterialBySku(storeId!, validatedRow.sku);
          if (!material) throw new Error("Material not found");

          await materialService.updateMaterial(material.id, storeId!, {
            currentStock: validatedRow.currentStock,
          });
          results.push({ sku: validatedRow.sku, type: "material", success: true });
        } else {
          const product = await productService.getProductBySku(storeId!, validatedRow.sku);
          if (!product) throw new Error("Product not found");

          await productService.updateProduct(product.id, storeId!, {
            currentStock: validatedRow.currentStock,
          });
          results.push({ sku: validatedRow.sku, type: "product", success: true });
        }
      } catch (error) {
        // Handle individual row errors gracefully
        let errorMessage = "Unknown error";
        if (error instanceof z.ZodError) {
          errorMessage = error.errors.map((e) => e.message).join(", ");
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        results.push({
          sku: row.sku || "unknown",
          type: (row.type?.toLowerCase() as "material" | "product") || "material",
          success: false,
          message: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json(
      createSuccessResponse({
        message: `Imported ${successCount} items successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      })
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/stock/import",
    requireStoreAuth: true,
  }
);
