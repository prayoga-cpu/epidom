import { materialService } from "@/lib/services/material.service";
import { productService } from "@/lib/services/product.service";
import { parseCSV } from "@/lib/utils/csv-import";
import { z } from "zod";

// Validation schema for stock import row
export const stockImportRowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  type: z
    .enum(["material", "product", "Material", "Product"])
    .transform((val) => val.toLowerCase() as "material" | "product"),
  currentStock: z.coerce.number().min(0, "Current stock must be non-negative"),
});

export type StockImportResult = {
  sku: string;
  type: "material" | "product";
  success: boolean;
  message?: string;
};

export class ImportService {
  /**
   * Process stock import from CSV content
   * Parses the CSV, validates each row, and updates the stock.
   */
  async importStock(storeId: string, csvContent: string) {
    const rows = parseCSV(csvContent, true);

    if (rows.length === 0) {
      throw new Error("CSV file is empty");
    }

    const results: Array<StockImportResult> = [];

    for (const row of rows) {
      try {
        const validatedRow = stockImportRowSchema.parse(row);

        if (validatedRow.type === "material") {
          const material = await materialService.getMaterialBySku(storeId, validatedRow.sku);
          if (!material) throw new Error("Material not found");

          await materialService.updateMaterial(material.id, storeId, {
            currentStock: validatedRow.currentStock,
          });
          results.push({ sku: validatedRow.sku, type: "material", success: true });
        } else {
          const product = await productService.getProductBySku(storeId, validatedRow.sku);
          if (!product) throw new Error("Product not found");

          await productService.updateProduct(product.id, storeId, {
            currentStock: validatedRow.currentStock,
          });
          results.push({ sku: validatedRow.sku, type: "product", success: true });
        }
      } catch (error) {
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

    return {
      message: `Imported ${successCount} items successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    };
  }
}

export const importService = new ImportService();
