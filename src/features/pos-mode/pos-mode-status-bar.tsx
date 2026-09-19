"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, UserCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { PosPrinterMenu } from "@/features/pos/components/pos-printer-menu";
import { PosModeShiftChip } from "./pos-mode-shift-chip";

interface PosModeStatusBarProps {
  storeId: string;
  /**
   * Ref callback for the toolbar slot (see pos-mode-toolbar-slot.tsx): an empty
   * flex-1 region between the store name and the right-hand controls that /pos
   * fills with its search, filters, view toggle and scan button at ≥md. Left
   * empty on every other route, where it is just a spacer.
   */
  toolbarSlotRef?: (element: HTMLElement | null) => void;
}

/**
 * Persistent 44px strip above every POS Mode route — online status, shift
 * label, store name, staff badge, printer menu. Ports the desktop-branch content
 * pos-header.tsx used to render per-page; here it's shell-level so it
 * doesn't repaint between /pos, /pos/orders, /pos/kds, /tables.
 */
export function PosModeStatusBar({ storeId, toolbarSlotRef }: PosModeStatusBarProps) {
  const { t } = useI18n();
  const { store } = useCurrentStore();
  const { staffName, staffRole, openPicker } = usePosSession();
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

  const switchUserLabel = t("cashierCheckout.topBar.switchUser");

  return (
    <header className="bg-background flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {/* Store name text is dropped below lg to make room for the toolbar
            slot; sr-only (not hidden) keeps the page's <h1> for screen readers. */}
        <h1 className="sr-only truncate text-sm font-semibold lg:not-sr-only lg:max-w-[9rem] xl:max-w-[14rem]">
          {store?.name}
        </h1>
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
        <PosModeShiftChip storeId={storeId} />
      </div>

      {/* min-w-0 flex-1: this region takes whatever is left between the two
          groups and must be allowed to shrink below its content, or a long filter
          strip pushes the printer and staff buttons off the bar. Hidden below md,
          where /pos draws its own row instead. */}
      <div
        ref={toolbarSlotRef}
        data-testid="pos-toolbar-slot"
        className="hidden min-w-0 flex-1 items-center gap-2 md:flex"
      />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <PosPrinterMenu storeId={storeId} />
        {staffName && (
          // A real button, not a badge: on a shared till the cashier taps their own
          // name to hand over. Opens the same "Switch Account" picker as the
          // overflow menu (StoreAccessGate / PosStaffGate read `pickerOpen`), with
          // the current session left intact underneath so backing out is free.
          <button
            type="button"
            onClick={openPicker}
            title={switchUserLabel}
            className="bg-primary/10 text-primary hover:bg-primary/15 flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors"
          >
            <UserCircle2 className="h-4 w-4" />
            <span className="sr-only">{switchUserLabel}: </span>
            <span className="max-w-[6rem] truncate lg:max-w-[8rem]">{staffName}</span>
            {staffRole && <span className="text-primary/60 hidden xl:inline">· {staffRole}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
