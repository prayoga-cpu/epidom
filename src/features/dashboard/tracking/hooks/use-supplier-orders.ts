import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { alertKeys } from "./use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";
import { materialKeys } from "@/features/dashboard/data/materials/hooks/use-materials";

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

// Query keys
export const supplierOrderKeys = {
  all: ["supplier-orders"] as const,
  lists: (storeId: string) => [...supplierOrderKeys.all, "list", storeId] as const,
  detail: (storeId: string, orderId: string) =>
    [...supplierOrderKeys.all, "detail", storeId, orderId] as const,
};

/**
 * Hook to fetch all supplier orders for a store
 * Real-time enabled: Polls every 60 seconds when tab is active
 */
export function useSupplierOrders(
  storeId: string,
  initialData?: SupplierOrdersResponse
) {
  return useQuery<SupplierOrdersResponse>({
    queryKey: supplierOrderKeys.lists(storeId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check if it's a subscription feature locked error
        if (response.status === 403 && errorData.code === "SUBSCRIPTION_FEATURE_LOCKED") {
          const customError: any = new Error(errorData.message || "Supplier Management is only available in Pro and Enterprise plans");
          customError.code = "SUBSCRIPTION_FEATURE_LOCKED";
          customError.status = 403;
          customError.upgradeRequired = true;
          throw customError;
        }

        throw new Error(errorData.message || "Failed to fetch supplier orders");
      }
      return response.json();
    },
    enabled: !!storeId,
    initialData, // ✅ Accept initial data from Server Component
    // Real-time configuration: Moderate polling for supplier management
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Poll every 10 seconds - moderate priority
    refetchIntervalInBackground: false, // Only poll when tab is active
    refetchOnMount: false, // Don't refetch if data is fresh (within staleTime)
    refetchOnWindowFocus: true, // Refetch on window focus if stale
    meta: {
      refetchInterval: 10 * 1000, // Store in meta for smart polling
    },
  });
}

/**
 * Hook to fetch a specific supplier order
 */
export function useSupplierOrder(storeId: string, orderId: string) {
  return useQuery<SupplierOrderResponse>({
    queryKey: supplierOrderKeys.detail(storeId, orderId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${orderId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch supplier order");
      }
      return response.json();
    },
    enabled: !!storeId && !!orderId,
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
 * Hook to update a supplier order
 */
export function useUpdateSupplierOrder(storeId: string, orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSupplierOrderInput) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supplierOrderKeys.lists(storeId),
      });
      queryClient.invalidateQueries({
        queryKey: supplierOrderKeys.detail(storeId, orderId),
      });
      // Invalidate alerts since stock might have changed
      queryClient.invalidateQueries({
        queryKey: alertKeys.lists(storeId),
      });
      // Invalidate materials (stock may have increased on delivery)
      queryClient.invalidateQueries({
        queryKey: materialKeys.lists(storeId),
      });
      // Invalidate stock movements (new stock movements created on delivery)
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.all(storeId),
      });
      toast.success("Supplier order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update supplier order");
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
