import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { CreateSupplierInput, UpdateSupplierInput } from "@/lib/validation/inventory.schemas";
import { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import { invalidateSupplierRelatedQueries } from "@/lib/utils/cache-helpers";
import { normalizeFilters } from "@/lib/utils/query-key-helpers";

// Response interfaces
export interface SuppliersResponse {
  suppliers: SupplierWithRelations[];
  total: number;
}

export interface SupplierFilterInput {
  search?: string;
  sortBy?: "name" | "contactPerson" | "email" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

// Query keys for cache management (DRY principle)
export const supplierKeys = {
  all: (storeId: string) => ["suppliers", storeId] as const,
  // Access check key - shared across all supplier queries to prevent duplicate 403 checks
  accessCheck: (storeId: string) => [...supplierKeys.all(storeId), "access-check"] as const,
  lists: (storeId: string) => [...supplierKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: SupplierFilterInput) =>
    [...supplierKeys.lists(storeId), normalizeFilters(filters)] as const,
  details: (storeId: string) => [...supplierKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...supplierKeys.details(storeId), id] as const,
};

/**
 * Hook to check if user has access to supplier management
 * This is cached and shared across all supplier queries to prevent duplicate 403 requests
 *
 * IMPORTANT: This hook makes a single request that all supplier hooks depend on.
 * This prevents race conditions where multiple hooks fetch simultaneously and all get 403.
 */

/**
 * Hook to check if user has access to supplier management
 * This is cached and shared across all supplier queries to prevent duplicate 403 requests
 *
 * OPTIMIZATION:
 * - STARTER: Returns false immediately (cached) -> No network request
 * - PRO: Returns true immediately -> No network request (data fetch will happen next)
 */
export function useSupplierAccessCheck(storeId: string) {
  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useSubscriptionStatus();

  return useQuery<boolean>({
    queryKey: supplierKeys.accessCheck(storeId),
    queryFn: async () => {
      // If we already know the plan from subscription status, use it!
      if (subscriptionData?.subscription?.plan === "STARTER") {
        return false;
      }

      // If PRO/ENTERPRISE, we assume access is allowed (or let the main query handle it)
      if (
        subscriptionData?.subscription?.plan === "PRO" ||
        subscriptionData?.subscription?.plan === "ENTERPRISE"
      ) {
        return true;
      }

      // Fallback: Make a lightweight request to check access
      // (Only happens if subscription status is unknown/error)
      const response = await fetch(`/api/stores/${storeId}/suppliers?take=1`);

      if (response.status === 403) {
        const error = await response.json().catch(() => ({}));
        if (error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          return false;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to check supplier access");
      }

      return true;
    },
    // Only run this check if subscription status is loaded
    enabled: !!storeId && !isSubscriptionLoading && !!subscriptionData,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Use initial data from subscription status if available
    initialData: () => {
      if (subscriptionData?.subscription?.plan === "STARTER") return false;
      if (
        subscriptionData?.subscription?.plan === "PRO" ||
        subscriptionData?.subscription?.plan === "ENTERPRISE"
      )
        return true;
      return undefined;
    },
  });
}

/**
 * Hook to get access check status
 * Returns { hasAccess, isLoading } - other hooks should wait for isLoading to be false
 * Exported so supplier-orders can also use it
 */
export function useSupplierAccessStatus(storeId: string) {
  const { isLoading: isSubscriptionLoading } = useSubscriptionStatus();
  const {
    data: hasAccess,
    isLoading: isAccessCheckLoading,
    isFetched,
  } = useSupplierAccessCheck(storeId);

  const isLoading = isSubscriptionLoading || isAccessCheckLoading;

  return {
    hasAccess: hasAccess ?? true, // Default to true if not yet checked
    hasNoAccess: hasAccess === false,
    isCheckingAccess: isLoading || (!isFetched && !hasAccess),
  };
}

// API Functions
async function fetchSupplierById(
  storeId: string,
  supplierId: string
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`);

  if (!response.ok) {
    const error = await response.json();

    // Handle 403 Forbidden (subscription feature locked)
    if (response.status === 403 && error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
      const { createSubscriptionError } = await import("@/types/errors");
      const customError = createSubscriptionError(
        error.message || "Supplier Management is only available in Pro and Enterprise plans",
        true
      );
      // Add status for caching detection
      (customError as any).status = 403;
      throw customError;
    }

    throw new Error(error.error?.message || error.message || "Failed to fetch supplier");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function createSupplier(
  storeId: string,
  data: CreateSupplierInput
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Failed to create supplier");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function updateSupplier(
  storeId: string,
  supplierId: string,
  data: UpdateSupplierInput
): Promise<SupplierWithRelations> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Failed to update supplier");
  }

  const responseData = await response.json();
  // API response is wrapped in { success: true, data: {...} }
  return responseData.success === true ? responseData.data : responseData;
}

async function deleteSupplier(storeId: string, supplierId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/${supplierId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Failed to delete supplier");
  }
}

async function bulkDeleteSuppliers(
  storeId: string,
  supplierIds: string[]
): Promise<{ deletedCount: number }> {
  const response = await fetch(`/api/stores/${storeId}/suppliers/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: supplierIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Failed to delete suppliers");
  }

  const responseData = await response.json();
  return responseData.success === true ? responseData.data : responseData;
}

async function exportSuppliers(storeId: string, filters: SupplierFilterInput): Promise<void> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const response = await fetch(`/api/stores/${storeId}/suppliers/export?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();

    // Handle 403 Forbidden (subscription feature locked)
    if (response.status === 403 && error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
      const { createSubscriptionError } = await import("@/types/errors");
      const customError = createSubscriptionError(
        error.message || "Export feature is only available in Pro and Enterprise plans",
        true
      );
      (customError as any).status = 403;
      throw customError;
    }

    throw new Error(error.error?.message || error.message || "Failed to export suppliers");
  }

  // Download CSV file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suppliers-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// React Query Hooks

export interface UseSuppliersOptions {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

/**
 * Fetch all suppliers with filters
 * Uses shared access check to prevent duplicate 403 requests across different filter combinations
 */
export function useSuppliers(
  storeId: string,
  filters: SupplierFilterInput,
  options?: UseSuppliersOptions
) {
  const queryClient = useQueryClient();
  // Normalize filters untuk consistent query keys (prevent cache fragmentation)
  const normalizedFilters = normalizeFilters(filters);

  // Use the access check hook to prevent race conditions
  // This ensures only ONE request is made to check access, not multiple concurrent requests
  const { hasNoAccess, isCheckingAccess } = useSupplierAccessStatus(storeId);

  return useQuery<SuppliersResponse>({
    queryKey: supplierKeys.list(storeId, normalizedFilters),
    queryFn: async () => {
      // Build query string
      const params = new URLSearchParams();
      if (normalizedFilters) {
        Object.entries(normalizedFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/suppliers${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();

        // Handle 403 Forbidden (subscription feature locked)
        if (response.status === 403 && error.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          // Cache the access check result to prevent other queries from fetching
          queryClient.setQueryData(supplierKeys.accessCheck(storeId), false);

          const { createSubscriptionError } = await import("@/types/errors");
          const customError = createSubscriptionError(
            error.message || "Supplier Management is only available in Pro and Enterprise plans",
            true
          );
          // Add status for caching detection
          (customError as any).status = 403;
          throw customError;
        }

        throw new Error(error.error || "Failed to fetch suppliers");
      }

      // Mark access as granted
      queryClient.setQueryData(supplierKeys.accessCheck(storeId), true);

      const responseData = await response.json();
      // API response is wrapped in { success: true, data: {...} }
      return responseData.success === true ? responseData.data : responseData;
    },
    // Disable query if:
    // 1. No storeId
    // 2. Still checking access (wait for access check to complete first)
    // 3. User has no access (don't fetch if we know it will 403)
    // 4. Respect external enabled option (e.g., for dialog lazy loading)
    enabled: !!storeId && !isCheckingAccess && !hasNoAccess && (options?.enabled ?? true),
    // Cache configuration: Longer staleTime for 403 errors to avoid repeated failed requests
    staleTime: 5 * 60 * 1000, // 5 minutes - cache 403 errors longer to avoid repeated requests
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
    // Disable refetch if we have a 403 error (subscription locked)
    refetchOnMount: (query) => {
      if (query.state.error && (query.state.error as any)?.status === 403) {
        return false; // Don't refetch 403 errors on mount
      }
      return false; // Don't refetch if data is fresh (within staleTime)
    },
    refetchOnWindowFocus: (query) => {
      if (query.state.error && (query.state.error as any)?.status === 403) {
        return false; // Don't refetch 403 errors on window focus
      }
      return false; // Don't refetch on window focus to prevent spam
    },
    // Don't retry 403 errors (subscription locked)
    retry: (failureCount, error) => {
      if ((error as any)?.status === 403) {
        return false; // Don't retry 403 errors
      }
      return failureCount < 3; // Retry other errors up to 3 times
    },
    refetchInterval: false, // No polling for static data
    meta: {
      refetchInterval: false, // Store in meta for smart polling
    },
  });
}

/**
 * Fetch single supplier by ID
 * Uses shared access check to prevent duplicate 403 requests
 */
export function useSupplier(storeId: string, supplierId: string | null) {
  // Use the access check hook to prevent race conditions
  const { hasNoAccess, isCheckingAccess } = useSupplierAccessStatus(storeId);

  return useQuery<SupplierWithRelations>({
    queryKey: supplierKeys.detail(storeId, supplierId!),
    queryFn: () => fetchSupplierById(storeId, supplierId!),
    // Disable query if still checking access or no access
    enabled: !!storeId && !!supplierId && !isCheckingAccess && !hasNoAccess,
    // Cache configuration: Longer staleTime for 403 errors to avoid repeated failed requests
    staleTime: 5 * 60 * 1000, // 5 minutes - cache 403 errors longer to avoid repeated requests
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
    // Don't refetch if we have a 403 error (subscription locked)
    refetchOnMount: (query) => {
      if (query.state.error && (query.state.error as any)?.status === 403) {
        return false; // Don't refetch 403 errors on mount
      }
      return false; // Don't refetch if data is fresh (within staleTime)
    },
    refetchOnWindowFocus: (query) => {
      if (query.state.error && (query.state.error as any)?.status === 403) {
        return false; // Don't refetch 403 errors on window focus
      }
      return false; // Don't refetch on window focus to prevent spam
    },
    // Don't retry 403 errors (subscription locked)
    retry: (failureCount, error) => {
      if ((error as any)?.status === 403) {
        return false; // Don't retry 403 errors
      }
      return failureCount < 3; // Retry other errors up to 3 times
    },
  });
}

/**
 * Create supplier mutation
 */
export function useCreateSupplier(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierInput) => createSupplier(storeId, data),
    onSuccess: (newSupplier) => {
      // Optimistic update: Add new supplier to all supplier list caches immediately
      queryClient.setQueriesData<SuppliersResponse>(
        { queryKey: supplierKeys.lists(storeId), exact: false },
        (oldData) => {
          // Validate oldData structure before updating
          if (
            oldData &&
            typeof oldData === "object" &&
            "suppliers" in oldData &&
            Array.isArray(oldData.suppliers) &&
            typeof oldData.total === "number"
          ) {
            return {
              ...oldData,
              suppliers: [newSupplier, ...oldData.suppliers],
              total: oldData.total + 1,
            };
          }
          return undefined;
        }
      );

      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      // This allows UI to respond faster without waiting for all invalidations
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Update supplier mutation with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useUpdateSupplier(storeId: string, supplierId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierWithRelations,
    Error,
    UpdateSupplierInput,
    {
      previousSupplier: SupplierWithRelations | undefined;
      previousQueries: Array<[readonly unknown[], SuppliersResponse | undefined]>;
    }
  >({
    mutationFn: (data) => updateSupplier(storeId, supplierId, data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: supplierKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: supplierKeys.detail(storeId, supplierId) });

      // Snapshot previous values for rollback
      const previousSupplier = queryClient.getQueryData<SupplierWithRelations>(
        supplierKeys.detail(storeId, supplierId)
      );
      const previousQueries = queryClient.getQueriesData<SuppliersResponse>({
        queryKey: supplierKeys.lists(storeId),
      });

      // Optimistically update detail cache
      if (previousSupplier) {
        queryClient.setQueryData<SupplierWithRelations>(supplierKeys.detail(storeId, supplierId), {
          ...previousSupplier,
          ...newData,
          updatedAt: new Date(),
        } as SupplierWithRelations);
      }

      // Optimistically update all list caches
      queryClient.setQueriesData<SuppliersResponse>(
        { queryKey: supplierKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.suppliers) return oldData;
          return {
            ...oldData,
            suppliers: oldData.suppliers.map((s) =>
              s.id === supplierId
                ? ({
                    ...s,
                    ...newData,
                    updatedAt: new Date(),
                  } as SupplierWithRelations)
                : s
            ),
          };
        }
      );

      return { previousSupplier, previousQueries };
    },
    onError: (error, newData, context) => {
      // Rollback optimistic update on error
      if (context?.previousSupplier) {
        queryClient.setQueryData(
          supplierKeys.detail(storeId, supplierId),
          context.previousSupplier
        );
      }
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (updatedSupplier) => {
      // Replace optimistic data with real server data
      queryClient.setQueryData(supplierKeys.detail(storeId, supplierId), updatedSupplier);

      // Update in all list caches with real data
      queryClient.setQueriesData<SuppliersResponse>(
        { queryKey: supplierKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.suppliers) return oldData;
          return {
            ...oldData,
            suppliers: oldData.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
          };
        }
      );

      // Non-blocking cache invalidation for related queries
      invalidateSupplierRelatedQueries(queryClient, storeId, false, true);
    },
  });
}

/**
 * Delete supplier mutation with optimistic updates
 * Real-time: Removes from UI immediately, syncs with server in background
 */
export function useDeleteSupplier(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    string,
    { previousQueries: Array<[readonly unknown[], SuppliersResponse | undefined]> }
  >({
    mutationFn: (supplierId) => deleteSupplier(storeId, supplierId),
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: supplierKeys.lists(storeId) });

      // Snapshot previous queries
      const previousQueries = queryClient.getQueriesData<SuppliersResponse>({
        queryKey: supplierKeys.lists(storeId),
      });

      // Optimistically remove from all matching caches
      queryClient.setQueriesData<SuppliersResponse>(
        { queryKey: supplierKeys.lists(storeId) },
        (oldData) => {
          if (!oldData || !oldData.suppliers) return oldData;
          return {
            ...oldData,
            suppliers: oldData.suppliers.filter((s) => s.id !== deletedId),
            total: Math.max(0, oldData.total - 1),
          };
        }
      );

      return { previousQueries };
    },
    onError: (error, deletedId, context) => {
      // Rollback optimistic update on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: supplierKeys.detail(storeId, deletedId) });

      // Non-blocking cache invalidation for related queries
      invalidateSupplierRelatedQueries(queryClient, storeId, false, true);
    },
  });
}

/**
 * Bulk delete suppliers mutation
 */
export function useBulkDeleteSuppliers(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierIds: string[]) => bulkDeleteSuppliers(storeId, supplierIds),
    onSuccess: (_, supplierIds) => {
      // Remove all deleted items from cache
      supplierIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: supplierKeys.detail(storeId, id) });
      });
      // Non-blocking cache invalidation: Only invalidate suppliers immediately
      // Other queries (materials) will sync in background
      invalidateSupplierRelatedQueries(queryClient, storeId, false);
    },
  });
}

/**
 * Export suppliers
 */
export function useExportSuppliers() {
  return useMutation({
    mutationFn: ({ storeId, filters }: { storeId: string; filters: SupplierFilterInput }) =>
      exportSuppliers(storeId, filters),
  });
}
