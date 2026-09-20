"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Store } from "@prisma/client";
import { PosHeader } from "./pos-header";
import { PosCategoryBar } from "./pos-category-bar";
import { PosDepartmentBar } from "./pos-department-bar";
import { PosItemGrid } from "./pos-item-grid";
import { PosCart } from "./pos-cart";
import { PosMobileCart } from "./pos-mobile-cart";
import { PosOfflineBanner } from "./pos-offline-banner";
import { PosUnpaidAlert } from "./pos-unpaid-alert";
import { AddFilterMenu } from "./add-filter-menu";
import { RemovableFilter } from "./removable-filter";
import { PosViewToggle } from "./pos-view-toggle";
import { PosScannerMenu } from "./pos-scanner-menu";
import { usePosMenu } from "../hooks/use-pos-menu";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosOrders } from "../hooks/use-pos-orders";
import { usePosViewMode } from "../hooks/use-pos-view-mode";
import { useBarcodeScanner } from "../hooks/use-barcode-scanner";
import { SCANNER_SPEED_GAP_MS, usePosScannerSettings } from "../hooks/use-pos-scanner-settings";
import { useCustomerDisplayPublisher } from "../hooks/use-customer-display";
import { findItemByBarcode } from "../lib/barcode";
import { usePosModeToolbarSlot } from "@/features/pos-mode/pos-mode-toolbar-slot";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/providers/currency-provider";
import { MenuItemOptionsDialog } from "@/components/shared/menu-item-options-dialog";
import { getMergedOptionGroups } from "@/lib/utils/menu-item-options";
import type { PosMenuItem } from "../types/pos.types";

// Hidden by default behind "+ Add filter" — same Notion-chip pattern as the
// order queue/history toolbars, so the search bar isn't crowded with
// dimensions the cashier isn't actively narrowing by.
const POS_FILTER_KEYS = ["department", "category"] as const;
type PosFilterKey = (typeof POS_FILTER_KEYS)[number];

/** Tailwind's `md` breakpoint — where the toolbar moves up into the status bar. */
const MD_MIN_WIDTH_PX = 768;

/**
 * Viewport-width media query as external state. The server snapshot is false so
 * SSR and the first client render agree; the real value lands right after
 * mount. Uses the same media query Tailwind's `md:` classes do, so the JS
 * switch below and the CSS visibility classes can never disagree.
 */
function useMinWidth(minPx: number): boolean {
  const query = `(min-width: ${minPx}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

interface PosShellProps {
  store: Pick<Store, "id" | "name">;
}

export function PosShell({ store }: PosShellProps) {
  const { t } = useI18n();
  // Menu item/modifier prices are literal in the store's display currency,
  // never IDR — passing `currency` skips formatPrice's default base-currency
  // conversion. See pos-order-builder.ts.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<"KITCHEN" | "BAR" | "CUSTOM" | null>(
    null
  );
  const [activeFilterKeys, setActiveFilterKeys] = useState<PosFilterKey[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<PosMenuItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const viewMode = usePosViewMode((s) => s.viewMode);
  const cart = usePosCart();
  // Mirrors this cart onto the customer-facing display window (second
  // screen), if one is open. No-op when it isn't — the snapshot is just
  // written and broadcast with nobody listening.
  useCustomerDisplayPublisher(store.id);

  const { data: menuData, isLoading } = usePosMenu(store.id);
  const { data: orders } = usePosOrders(store.id);
  const unpaidCount = orders?.filter((o) => o.paymentStatus === "PENDING").length ?? 0;
  const categoryNames = menuData?.categories.map((c: any) => c.name) ?? [];

  const addFilter = (key: PosFilterKey) => {
    setActiveFilterKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeFilter = (key: PosFilterKey) => {
    setActiveFilterKeys((prev) => prev.filter((k) => k !== key));
    if (key === "department") setSelectedDepartment(null);
    if (key === "category") setSelectedCategory(null);
  };

  const handleItemClick = (item: PosMenuItem) => {
    const groups = getMergedOptionGroups(item, item.product);
    if (groups.length === 0) {
      cart.addItem(item.id, item.name, item.price, 1, [], item.imageUrl);
      return;
    }
    setConfiguringItem(item);
  };

  /**
   * Adds the item whose barcode is EXACTLY `code`, the same way tapping its tile
   * would (so an item with option groups opens its options dialog). Returns
   * whether the code matched a product — false leaves the caller to treat it as
   * ordinary search text or a scan miss.
   */
  const addByBarcode = (code: string): boolean => {
    const item = findItemByBarcode(menuData?.categories ?? [], code);
    if (!item) return false;

    if (!item.isAvailable) {
      // A tap on an unavailable tile does nothing; a scan says why instead.
      toast.error(t("cashierCheckout.scan.unavailable").replace("{name}", item.name));
      return true;
    }
    const needsOptions = getMergedOptionGroups(item, item.product).length > 0;
    handleItemClick(item);
    // The options dialog opening is its own feedback; only confirm a direct add.
    if (!needsOptions) {
      toast.success(t("cashierCheckout.scan.added").replace("{name}", item.name), {
        duration: 1500,
      });
    }
    return true;
  };

  // A scanner aimed at the page rather than the search box (focus on a tile, or
  // nowhere). Scans that land in a text field are that field's business — the
  // search box handles its own Enter below.
  const scannerEnabled = usePosScannerSettings((s) => s.enabled);
  const scannerSpeed = usePosScannerSettings((s) => s.speed);
  useBarcodeScanner({
    onScan: (code) => {
      if (!addByBarcode(code)) toast.error(t("cashierCheckout.scan.noMatch"));
    },
    enabled: scannerEnabled,
    maxGapMs: SCANNER_SPEED_GAP_MS[scannerSpeed],
  });

  const toolbarSlot = usePosModeToolbarSlot();
  const isMd = useMinWidth(MD_MIN_WIDTH_PX);
  // At ≥md the search (with its scan button) and filters live in the shell's
  // status bar (one 44px row for the whole screen); below md they get a row of
  // their own here, as before. The view toggle is in neither: it belongs to the
  // menu container (see PosItemGrid's `toolbar`). `portalTarget` is null until
  // the bar has mounted its slot.
  const portalTarget = toolbarSlot.available && isMd ? toolbarSlot.element : null;

  const renderToolbar = (variant: "inline" | "bar") => (
    <>
      <div
        className={cn(
          "relative",
          variant === "bar" ? "w-44 shrink-0 lg:w-64" : "min-w-[9rem] flex-1 sm:max-w-xs"
        )}
      >
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={searchRef}
          type="search"
          placeholder={t("pos.menu.search")}
          // Inline: h-10, not the Input default's h-9 — a 40px tap target (AGENTS.md
          // touch floor). In the status bar it is a flat block instead: the bar's
          // full height, square, no border, no margin. The tint stands in for the
          // border so it still reads as a field in light mode, and the focus ring
          // goes inset — an outer ring would be clipped by the bar's top edge.
          // pr-11 leaves room for the scanner button that sits inside the box.
          className={cn(
            "pr-11 pl-9",
            variant === "bar"
              ? "bg-muted/40 h-full rounded-none border-0 shadow-none focus-visible:ring-2 focus-visible:ring-inset"
              : "h-10"
          )}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Read the DOM value, not state: a scanner's keys arrive faster than a
            // re-render, and Enter must see the whole code.
            const value = e.currentTarget.value.trim();
            if (!value) return;
            // Only an EXACT barcode hit adds an item; anything else is left alone
            // as an ordinary name search.
            if (addByBarcode(value)) {
              e.preventDefault();
              setSearchQuery("");
            }
          }}
        />
        {/* Hardware scanners type into whatever has focus; this opens the panel to
            test the scanner and tune how the till listens for it. */}
        <PosScannerMenu
          categories={menuData?.categories ?? []}
          // Same flat, full-height block as the search field it sits in.
          className={variant === "bar" ? "h-full rounded-none" : undefined}
        />
      </div>

      {/* Filters sit beside the search bar and scroll horizontally
          as a single strip instead of wrapping — the search input
          keeps its width, this row absorbs the overflow. On a phone the strip
          drops to a line of its own (basis-full) rather than being squeezed to
          nothing between the search box and the buttons. */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 overflow-x-auto",
          variant === "bar" ? "flex-1" : "basis-full sm:flex-1 sm:basis-auto"
        )}
      >
        {activeFilterKeys.includes("department") && (
          <RemovableFilter onRemove={() => removeFilter("department")}>
            <PosDepartmentBar
              selectedDepartment={selectedDepartment}
              onSelectDepartment={setSelectedDepartment}
              customDepartmentLabel={
                menuData?.customProductsEnabled ? menuData.customProductsLabel : null
              }
            />
          </RemovableFilter>
        )}
        {activeFilterKeys.includes("category") && categoryNames.length > 0 && (
          <RemovableFilter onRemove={() => removeFilter("category")}>
            <PosCategoryBar
              categories={categoryNames}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </RemovableFilter>
        )}
        <AddFilterMenu
          options={POS_FILTER_KEYS.filter(
            (k) => !activeFilterKeys.includes(k) && (k !== "category" || categoryNames.length > 0)
          ).map((k) => ({ key: k, label: t(`pos.filters.${k}`) }))}
          onAdd={(k) => addFilter(k as PosFilterKey)}
          // In the top bar it is a flat ghost block as tall as the bar, like the search
          // field beside it (its "bar" variant uses h-full: the strip it sits in is a
          // stretched flex child, so that height is definite — no stretch utility
          // needed). The phone-width row below md keeps the dashed chip the other
          // filter rows use.
          variant={variant === "bar" ? "bar" : "chip"}
        />
      </div>
    </>
  );

  return (
    <>
      {/* flex-1 min-h-0 (not a hardcoded h-[calc(100vh-Npx)]): PosModeShell
          gives /pos's wrapper a genuinely definite height so this can
          resolve its flex-basis:0 growth against it exactly, edge to edge,
          without needing to guess the surrounding chrome's pixel total.
          min-h-0 lets it shrink below its content's natural size so
          overflow-hidden below can actually clip instead of growing past
          the available space. */}
      <div className="bg-muted/10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <PosHeader onCartClick={() => setMobileCartOpen(true)} />
        <PosOfflineBanner />
        <PosUnpaidAlert storeId={store.id} unpaidCount={unpaidCount} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left pane: Menu Grid. min-w-0 stops this pane's content from
              refusing to shrink below its natural width (the flex-item
              default) and squeezing the fixed-width cart pane next to it. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {portalTarget ? (
              createPortal(renderToolbar("bar"), portalTarget)
            ) : (
              // Hidden by CSS at ≥md ONLY when a status-bar slot exists to take
              // over (the frame before it mounts its node would otherwise show
              // both); without a PosModeShell there is no slot, so this row stays.
              <div
                className={cn(
                  "bg-background flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2",
                  toolbarSlot.available && "md:hidden"
                )}
              >
                {renderToolbar("inline")}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <PosItemGrid
                categories={menuData?.categories ?? []}
                selectedCategory={selectedCategory}
                selectedDepartment={selectedDepartment}
                searchQuery={searchQuery}
                onItemClick={handleItemClick}
                viewMode={viewMode}
                toolbar={<PosViewToggle />}
                customDepartmentLabel={
                  menuData?.customProductsEnabled ? menuData.customProductsLabel : null
                }
              />
            )}
          </div>

          {/* Right pane: Cart. shrink-0 guarantees this pane keeps its
              fixed w-80/lg:w-96 width rather than being compressed if the
              menu pane's content pushes total width past what's available. */}
          <div className="z-10 hidden min-h-0 w-80 shrink-0 flex-col border-l shadow-xl md:flex lg:w-96">
            <PosCart storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <PosMobileCart store={store} open={mobileCartOpen} onOpenChange={setMobileCartOpen} />

        {configuringItem && (
          <MenuItemOptionsDialog
            open={!!configuringItem}
            onOpenChange={(open) => !open && setConfiguringItem(null)}
            itemName={configuringItem.name}
            groups={getMergedOptionGroups(configuringItem, configuringItem.product)}
            formatPrice={formatPrice}
            onConfirm={({ selectedOptions, notes }) => {
              cart.addItem(
                configuringItem.id,
                configuringItem.name,
                configuringItem.price,
                1,
                selectedOptions,
                configuringItem.imageUrl,
                notes
              );
              setConfiguringItem(null);
            }}
          />
        )}
      </div>
    </>
  );
}
