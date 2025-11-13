import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { materialKeys } from "@/features/dashboard/data/materials/hooks/use-materials";
import { productKeys } from "@/features/dashboard/data/products/hooks/use-products";
import { stockMovementKeys } from "./use-stock-movements";

export interface StockImportResult {
  sku: string;
  type: "material" | "product";
  success: boolean;
  message?: string;
}

export interface StockImportResponse {
  success: boolean;
  message: string;
  results: StockImportResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Import stock from CSV file
 */
async function importStock(storeId: string, file: File): Promise<StockImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/stores/${storeId}/stock/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to import stock");
  }

  return response.json();
}

/**
 * Hook for importing stock from CSV
 */
export function useImportStock(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<StockImportResponse, Error, File>({
    mutationFn: (file) => importStock(storeId, file),
    onSuccess: (data) => {
      // Invalidate queries to refresh stock data
      queryClient.invalidateQueries({ queryKey: materialKeys.all(storeId) });
      queryClient.invalidateQueries({ queryKey: productKeys.all(storeId) });
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });

      // Show success toast
      if (data.summary.failed === 0) {
        toast.success("Stock Import Successful", {
          description: `Successfully imported ${data.summary.successful} items`,
        });
      } else {
        toast.warning("Stock Import Completed with Errors", {
          description: `Imported ${data.summary.successful} items, ${data.summary.failed} failed`,
        });
      }
    },
    onError: (error) => {
      toast.error("Stock Import Failed", {
        description: error.message || "Failed to import stock. Please check your CSV file and try again.",
      });
    },
  });
}

