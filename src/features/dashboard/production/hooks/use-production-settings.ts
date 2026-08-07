import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface ProductionSettings {
  productionEnabled: boolean;
}

export function useProductionSettings(storeId: string) {
  return useQuery({
    queryKey: ["production", "settings", storeId],
    queryFn: () => apiClient.get<ProductionSettings>(`/stores/${storeId}/production/settings`),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
}

export function useUpdateProductionSettings(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productionEnabled: boolean) =>
      apiClient.patch<ProductionSettings>(`/stores/${storeId}/production/settings`, {
        productionEnabled,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["production", "settings", storeId], data);
    },
  });
}
