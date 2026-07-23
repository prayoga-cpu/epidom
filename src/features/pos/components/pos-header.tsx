"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { format } from "date-fns";
import { Wifi, WifiOff, LogOut, UserCircle2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Store } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePosSession } from "../hooks/use-pos-session";
import { usePosCart } from "../hooks/use-pos-cart";
import { useCurrency } from "@/components/providers/currency-provider";
import { toast } from "sonner";

interface PosHeaderProps {
  store: Pick<Store, "name">;
  /** Opens the mobile cart dialog — the cart button rendered here (mobile
   * only) doesn't own that dialog's state, since it lives in the sibling
   * PosMobileCart, one level up in PosShell. */
  onCartClick: () => void;
}

export function PosHeader({ store, onCartClick }: PosHeaderProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const cart = usePosCart();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const { staffName, staffRole, logout } = usePosSession();
  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

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
    <header className="bg-background flex h-14 items-center justify-between gap-2 border-b px-3 md:px-6">
      {/* Mobile (below md — the same breakpoint PosShell already switches
          the cart pane at): store name/connection/staff/sign-out all
          collapse into one profile menu on the left, freeing the right
          side for the cart button that used to float at the bottom of the
          screen. */}
      <div className="flex w-full items-center justify-between md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation"
              aria-label="Account menu"
            >
              <UserCircle2 className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{store.name}</span>
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <WifiOff className="text-destructive h-3.5 w-3.5 shrink-0" />
              )}
            </DropdownMenuLabel>
            {staffName && (
              <DropdownMenuLabel className="text-muted-foreground -mt-2 text-xs font-normal">
                {staffName}
                {staffRole && ` · ${staffRole}`}
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={onCartClick}
          size="sm"
          className="h-10 touch-manipulation gap-1.5 rounded-full px-3"
        >
          <ShoppingBag className="h-4 w-4" />
          {totalItems > 0 && <span className="font-semibold">{totalItems}</span>}
          {cart.total > 0 && <span className="font-bold">{formatPrice(cart.total)}</span>}
        </Button>
      </div>

      {/* Desktop (md and up): unchanged from before. */}
      <div className="hidden min-w-0 items-center gap-2 sm:gap-4 md:flex">
        <h1 className="truncate text-base font-semibold sm:text-lg">{store.name}</h1>
        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium sm:px-2.5 ${
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

      <div className="hidden shrink-0 items-center gap-2 sm:gap-4 md:flex">
        <div className="text-muted-foreground text-sm font-medium">
          {format(time, "dd MMM yyyy • HH:mm")}
        </div>

        {staffName && (
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <UserCircle2 className="h-3.5 w-3.5" />
              <span>{staffName}</span>
              {staffRole && <span className="text-primary/60">· {staffRole}</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-10 w-10 touch-manipulation"
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
