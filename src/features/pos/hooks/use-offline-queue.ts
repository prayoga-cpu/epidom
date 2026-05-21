"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listQueue,
  removeFromQueue,
  incrementAttempts,
  queueSize,
  type OfflineOrder,
} from "@/lib/pwa/offline-queue";
import { apiClient } from "@/lib/api/client";

const MAX_ATTEMPTS = 5;

export function useOfflineQueue(storeId: string) {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const n = await queueSize();
    setPendingCount(n);
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing) return;
    const queue = await listQueue();
    const mine = queue.filter((e) => e.storeId === storeId);
    if (mine.length === 0) return;

    setIsSyncing(true);
    let synced = 0;

    for (const entry of mine) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        await removeFromQueue(entry.id);
        continue;
      }

      try {
        await apiClient.post(`/stores/${storeId}/pos/orders`, entry.order);
        await removeFromQueue(entry.id);
        synced++;
      } catch {
        await incrementAttempts(entry);
      }
    }

    setIsSyncing(false);
    await refreshCount();

    if (synced > 0) {
      toast.success(`${synced} pesanan offline berhasil disinkronkan`);
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
    }
  }, [isSyncing, storeId, queryClient, refreshCount]);

  // Sync on initial mount (catches page reloads after reconnect)
  useEffect(() => {
    refreshCount();
    if (navigator.onLine) syncQueue();
  }, [refreshCount, syncQueue]);

  // Sync whenever the browser regains connectivity
  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncQueue]);

  return { pendingCount, isSyncing, syncQueue, refreshCount };
}
