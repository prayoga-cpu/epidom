import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || "Request failed");
  }
  return json.data as T;
}

export const useOwnerPinStatus = () => {
  return useQuery({
    queryKey: ["owner-pin-status"],
    queryFn: () => requestJson<{ hasPin: boolean }>("/api/user/owner-pin"),
    staleTime: 60 * 1000,
  });
};

export const useSetOwnerPin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) =>
      requestJson<{ hasPin: boolean }>("/api/user/owner-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-pin-status"] }),
  });
};

export const useRequestOwnerPinOtp = () => {
  return useMutation({
    mutationFn: () =>
      requestJson<{ sent: boolean; email: string }>("/api/user/owner-pin/request-otp", {
        method: "POST",
      }),
  });
};

export const useResetOwnerPin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { otp: string; newPin: string }) =>
      requestJson<{ hasPin: boolean }>("/api/user/owner-pin/reset", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-pin-status"] }),
  });
};
