import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DiscountPresetDto, UpsertDiscountPresetBody } from "@/types/api/cashier";
import {
  applyPatch,
  invalidatePosCaches,
  promotionKeys,
  retryTransientOnly,
} from "./promotion-keys";

/**
 * Every discount preset for the Back Office list — including the switched-off
 * ones (`includeInactive=1`), which the till never sees. OPERATIONS-gated
 * server-side: a lower plan answers 403 SUBSCRIPTION_FEATURE_LOCKED, which the
 * section turns into the upgrade prompt. Amounts are literal in the store's
 * currency.
 */
export function useDiscountPresets(storeId: string) {
  return useQuery({
    queryKey: promotionKeys.presets(storeId),
    queryFn: () =>
      apiClient.get<DiscountPresetDto[]>(`/stores/${storeId}/discount-presets`, {
        includeInactive: "1",
      }),
    enabled: !!storeId,
    retry: retryTransientOnly,
  });
}

// `retry: false` on every mutation: the app default re-sends a failed mutation
// once, which would double-post a create on a flaky connection and would
// re-submit a 4xx validation error that can never succeed.

export function useCreateDiscountPreset(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (body: UpsertDiscountPresetBody) =>
      apiClient.post<DiscountPresetDto>(`/stores/${storeId}/discount-presets`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.presets(storeId) });
      void invalidatePosCaches(queryClient, storeId, "presets");
    },
  });
}

export interface UpdateDiscountPresetVariables {
  id: string;
  body: Partial<UpsertDiscountPresetBody>;
}

/**
 * PATCH with an optimistic write, so the active Switch flips the moment it is
 * tapped instead of after a round trip (the Back Office is often used on a
 * phone over a weak connection). A failure restores the previous list; the
 * caller still gets the rejection to show a toast or field errors.
 */
export function useUpdateDiscountPreset(storeId: string) {
  const queryClient = useQueryClient();
  const key = promotionKeys.presets(storeId);
  return useMutation({
    retry: false,
    mutationFn: ({ id, body }: UpdateDiscountPresetVariables) =>
      apiClient.patch<DiscountPresetDto>(`/stores/${storeId}/discount-presets/${id}`, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiscountPresetDto[]>(key);
      queryClient.setQueryData<DiscountPresetDto[]>(key, (rows) =>
        rows?.map((row) => (row.id === id ? applyPatch<DiscountPresetDto>(row, body) : row))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void invalidatePosCaches(queryClient, storeId, "presets");
    },
  });
}

/** Hard delete — safe for presets because an order only ever froze the discount AMOUNT, never a link to the preset. */
export function useDeleteDiscountPreset(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (id: string) =>
      apiClient.delete<{ id: string; deleted: true }>(`/stores/${storeId}/discount-presets/${id}`),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<DiscountPresetDto[]>(promotionKeys.presets(storeId), (rows) =>
        rows?.filter((row) => row.id !== id)
      );
      void invalidatePosCaches(queryClient, storeId, "presets");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.presets(storeId) });
    },
  });
}
