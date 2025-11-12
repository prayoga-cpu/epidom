import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService } from "@/lib/services";
import { materialService } from "@/lib/services/material.service";
import { productService } from "@/lib/services/product.service";
import { parseCSV } from "@/lib/utils/csv-import";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

// Validation schema for stock import row
const stockImportRowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  type: z.enum(["material", "product", "Material", "Product"]).transform((val) => val.toLowerCase() as "material" | "product"),
  currentStock: z.coerce.number().min(0, "Current stock must be non-negative"),
});

/**
 * POST /api/stores/[id]/stock/import
 * Import stock levels from CSV file
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Verify store belongs to business
    const store = await businessService.getStoreById(storeId);
    if (!store || store.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "Store not found or does not belong to your business"
        ),
        { status: 404 }
      );
    }

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

    // Read file content
    const csvContent = await file.text();

    // Parse CSV
    const rows = parseCSV(csvContent, true);

    if (rows.length === 0) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "CSV file is empty"),
        { status: 400 }
      );
    }

    // Validate and process each row
    const results: Array<{
      sku: string;
      type: "material" | "product";
      success: boolean;
      message?: string;
    }> = [];

    for (const row of rows) {
      try {
        // Validate row schema
        const validatedRow = stockImportRowSchema.parse(row);

        if (validatedRow.type === "material") {
          // Find material by SKU
          const material = await materialService.getMaterialBySku(storeId, validatedRow.sku);

          if (!material) {
            results.push({
              sku: validatedRow.sku,
              type: "material",
              success: false,
              message: "Material not found",
            });
            continue;
          }

          // Update material stock
          await materialService.updateMaterial(material.id, storeId, {
            currentStock: validatedRow.currentStock,
          });

          results.push({
            sku: validatedRow.sku,
            type: "material",
            success: true,
          });
        } else if (validatedRow.type === "product") {
          // Find product by SKU
          const product = await productService.getProductBySku(storeId, validatedRow.sku);

          if (!product) {
            results.push({
              sku: validatedRow.sku,
              type: "product",
              success: false,
              message: "Product not found",
            });
            continue;
          }

          // Update product stock
          await productService.updateProduct(product.id, storeId, {
            currentStock: validatedRow.currentStock,
          });

          results.push({
            sku: validatedRow.sku,
            type: "product",
            success: true,
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          results.push({
            sku: row.sku || "unknown",
            type: (row.type?.toLowerCase() as "material" | "product") || "material",
            success: false,
            message: error.errors.map((e) => e.message).join(", "),
          });
        } else {
          results.push({
            sku: row.sku || "unknown",
            type: (row.type?.toLowerCase() as "material" | "product") || "material",
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json(
      {
        success: true,
        message: `Imported ${successCount} items successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error importing stock:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to import stock"
      ),
      { status: 500 }
    );
  }
}

