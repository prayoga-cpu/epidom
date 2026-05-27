"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { format } from "date-fns";
import { Wifi, WifiOff, LogOut, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Store } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { usePosSession } from "../hooks/use-pos-session";
import { toast } from "sonner";

interface PosHeaderProps {
  store: Pick<Store, "name">;
}

export function PosHeader({ store }: PosHeaderProps) {
  const { t } = useI18n();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const { staffName, staffRole, logout } = usePosSession();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleLogout = () => {
    logout();
    toast.info("Staff session ended.");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{store.name}</h1>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("pos.connection.online")}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("pos.connection.offline")}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-muted-foreground">
          {format(time, "dd MMM yyyy • HH:mm")}
        </div>

        {staffName && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <UserCircle2 className="h-3.5 w-3.5" />
              <span>{staffName}</span>
              {staffRole && (
                <span className="text-primary/60">· {staffRole}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              title="Switch staff"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
