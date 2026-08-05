import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { alertKeys } from "./use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { materialKeys } from "@/features/dashboard/data/materials/hooks/use-materials";
import {
  supplierKeys,
  useSupplierAccessStatus,
} from "@/features/dashboard/data/suppliers/hooks/use-suppliers";

export interface SupplierOrderItem {
  id: string;
  materialId: string;
  material: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface SupplierOrder {
  id: string;
  storeId: string;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  orderNumber: string;
  status: "PENDING" | "PLACED" | "RECEIVED" | "CANCELLED";
  orderDate: string;
  expectedDate: string | null;
  receivedDate: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes: string | null;
  items: SupplierOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOrdersResponse {
  orders: SupplierOrder[];
}

interface SupplierOrderResponse {
  order: SupplierOrder;
}

interface CreateSupplierOrderInput {
  supplierId: string;
  items: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  expectedDate?: string;
  notes?: string;
  tax?: number;
  shipping?: number;
}

interface UpdateSupplierOrderInput {
  status?: "PENDING" | "PLACED" | "RECEIVED" | "CANCELLED";
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
}

interface SubscriptionError extends Error {
  code?: string;
  status?: number;
  upgradeRequired?: boolean;
}

// Query keys
export const supplierOrderKeys = {
  all: ["supplier-orders"] as const,
  lists: (storeId: string) => [...supplierOrderKeys.all, "list", storeId] as const,
  detail: (storeId: string, orderId: string) =>
    [...supplierOrderKeys.all, "detail", storeId, orderId] as const,
};

/**
 * Hook to fetch all supplier orders for a store
 * Real-time enabled: Polls every 10 seconds when tab is active
 * Uses shared access check with suppliers to prevent duplicate 403 requests
 */
export function useSupplierOrders(storeId: string, initialData?: SupplierOrdersResponse) {
  const queryClient = useQueryClient();

  // Use the shared access check hook to prevent race conditions
  // This ensures only ONE request is made to check access
  const { hasNoAccess, isCheckingAccess } = useSupplierAccessStatus(storeId);

  return useQuery<SupplierOrdersResponse>({
    queryKey: supplierOrderKeys.lists(storeId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check if it's a subscription feature locked error
        if (response.status === 403 && errorData.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          // Cache the access check result to prevent other supplier queries from fetching
          queryClient.setQueryData(supplierKeys.accessCheck(storeId), false);

          const customError = new Error(
            errorData.message || "Supplier Management is only available in Pro and Enterprise plans"
          ) as SubscriptionError;
          customError.code = "SUBSCRIPTION_FEATURE_LOCKED";
          customError.status = 403;
          customError.upgradeRequired = true;
          throw customError;
        }

        throw new Error(errorData.message || "Failed to fetch supplier orders");
      }

      // Mark access as granted
      queryClient.setQueryData(supplierKeys.accessCheck(storeId), true);

      return response.json();
    },
    // Disable query if still checking access or no access
    enabled: !!storeId && !isCheckingAccess && !hasNoAccess,
    initialData, // ✅ Accept initial data from Server Component
    // Cache configuration: Longer staleTime for 403 errors to avoid repeated failed requests
    staleTime: 5 * 60 * 1000, // 5 minutes - cache 403 errors longer to avoid repeated requests
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
    // Disable polling - will be conditionally enabled via refetchInterval
    refetchInterval: (query) => {
      // Don't poll if we have a 403 error (subscription locked)
      if (query.state.error && (query.state.error as SubscriptionError)?.status === 403) {
        return false; // Disable polling for 403 errors
      }
      return 10 * 1000; // Poll every 10 seconds for successful responses
    },
    refetchIntervalInBackground: false, // Only poll when tab is active
    // Don't refetch on mount if we have a 403 error
    refetchOnMount: (query) => {
      if (query.state.error && (query.state.error as SubscriptionError)?.status === 403) {
        return false; // Don't refetch 403 errors on mount
      }
      return false; // Don't refetch if data is fresh (within staleTime)
    },
    // Don't refetch on window focus if we have a 403 error
    refetchOnWindowFocus: (query) => {
      if (query.state.error && (query.state.error as SubscriptionError)?.status === 403) {
        return false; // Don't refetch 403 errors on window focus
      }
      return false; // Don't refetch on window focus to prevent spam
    },
    // Don't retry 403 errors (subscription locked)
    retry: (failureCount, error) => {
      if ((error as SubscriptionError)?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
    meta: {
      refetchInterval: 10 * 1000, // Store in meta for smart polling
    },
  });
}

/**
 * Hook to fetch a specific supplier order
 * Caching: 403 responses are cached for 5 minutes to avoid repeated failed requests
 */
export function useSupplierOrder(storeId: string, orderId: string) {
  const { hasNoAccess, isCheckingAccess } = useSupplierAccessStatus(storeId);

  return useQuery<SupplierOrderResponse>({
    queryKey: supplierOrderKeys.detail(storeId, orderId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check if it's a subscription feature locked error
        if (response.status === 403 && errorData.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          const customError: any = new Error(
            errorData.message || "Supplier Management is only available in Pro and Enterprise plans"
          );
          customError.code = "SUBSCRIPTION_FEATURE_LOCKED";
          customError.status = 403;
          customError.upgradeRequired = true;
          throw customError;
        }

        throw new Error(errorData.message || "Failed to fetch supplier order");
      }
      return response.json();
    },
    enabled: !!storeId && !!orderId && !isCheckingAccess && !hasNoAccess,
    // Cache configuration: Longer staleTime for 403 errors to avoid repeated failed requests
    staleTime: 5 * 60 * 1000, // 5 minutes - cache 403 errors longer to avoid repeated requests
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
      return true; // Refetch on window focus if stale
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
 * Hook to create a new supplier order
 */
export function useCreateSupplierOrder(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSupplierOrderInput) => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create supplier order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supplierOrderKeys.lists(storeId),
      });
      toast.success("Supplier order created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create supplier order");
    },
  });
}

/**
 * Hook to update a supplier order with optimistic updates
 * Real-time: Updates UI immediately, syncs with server in background
 */
export function useUpdateSupplierOrder(storeId: string, orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierOrderResponse,
    Error,
    UpdateSupplierOrderInput,
    {
      previousOrder: SupplierOrderResponse | undefined;
      previousList: SupplierOrdersResponse | undefined;
    }
  >({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update supplier order");
      }

      return response.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: supplierOrderKeys.lists(storeId) });
      await queryClient.cancelQueries({ queryKey: supplierOrderKeys.detail(storeId, orderId) });

      const previousOrder = queryClient.getQueryData<SupplierOrderResponse>(
        supplierOrderKeys.detail(storeId, orderId)
      );
      const previousList = queryClient.getQueryData<SupplierOrdersResponse>(
        supplierOrderKeys.lists(storeId)
      );

      if (previousOrder) {
        queryClient.setQueryData<SupplierOrderResponse>(
          supplierOrderKeys.detail(storeId, orderId),
          {
            order: {
              ...previousOrder.order,
              ...newData,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }

      if (previousList) {
        queryClient.setQueryData<SupplierOrdersResponse>(supplierOrderKeys.lists(storeId), {
          orders: previousList.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...newData,
                  updatedAt: new Date().toISOString(),
                }
              : o
          ),
        });
      }

      return { previousOrder, previousList };
    },
    onError: (error, newData, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(supplierOrderKeys.detail(storeId, orderId), context.previousOrder);
      }
      if (context?.previousList) {
        queryClient.setQueryData(supplierOrderKeys.lists(storeId), context.previousList);
      }
      toast.error(error.message || "Failed to update supplier order");
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(supplierOrderKeys.detail(storeId, orderId), updatedOrder);

      const currentList = queryClient.getQueryData<SupplierOrdersResponse>(
        supplierOrderKeys.lists(storeId)
      );
      if (currentList) {
        queryClient.setQueryData<SupplierOrdersResponse>(supplierOrderKeys.lists(storeId), {
          orders: currentList.orders.map((o) => (o.id === orderId ? updatedOrder.order : o)),
        });
      }

      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      queryClient.invalidateQueries({ queryKey: materialKeys.lists(storeId) });
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });

      toast.success("Supplier order updated successfully");
    },
  });
}

/**
 * Hook to cancel a supplier order
 */
export function useCancelSupplierOrder(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${orderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel supplier order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supplierOrderKeys.lists(storeId),
      });
      toast.success("Supplier order cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel supplier order");
    },
  });
}
