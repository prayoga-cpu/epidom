"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, UserCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { PosPrinterMenu } from "@/features/pos/components/pos-printer-menu";

interface PosModeStatusBarProps {
  storeId: string;
}

/**
 * Persistent 44px strip above every POS Mode route — online status, store
 * name, staff badge, printer menu. Ports the desktop-branch content
 * pos-header.tsx used to render per-page; here it's shell-level so it
 * doesn't repaint between /pos, /pos/orders, /pos/kds, /tables.
 */
export function PosModeStatusBar({ storeId }: PosModeStatusBarProps) {
  const { t } = useI18n();
  const { store } = useCurrentStore();
  const { staffName, staffRole } = usePosSession();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <header className="bg-background flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold">{store?.name}</h1>
        <div
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">{t("pos.connection.online")}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">{t("pos.connection.offline")}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PosPrinterMenu storeId={storeId} />
        {staffName && (
          <div className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <UserCircle2 className="h-3.5 w-3.5" />
            <span className="max-w-[8rem] truncate">{staffName}</span>
            {staffRole && <span className="hidden text-primary/60 sm:inline">· {staffRole}</span>}
          </div>
        )}
      </div>
    </header>
  );
}
