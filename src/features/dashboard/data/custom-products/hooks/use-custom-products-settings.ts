import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface CustomProductsSettings {
  customProductsEnabled: boolean;
  customProductsLabel: string | null;
  // Independent of customProductsEnabled — whether custom-line items also
  // publish to the public storefront menu, set from Storefront Settings.
  customProductsShowOnStorefront: boolean;
}

export function useCustomProductsSettings(storeId: string) {
  return useQuery({
    queryKey: ["custom-products", "settings", storeId],
    queryFn: () =>
      apiClient.get<CustomProductsSettings>(`/stores/${storeId}/custom-products/settings`),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
}

export function useUpdateCustomProductsSettings(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      input: Partial<{
        customProductsEnabled: boolean;
        customProductsLabel: string;
        customProductsShowOnStorefront: boolean;
      }>
    ) => apiClient.patch<CustomProductsSettings>(`/stores/${storeId}/custom-products/settings`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(["custom-products", "settings", storeId], data);
    },
  });
}
