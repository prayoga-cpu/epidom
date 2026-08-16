import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertKeys } from "@/features/dashboard/shared/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";

export interface PrepListItem {
  productId: string;
  name: string;
  department: "KITCHEN" | "BAR" | "BOTH";
  unit: string;
  currentStock: number;
  parLevel: number;
  /** Units needed to reach par, already netted against `outstandingShortfall`. */
  suggested: number;
  /**
   * Units sold before they were prepped. Their ingredients ALREADY left stock
   * at the till, so logging them again would draw the same materials twice —
   * settlement handles that server-side, but the number is surfaced so the
   * arithmetic is never silent.
   */
  outstandingShortfall: number;
  recipeId: string;
  recipeName: string;
}

export interface QuickLogResult {
  id: string;
  batchNumber: string;
  quantity: number;
  settledQuantity: number;
}

export const prepListKeys = {
  all: ["production", "prep-list"] as const,
  byStore: (storeId: string) => [...prepListKeys.all, storeId] as const,
};

/** API returns `{ success: true, data: {...} }` — same unwrap as the sibling hooks. */
async function unwrap<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || fallbackMessage);
  }
  const result = await response.json();
  return result.success === true ? result.data : result;
}

export function usePrepList(storeId: string) {
  return useQuery({
    queryKey: prepListKeys.byStore(storeId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/production/prep-list`);
      return unwrap<{ items: PrepListItem[]; total: number }>(
        response,
        "Failed to fetch prep list"
      );
    },
    enabled: Boolean(storeId),
  });
}

/**
 * One-tap "we made N of these" — creates a COMPLETED batch, draws the materials
 * and credits the finished goods in a single server transaction.
 */
export function useQuickLogProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { productId: string; quantity: number }) => {
      const response = await fetch(`/api/stores/${storeId}/production/prep-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return unwrap<QuickLogResult>(response, "Failed to log production");
    },
    onSuccess: async (_data, variables) => {
      // Both sides of the ledger moved, so both sides' caches are stale:
      // materials went down, the product's counted balance went up, the
      // movements ledger gained rows, and a material may have crossed its
      // reorder threshold.
      queryClient.invalidateQueries({ queryKey: prepListKeys.byStore(storeId) });
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      // `stockMovementKeys.all` is store-scoped and takes an argument, unlike
      // `alertKeys.all` above — the two key factories in this codebase do not
      // share a shape.
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
      await invalidateMaterialRelatedQueries(queryClient, storeId);
      await invalidateProductRelatedQueries(queryClient, storeId);
    },
  });
}
