"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CustomerDisplaySettingsValues } from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import {
  customerDisplayChannelName,
  type CustomerDisplayMessage,
} from "../lib/customer-display";

/** How often an open display re-reads its look and banners. A screen stays
 * open all day, and the owner usually edits from another device, so nothing
 * else would ever tell it. Small payload; a couple of minutes is plenty. */
export const CUSTOMER_DISPLAY_CONFIG_POLL_MS = 2 * 60_000;

const endpoint = (storeId: string) => `/stores/${storeId}/customer-display`;

/**
 * Display side. Starts from the server-rendered config and keeps it current:
 * a poll, a refetch when the screen becomes visible again, and an immediate
 * refetch when the Store Dashboard on this same device saves. Plain fetches
 * rather than TanStack Query: the display is a standalone window, and a
 * failed fetch (offline, signed out) must keep the last good config on screen,
 * never blank it.
 */
export function useLiveCustomerDisplayConfig(
  storeId: string,
  initial: CustomerDisplayConfig
): CustomerDisplayConfig {
  const [config, setConfig] = useState(initial);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      lastFetchRef.current = Date.now();
      try {
        const next = await apiClient.get<CustomerDisplayConfig>(endpoint(storeId));
        if (!cancelled && next?.settings && next.branding) setConfig(next);
      } catch {
        // Keep showing the last good config.
      }
    };

    const timer = setInterval(refresh, CUSTOMER_DISPLAY_CONFIG_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current > 60_000) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(customerDisplayChannelName(storeId));
      channel.addEventListener("message", (event: MessageEvent<CustomerDisplayMessage>) => {
        if (event.data?.type === "config-updated") void refresh();
      });
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [storeId]);

  return config;
}

/** Tells a display open on this device that its config changed. */
export function broadcastCustomerDisplayConfigUpdated(storeId: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
  channel.postMessage({ type: "config-updated" } satisfies CustomerDisplayMessage);
  channel.close();
}

/** Store Dashboard side: the editor's copy of the config. */
export function useCustomerDisplayConfig(storeId: string) {
  return useQuery({
    queryKey: ["customer-display-config", storeId],
    queryFn: () => apiClient.get<CustomerDisplayConfig>(endpoint(storeId)),
    staleTime: 60_000,
  });
}

export function useSaveCustomerDisplayConfig(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerDisplaySettingsValues) =>
      apiClient.put<CustomerDisplayConfig>(endpoint(storeId), values),
    onSuccess: (config) => {
      queryClient.setQueryData(["customer-display-config", storeId], config);
      broadcastCustomerDisplayConfigUpdated(storeId);
    },
  });
}
