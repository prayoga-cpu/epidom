"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SerializeDecimal } from "@/types/prisma";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import {
  useMaterials,
  useDeleteMaterial,
  useBulkDeleteMaterials,
  useExportMaterials,
} from "./use-materials";
import { supplierKeys } from "../../suppliers/hooks/use-suppliers";

// Stock status type
export type StockFilter = "in_stock" | "low_stock" | "out_of_stock" | "overstocked" | undefined;

// Helper function to get stock status key
export function getStockStatusKey(current: number, min: number, max: number): string {
  if (current <= 0) return "outOfStock";
  if (current <= min) return "lowStock";
  if (current > max) return "overstocked";
  return "inStock";
}

// Helper function to get stock status variant
export function getStockStatusVariant(
  statusKey: string
): "default" | "destructive" | "secondary" | "outline" {
  if (statusKey === "outOfStock") return "destructive";
  if (statusKey === "lowStock") return "outline";
  if (statusKey === "overstocked") return "secondary";
  return "default";
}

// Supplier filter configuration for prefetch
const SUPPLIER_PREFETCH_FILTERS = {
  sortBy: "name" as const,
  sortOrder: "asc" as const,
  skip: 0,
  take: 100,
};

// Filter state interface
export interface MaterialFiltersState {
  search: string;
  category: string;
  supplierId: string;
  stockStatus: StockFilter;
  sortBy: "createdAt" | "name" | "sku" | "currentStock" | "unitCost" | "updatedAt";
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}

// Default filters
const DEFAULT_FILTERS: MaterialFiltersState = {
  search: "",
  category: "",
  supplierId: "",
  stockStatus: undefined,
  sortBy: "createdAt",
  sortOrder: "desc",
  skip: 0,
  take: 50,
};

interface UseMaterialSectionStateOptions {
  storeId: string;
  initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];
  t: (key: string) => string;
}

/**
 * Custom hook to manage material section state and actions.
 * Extracts filter logic, data fetching, and action handlers from MaterialsSection component.
 *
 * This hook consolidates:
 * - Filter state management
 * - Data fetching with TanStack Query
 * - Action handlers (delete, bulk delete, export)
 * - Supplier prefetching
 *
 * @param options - Hook options
 * @returns Material section state and handlers
 */
export function useMaterialSectionState({
  storeId,
  initialMaterials,
  t,
}: UseMaterialSectionStateOptions) {
  const queryClient = useQueryClient();

  // ========================================
  // Supplier Prefetch
  // ========================================
  useEffect(() => {
    if (!storeId) return;

    queryClient.prefetchQuery({
      queryKey: supplierKeys.list(storeId, SUPPLIER_PREFETCH_FILTERS),
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("sortBy", SUPPLIER_PREFETCH_FILTERS.sortBy);
        params.append("sortOrder", SUPPLIER_PREFETCH_FILTERS.sortOrder);
        params.append("skip", String(SUPPLIER_PREFETCH_FILTERS.skip));
        params.append("take", String(SUPPLIER_PREFETCH_FILTERS.take));
        const response = await fetch(`/api/stores/${storeId}/suppliers?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to prefetch suppliers");
        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [storeId, queryClient]);

  // ========================================
  // Filter State
  // ========================================
  const [filters, setFilters] = useState<MaterialFiltersState>(DEFAULT_FILTERS);
  const debouncedSearch = useDebounce(filters.search, 300);

  // ========================================
  // Data Fetching
  // ========================================
  const { data, isLoading, error, refetch } = useMaterials(
    storeId,
    {
      ...filters,
      search: debouncedSearch || undefined,
    },
    initialMaterials
      ? {
          materials: initialMaterials,
          total: initialMaterials.length,
        }
      : undefined
  );

  const materials = data?.materials || [];
  const total = data?.total || 0;

  // ========================================
  // Mutations
  // ========================================
  const deleteMaterial = useDeleteMaterial(storeId);
  const bulkDelete = useBulkDeleteMaterials(storeId);
  const exportMaterials = useExportMaterials(storeId);

  // ========================================
  // Derived Data
  // ========================================
  const categories = useMemo(() => {
    const cats = new Set(materials.map((m) => m.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [materials]);

  const processedMaterials = useMemo(() => {
    let filtered = [...materials];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.sku?.toLowerCase().includes(query) ||
          m.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter((m) => m.category === filters.category);
    }

    // Stock status filter
    if (filters.stockStatus) {
      filtered = filtered.filter((m) => {
        const statusKey = getStockStatusKey(
          Number(m.currentStock),
          Number(m.minStock),
          Number(m.maxStock)
        );
        const statusMap: Record<string, StockFilter> = {
          outOfStock: "out_of_stock",
          lowStock: "low_stock",
          overstocked: "overstocked",
          inStock: "in_stock",
        };
        return statusMap[statusKey] === filters.stockStatus;
      });
    }

    return filtered;
  }, [materials, filters.search, filters.category, filters.stockStatus]);

  const hasActiveFilters = !!(filters.search || filters.category || filters.stockStatus);

  // ========================================
  // Filter Handlers
  // ========================================
  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value, skip: 0 }));
  }, []);

  const handleCategoryFilter = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, category: value === "all" ? "" : value, skip: 0 }));
  }, []);

  const handleStockStatusFilter = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      stockStatus: value === "all" ? undefined : (value as StockFilter),
      skip: 0,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // ========================================
  // Action Handlers
  // ========================================
  const handleDeleteConfirm = useCallback(
    async (material: SerializeDecimal<MaterialWithSuppliers> | null, onSuccess?: () => void) => {
      if (!material) return;

      try {
        await deleteMaterial.mutateAsync(material.id);
        toast.success(t("data.materials.toasts.deleted.title"));
        onSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("messages.failedToDeleteMaterial"));
      }
    },
    [deleteMaterial, t]
  );

  const handleBulkDelete = useCallback(
    async (selectedIds: Set<string>, onSuccess?: () => void) => {
      if (selectedIds.size === 0) return;

      try {
        await bulkDelete.mutateAsync({ ids: Array.from(selectedIds) });
        toast.success(
          t("data.materials.toasts.bulkDeleted.description")?.replace(
            "{count}",
            selectedIds.size.toString()
          ) || ""
        );
        onSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("messages.failedToDeleteMaterials"));
      }
    },
    [bulkDelete, t]
  );

  const handleExport = useCallback(async () => {
    try {
      await exportMaterials.mutateAsync(filters);
      // Download handled automatically in the hook
    } catch (error) {
      toast.error(t("messages.errorLoadingMaterials"));
    }
  }, [exportMaterials, filters, t]);

  // ========================================
  // Return
  // ========================================
  return {
    // Data
    materials,
    processedMaterials,
    total,
    categories,

    // State
    filters,
    isLoading,
    error,
    hasActiveFilters,

    // Mutations
    deleteMaterial,
    bulkDelete,
    exportMaterials,

    // Filter handlers
    handleSearch,
    handleCategoryFilter,
    handleStockStatusFilter,
    clearFilters,

    // Action handlers
    handleDeleteConfirm,
    handleBulkDelete,
    handleExport,

    // Utilities
    refetch,
  };
}
