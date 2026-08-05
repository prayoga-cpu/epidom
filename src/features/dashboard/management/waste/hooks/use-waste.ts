"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WasteReason } from "@prisma/client";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";
import type { MaterialsResponse } from "@/features/dashboard/data/materials/hooks/use-materials";
import type { ProductsResponse } from "@/features/dashboard/data/products/hooks/use-products";
import type { Decimal } from "@prisma/client/runtime/client";

export interface WasteItemRef {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

export interface WasteEntryWithRelations {
  id: string;
  storeId: string;
  materialId: string | null;
  productId: string | null;
  quantity: number;
  unit: string;
  reason: WasteReason;
  customReason: string | null;
  notes: string | null;
  unitCostSnapshot: number;
  totalValue: number;
  referenceId: string | null;
  createdAt: string;
  updatedAt: string;
  material: WasteItemRef | null;
  product: WasteItemRef | null;
}

export interface WasteEntriesResponse {
  entries: WasteEntryWithRelations[];
  total: number;
  sumValue: number;
}

export interface WasteListFilters {
  from?: string;
  to?: string;
  materialId?: string;
  productId?: string;
  reason?: WasteReason;
  take?: number;
  skip?: number;
}

export interface RecordWasteInput {
  materialId?: string;
  productId?: string;
  quantity: number;
  reason: WasteReason;
  customReason?: string;
  notes?: string;
  referenceId?: string;
}

export interface UpdateWasteInput {
  quantity?: number;
  reason?: WasteReason;
  customReason?: string;
  notes?: string;
  referenceId?: string;
  unitCostOverride?: number;
}

export const wasteKeys = {
  all: (storeId: string) => ["waste", storeId] as const,
  lists: (storeId: string) => [...wasteKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: WasteListFilters) =>
    [...wasteKeys.lists(storeId), normalizeFilters(filters)] as const,
};

async function parseOrThrow(response: Response) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || "Request failed");
  }
  return body.data;
}

export function useWasteEntries(storeId: string, filters?: WasteListFilters) {
  const normalizedFilters = normalizeFilters(filters);

  return useQuery<WasteEntriesResponse>({
    queryKey: wasteKeys.list(storeId, normalizedFilters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (normalizedFilters) {
        Object.entries(normalizedFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }
      const response = await fetch(`/api/stores/${storeId}/waste?${params.toString()}`);
      return parseOrThrow(response);
    },
    enabled: !!storeId,
    staleTime: 15 * 1000,
  });
}

function applyStockDeltaOptimistically(
  queryClient: ReturnType<typeof useQueryClient>,
  storeId: string,
  input: { materialId?: string; productId?: string },
  delta: number
) {
  if (input.materialId) {
    queryClient.setQueriesData<MaterialsResponse>(
      { queryKey: ["materials", storeId, "list"] },
      (oldData) => {
        if (!oldData?.materials) return oldData;
        return {
          ...oldData,
          materials: oldData.materials.map((m) =>
            m.id === input.materialId
              ? { ...m, currentStock: ((Number(m.currentStock) || 0) + delta) as unknown as Decimal }
              : m
          ),
        };
      }
    );
  }
  if (input.productId) {
    queryClient.setQueriesData<ProductsResponse>(
      { queryKey: ["products", storeId, "list"] },
      (oldData) => {
        if (!oldData?.products) return oldData;
        return {
          ...oldData,
          products: oldData.products.map((p) =>
            p.id === input.productId
              ? { ...p, currentStock: ((Number(p.currentStock) || 0) + delta) as unknown as Decimal }
              : p
          ),
        };
      }
    );
  }
}

async function settleWaste(queryClient: ReturnType<typeof useQueryClient>, storeId: string) {
  queryClient.invalidateQueries({ queryKey: wasteKeys.all(storeId), exact: false });
  queryClient.invalidateQueries({ queryKey: ["finance-summary", storeId], exact: false });
  queryClient.invalidateQueries({ queryKey: ["finance-waste", storeId], exact: false });
  await Promise.all([
    invalidateMaterialRelatedQueries(queryClient, storeId, false),
    invalidateProductRelatedQueries(queryClient, storeId, false),
  ]);
}

export function useRecordWaste(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordWasteInput) => {
      const response = await fetch(`/api/stores/${storeId}/waste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseOrThrow(response);
    },
    onMutate: async (input) => {
      applyStockDeltaOptimistically(queryClient, storeId, input, -input.quantity);
    },
    onSettled: () => settleWaste(queryClient, storeId),
  });
}

export function useUpdateWasteEntry(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wasteId, input }: { wasteId: string; input: UpdateWasteInput }) => {
      const response = await fetch(`/api/stores/${storeId}/waste/${wasteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseOrThrow(response);
    },
    onSettled: () => settleWaste(queryClient, storeId),
  });
}

export function useDeleteWasteEntry(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wasteId: string) => {
      const response = await fetch(`/api/stores/${storeId}/waste/${wasteId}`, {
        method: "DELETE",
      });
      return parseOrThrow(response);
    },
    onSettled: () => settleWaste(queryClient, storeId),
  });
}
