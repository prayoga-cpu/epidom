import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ReceiptSettingsData {
  storeId: string;
  storeName: string;
  tagline: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  facebookHandle: string | null;
  footerMessage: string | null;
  showSocialLinks: boolean;
  autoSendWhatsappReceipt: boolean;
}

export interface UpdateReceiptSettingsPayload {
  footerMessage?: string;
  facebookUrl?: string;
  showSocialLinks?: boolean;
  autoSendWhatsappReceipt?: boolean;
}

async function parseReceiptSettingsResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || fallbackMessage);
  }
  return result.data as T;
}

const fetchReceiptSettings = async (storeId: string): Promise<ReceiptSettingsData> => {
  const response = await fetch(`/api/stores/${storeId}/receipt-settings`);
  return parseReceiptSettingsResponse<ReceiptSettingsData>(
    response,
    "Failed to fetch receipt settings"
  );
};

const updateReceiptSettingsRequest = async (
  storeId: string,
  payload: UpdateReceiptSettingsPayload
): Promise<ReceiptSettingsData> => {
  const response = await fetch(`/api/stores/${storeId}/receipt-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseReceiptSettingsResponse<ReceiptSettingsData>(
    response,
    "Failed to update receipt settings"
  );
};

export const useReceiptSettings = (storeId: string | undefined) => {
  return useQuery<ReceiptSettingsData>({
    queryKey: ["receipt-settings", storeId],
    queryFn: () => fetchReceiptSettings(storeId!),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useUpdateReceiptSettings = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateReceiptSettingsPayload) =>
      updateReceiptSettingsRequest(storeId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receipt-settings", storeId] });
    },
  });
};
