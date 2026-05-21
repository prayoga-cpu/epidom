"use client";

import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineQueue } from "../hooks/use-offline-queue";
import { useEffect, useState } from "react";

interface PosOfflineBannerProps {
  storeId: string;
}

export function PosOfflineBanner({ storeId }: PosOfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const { pendingCount, isSyncing, syncQueue } = useOfflineQueue(storeId);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        isOnline
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <CloudUpload className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <span>
          {!isOnline
            ? `Offline — pesanan disimpan lokal${pendingCount > 0 ? ` (${pendingCount} menunggu)` : ""}`
            : `${pendingCount} pesanan offline menunggu sinkronisasi`}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          onClick={syncQueue}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
        </Button>
      )}
    </div>
  );
}
