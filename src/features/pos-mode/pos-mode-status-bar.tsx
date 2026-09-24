"use client";

import { useEffect, useState } from "react";
import { Menu, Wifi, WifiOff, UserCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { PosPrinterMenu } from "@/features/pos/components/pos-printer-menu";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
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
  /** Opens PosModeOverflowMenu — the Epidom-mark button at the bar's right edge. */
  onOverflowClick?: () => void;
}

/**
 * Persistent 44px strip above every POS Mode route — online status, shift
 * label, store name, printer menu, staff badge, "More" menu. Ports the desktop-branch content
 * pos-header.tsx used to render per-page; here it's shell-level so it
 * doesn't repaint between /pos, /pos/orders, /pos/kds, /tables.
 */
export function PosModeStatusBar({
  storeId,
  toolbarSlotRef,
  onOverflowClick,
}: PosModeStatusBarProps) {
  const { t } = useI18n();
  const { store } = useCurrentStore();
  const { staffName, openPicker } = usePosSession();
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
    // No right padding: the "More" button below runs edge to edge, so it can sit
    // flush against the right side (and the full height) of the bar.
    //
    // Deliberately NO `items-center`: a flex row's default alignment stretches every
    // child to the bar's full height, which is what lets the search field and the
    // staff button run edge to edge with no gap above or below. (An earlier version
    // kept items-center and re-stretched each child with `self-stretch` — a utility
    // no other file used, so a browser holding an older stylesheet never got the rule
    // and the controls floated ~3px off the top and bottom.) Anything that should sit
    // in the MIDDLE of the bar centers itself — see the left group below.
    <header className="bg-background flex h-11 shrink-0 gap-2 border-b pl-3">
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
          where /pos draws its own row instead. Stretched by the bar's default
          alignment (and stretching its own children the same way), so /pos's search
          field fills the bar edge to edge instead of floating with a margin. */}
      <div
        ref={toolbarSlotRef}
        data-testid="pos-toolbar-slot"
        className="hidden min-w-0 flex-1 gap-2 md:flex"
      />

      {/* min-w-0 (not shrink-0): on a narrow phone with a long staff name the four
          controls don't fit, and the name truncates instead of pushing the More
          button off-screen. The printer and More buttons keep their width. */}
      <div className="ml-auto flex min-w-0 gap-2">
        <PosPrinterMenu storeId={storeId} />
        {/* No gap inside: the staff badge and the More button read as one block. */}
        <div className="flex min-w-0">
          {staffName && (
            // A real button, not a badge: on a shared till the cashier taps their own
            // name to hand over. Opens the same "Switch Account" picker as the
            // overflow menu (StoreAccessGate / PosStaffGate read `pickerOpen`), with
            // the current session left intact underneath so backing out is free.
            // Square and full-height — no fixed height, so the group's default stretch
            // fills the bar (min-h-10 keeps the 40px touch floor): a block that ends
            // at the bar's edges, not a pill inside it.
            <button
              type="button"
              onClick={openPicker}
              title={switchUserLabel}
              className="bg-primary/10 text-primary hover:bg-primary/15 flex min-h-10 min-w-0 cursor-pointer touch-manipulation items-center gap-1.5 rounded-none px-4 text-xs font-medium transition-colors"
            >
              <UserCircle2 className="h-4 w-4 shrink-0" />
              <span className="sr-only">{switchUserLabel}: </span>
              {/* Name only — the role repeated what the name usually already says
                ("Owner · OWNER"), and the More menu still shows it. */}
              <span className="max-w-[6rem] truncate lg:max-w-[8rem]">{staffName}</span>
            </button>
          )}
          {onOverflowClick && (
            // Was the last tab of the bottom bar. The Epidom mark stands in for a
            // "More" label, and the hamburger beside it says the mark opens a menu;
            // aria-label still names it for screen readers. Full-height like the
            // printer button.
            <button
              type="button"
              onClick={onOverflowClick}
              aria-label={t("common.actions.more")}
              className="hover:bg-muted flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-none px-2 transition-colors active:scale-[0.97]"
            >
              <EpidomMark size={32} />
              <Menu className="text-muted-foreground h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
