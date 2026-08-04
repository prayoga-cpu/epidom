import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaymentMethod } from "@prisma/client";
import type { PaymentFeeRate } from "@/config/payment-fees.config";

export interface FinanceSettingsFields {
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

export interface FinanceSettingsData extends FinanceSettingsFields {
  storeId: string;
  /** True when this store follows BusinessFinanceSettings instead of its own row. */
  syncFinanceWithBusiness: boolean;
  /** Owner-only toggle for the "Pay Later" checkout option — always store-specific, never synced. */
  payLaterEnabled: boolean;
}

export interface BusinessFinanceSettingsData extends FinanceSettingsFields {
  businessId: string;
}

interface UpdateFinanceSettingsFields {
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  taxInclusive?: boolean;
  serviceChargeEnabled?: boolean;
  serviceChargeRate?: number;
  processingFeeEnabled?: boolean;
  processingFeeOverrides?: Partial<Record<PaymentMethod, PaymentFeeRate>>;
}

export type UpdateFinanceSettingsPayload = UpdateFinanceSettingsFields & {
  syncFinanceWithBusiness?: boolean;
  payLaterEnabled?: boolean;
};

export type UpdateBusinessFinanceSettingsPayload = UpdateFinanceSettingsFields;

async function parseFinanceSettingsResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || fallbackMessage);
  }
  return result.data as T;
}

const fetchFinanceSettings = async (storeId: string): Promise<FinanceSettingsData> => {
  const response = await fetch(`/api/stores/${storeId}/finance/settings`);
  return parseFinanceSettingsResponse<FinanceSettingsData>(
    response,
    "Failed to fetch finance settings"
  );
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
  return parseFinanceSettingsResponse<FinanceSettingsData>(
    response,
    "Failed to update finance settings"
  );
};

const updateBusinessFinanceSettingsRequest = async (
  payload: UpdateBusinessFinanceSettingsPayload
): Promise<BusinessFinanceSettingsData> => {
  const response = await fetch("/api/user/business/finance-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseFinanceSettingsResponse<BusinessFinanceSettingsData>(
    response,
    "Failed to update business finance settings"
  );
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

export const useUpdateBusinessFinanceSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBusinessFinanceSettingsRequest,
    onSuccess: async () => {
      // Every store reads its effective values through ["finance-settings", storeId] —
      // synced stores resolve from this same business config, so invalidate both.
      await queryClient.invalidateQueries({ queryKey: ["finance-settings"] });
    },
  });
};
