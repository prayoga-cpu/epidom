import { localizeServerMessage } from "@/lib/i18n/server-messages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { stockMovementKeys } from "./use-stock-movements";
import { unwrapApiData, unwrapApiError } from "@/lib/api/unwrap";

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
async function importStock(
  storeId: string,
  file: File,
  fallbackMessage: string
): Promise<StockImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/stores/${storeId}/stock/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = unwrapApiError(await response.json().catch(() => ({})));
    throw new Error(localizeServerMessage(error.message || fallbackMessage));
  }

  // The route wraps its payload, so `summary` — which onSuccess reads to build
  // the "N imported, M failed" toast — sits one level down.
  return unwrapApiData<StockImportResponse>(await response.json());
}

/**
 * Hook for importing stock from CSV
 */
export function useImportStock(storeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation<StockImportResponse, Error, File>({
    mutationFn: (file) => importStock(storeId, file, t("management.editStock.import.failedDesc")),
    onSuccess: async (data) => {
      // Batch invalidate all related queries for better performance
      await invalidateMaterialRelatedQueries(queryClient, storeId);

      // Also invalidate products and stock movements
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      });

      // Show success toast
      if (data.summary.failed === 0) {
        toast.success(t("management.editStock.import.successTitle"), {
          description: t("management.editStock.import.successDesc").replace(
            "{count}",
            String(data.summary.successful)
          ),
        });
      } else {
        toast.warning(t("management.editStock.import.partialTitle"), {
          description: t("management.editStock.import.partialDesc")
            .replace("{success}", String(data.summary.successful))
            .replace("{failed}", String(data.summary.failed)),
        });
      }
    },
    onError: (error) => {
      toast.error(t("management.editStock.import.failedTitle"), {
        description: localizeServerMessage(error.message || t("management.editStock.import.failedDesc")),
      });
    },
  });
}
