import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaymentMethod } from "@prisma/client";
import type { PaymentFeeRate } from "@/config/payment-fees.config";

export interface FinanceSettingsData {
  storeId: string;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string | null;
  taxInclusive: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  processingFeeEnabled: boolean;
  processingFeeOverrides: Partial<Record<PaymentMethod, PaymentFeeRate>> | null;
  feeRates: Record<PaymentMethod, PaymentFeeRate>;
}

export interface UpdateFinanceSettingsPayload {
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  taxInclusive?: boolean;
  serviceChargeEnabled?: boolean;
  serviceChargeRate?: number;
  processingFeeEnabled?: boolean;
  processingFeeOverrides?: Partial<Record<PaymentMethod, PaymentFeeRate>>;
}

const fetchFinanceSettings = async (storeId: string): Promise<FinanceSettingsData> => {
  const response = await fetch(`/api/stores/${storeId}/finance/settings`);
  if (!response.ok) {
    throw new Error("Failed to fetch finance settings");
  }
  const result = await response.json();
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error(result.error?.message || "Failed to fetch finance settings");
};

const updateFinanceSettingsRequest = async (
  storeId: string,
  payload: UpdateFinanceSettingsPayload
): Promise<FinanceSettingsData> => {
  const response = await fetch(`/api/stores/${storeId}/finance/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to update finance settings");
  }
  const result = await response.json();
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error(result.error?.message || "Failed to update finance settings");
};

export const useFinanceSettings = (storeId: string | undefined) => {
  return useQuery<FinanceSettingsData>({
    queryKey: ["finance-settings", storeId],
    queryFn: () => fetchFinanceSettings(storeId!),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useUpdateFinanceSettings = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateFinanceSettingsPayload) =>
      updateFinanceSettingsRequest(storeId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance-settings", storeId] });
    },
  });
};
