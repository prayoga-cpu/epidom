import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface KdsSettings {
  kitchenDisplayEnabled: boolean;
}

export function useKdsSettings(storeId: string) {
  return useQuery({
    queryKey: ["pos", "kds-settings", storeId],
    queryFn: () => apiClient.get<KdsSettings>(`/stores/${storeId}/pos/kds/settings`),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
}

export function useUpdateKdsSettings(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kitchenDisplayEnabled: boolean) =>
      apiClient.patch<KdsSettings>(`/stores/${storeId}/pos/kds/settings`, {
        kitchenDisplayEnabled,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["pos", "kds-settings", storeId], data);
    },
  });
}
