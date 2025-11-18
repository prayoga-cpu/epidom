import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateMaterialRelatedQueries } from "@/lib/utils/cache-helpers";
import { stockMovementKeys } from "./use-stock-movements";

export interface StockAdjustmentInput {
  materialId?: string;
  productId?: string;
  adjustmentType: "IN" | "OUT";
  quantity: number;
  reason: string;
  notes?: string;
  referenceId?: string;
}

interface StockAdjustmentResponse {
  material?: any;
  product?: any;
  movement: {
    id: string;
    type: string;
    quantity: number;
    balanceAfter: number;
    reason?: string;
    notes?: string;
    referenceId?: string;
  };
}

/**
 * Hook for adjusting stock
 */
async function adjustStock(storeId: string, input: StockAdjustmentInput): Promise<StockAdjustmentResponse> {
  const response = await fetch(`/api/stores/${storeId}/stock/adjust`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to adjust stock");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Hook for adjusting stock with cache invalidation
 */
export function useStockAdjustment(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<StockAdjustmentResponse, Error, StockAdjustmentInput>({
    mutationFn: (input) => adjustStock(storeId, input),
    onSuccess: async () => {
      // Invalidate all related queries
      await invalidateMaterialRelatedQueries(queryClient, storeId);

      // Also invalidate stock movements specifically
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
        exact: false,
      });
    },
  });
}

