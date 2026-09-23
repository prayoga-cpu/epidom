"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useOnlineStatus } from "@/hooks/use-network-status";
import type { PosMenuItem, PosMenuCategory } from "../types/pos.types";
import type { PosViewMode } from "../hooks/use-pos-view-mode";
import { useCurrency } from "@/components/providers/currency-provider";
import { UNCATEGORIZED_CATEGORY } from "@/lib/constants/pos";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import Image from "next/image";

interface PosItemGridProps {
  categories: PosMenuCategory[];
  selectedCategory: string | null;
  selectedDepartment?: "KITCHEN" | "BAR" | "CUSTOM" | null;
  onItemClick: (item: PosMenuItem) => void;
  searchQuery: string;
  /** Heading for the optional second product line's own section (e.g. "Hair
   * Salon"). Null/absent when the store doesn't run one. */
  customDepartmentLabel?: string | null;
  /** grid = image tiles (default), columns = compact text tiles, list = one row per item. */
  viewMode?: PosViewMode;
  /** Controls for the menu itself (the view switch). They float over the top-right
   * of the menu — no row of their own, and they stay put while it scrolls. */
  toolbar?: ReactNode;
}

export function PosItemGrid({
  categories,
  selectedCategory,
  selectedDepartment = null,
  onItemClick,
  searchQuery,
  customDepartmentLabel,
  viewMode = "grid",
  toolbar,
}: PosItemGridProps) {
  const { t } = useI18n();
  // The counted-stock chip is suppressed offline: the POS menu IS mirrored to
  // IndexedDB, but Product.currentStock is not, so a disconnected tablet would
  // render an hours-old count as if it were authoritative.
  const isOnline = useOnlineStatus();
  // Menu item prices are literal in the store's display currency, never
  // IDR — passing `currency` skips formatPrice's default base-currency
  // conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const query = searchQuery.toLowerCase();
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          (selectedCategory === null || cat.name === selectedCategory) &&
          (selectedDepartment === null || item.department === selectedDepartment) &&
          // A barcode typed (or partly typed) into the search box narrows to its
          // product too — Enter then adds an exact match (see PosShell).
          (item.name.toLowerCase().includes(query) ||
            (!!query && !!item.barcode && item.barcode.toLowerCase().includes(query)))
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  // The optional second product line (Product.productLine, tagged
  // department: "CUSTOM" server-side) gets its own visually distinct block
  // below the regular menu rather than sitting among the food/drink
  // categories — it's a different kind of offering, and reading as just
  // another category is what the merchant flagged.
  const standardCategories: typeof filteredCategories = [];
  const customCategories: typeof filteredCategories = [];
  for (const category of filteredCategories) {
    const customItems = category.items.filter((i) => i.department === "CUSTOM");
    const standardItems = category.items.filter((i) => i.department !== "CUSTOM");
    if (standardItems.length > 0) standardCategories.push({ ...category, items: standardItems });
    if (customItems.length > 0) customCategories.push({ ...category, items: customItems });
  }

  if (filteredCategories.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center">
        <p>{t("pos.menu.noItems")}</p>
      </div>
    );
  }

  // Counted finished goods, for batch-produced items only. Deliberately
  // labelled "counted", never "available": at 0 the item is still perfectly
  // sellable — the kitchen makes it fresh and the ingredients come out at that
  // point. The tile stays fully tappable; this is a hint, never a gate.
  // Suppressed while offline, where the number would be an hours-old figure
  // rendered as if it were authoritative.
  const countedChip = (item: PosMenuItem, className?: string) =>
    item.countedStock !== undefined && isOnline ? (
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          item.countedStock <= 0 ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          className
        )}
      >
        {t("pos.menu.counted").replace("{count}", String(item.countedStock))}
      </span>
    ) : null;

  const unavailablePill = (
    <span className="bg-destructive text-destructive-foreground rounded-md px-1.5 py-0.5 text-[10px] font-bold">
      {t("pos.menu.unavailable")}
    </span>
  );

  // The three layouts share everything but the tile itself. All of them are one
  // <button> per item, at least 48px tall in list view and 72px in columns — well
  // clear of the 40px touch floor.
  const renderTile = (item: PosMenuItem) => {
    if (viewMode === "list") {
      return (
        <button
          key={item.id}
          disabled={!item.isAvailable}
          onClick={() => onItemClick(item)}
          className={cn(
            "group bg-card hover:border-primary/50 focus-visible:ring-primary flex min-h-14 touch-manipulation items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
            !item.isAvailable && "opacity-50 grayscale"
          )}
        >
          <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
            {item.imageUrl && (
              <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="40px" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <h3 className="w-full truncate font-medium">{item.name}</h3>
            {(countedChip(item) || !item.isAvailable) && (
              <div className="flex items-center gap-1.5">
                {countedChip(item)}
                {!item.isAvailable && unavailablePill}
              </div>
            )}
          </div>
          <div className="text-primary shrink-0 text-sm font-semibold tabular-nums">
            {formatPrice(item.price)}
          </div>
        </button>
      );
    }

    if (viewMode === "columns") {
      return (
        <button
          key={item.id}
          disabled={!item.isAvailable}
          onClick={() => onItemClick(item)}
          className={cn(
            "group bg-card hover:border-primary/50 focus-visible:ring-primary flex min-h-[72px] touch-manipulation flex-col justify-between gap-1.5 rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
            !item.isAvailable && "opacity-50 grayscale"
          )}
        >
          <h3 className="line-clamp-2 text-sm leading-tight font-medium">{item.name}</h3>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-primary text-sm font-semibold tabular-nums">
              {formatPrice(item.price)}
            </span>
            {countedChip(item)}
            {!item.isAvailable && unavailablePill}
          </div>
        </button>
      );
    }

    return (
      <button
        key={item.id}
        disabled={!item.isAvailable}
        onClick={() => onItemClick(item)}
        // border stays at every size (not sm:border-only): with
        // zero gap between tiles on mobile, a border is the only
        // thing marking where one tappable tile ends and the next
        // begins — without it, text-only tiles (no image) have no
        // visible boundary at all. Rounded corners still wait for
        // sm: — square borders read as a clean grid at zero gap.
        className={`group bg-card hover:border-primary/50 focus-visible:ring-primary relative flex h-full min-h-[120px] flex-col overflow-hidden border text-left transition-all focus-visible:ring-2 focus-visible:outline-none sm:rounded-xl sm:hover:shadow-md ${
          !item.isAvailable ? "opacity-50 grayscale" : ""
        }`}
      >
        {item.imageUrl && (
          <div className="bg-muted relative h-32 w-full shrink-0 overflow-hidden">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between p-1 sm:p-3">
          <div>
            <h3 className="line-clamp-2 leading-tight font-medium">{item.name}</h3>
            {item.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-snug">
                {item.description}
              </p>
            )}
          </div>
          <div className="text-primary mt-2 text-sm font-semibold">{formatPrice(item.price)}</div>
        </div>
        {countedChip(item, "absolute top-1.5 right-1.5")}
        {!item.isAvailable && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs font-bold">
              {t("pos.menu.unavailable")}
            </span>
          </div>
        )}
      </button>
    );
  };

  const itemsLayoutClass =
    viewMode === "list"
      ? "flex flex-col gap-2"
      : viewMode === "columns"
        ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        : "grid grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5";

  const renderCategory = (category: (typeof filteredCategories)[number]) => (
    <div key={category.name} className="mb-6 last:mb-0 sm:mb-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight sm:mb-4">
        {category.name === UNCATEGORIZED_CATEGORY ? t("common.uncategorized") : category.name}
      </h2>
      <div className={itemsLayoutClass}>{category.items.map(renderTile)}</div>
    </div>
  );

  return (
    // pt-2 (not p-2) on mobile: only top spacing below the search/category
    // bar is needed — no left/right container padding in grid view, so tiles
    // run to the actual screen edge. Columns and list keep a small gutter, since
    // their tiles are rounded cards. pb-24 stays regardless of breakpoint: that's
    // functional clearance for the floating cart bar, not decorative padding.
    <div
      data-view-mode={viewMode}
      className={cn(
        "min-h-0 flex-1 overflow-auto pt-2 pb-24 sm:p-4 lg:pb-4",
        viewMode !== "grid" && "px-2"
      )}
    >
      {toolbar && (
        // Floats instead of taking a row: a ZERO-height sticky strip (so it costs no
        // layout space and stays pinned while the menu scrolls beneath it) whose
        // contents overflow downward — items-start stops the flex row stretching
        // them down to nothing. top-0, not a padding-sized offset: a sticky `top`
        // is measured from INSIDE this container's padding, so 0 already lands it
        // on the container's own top gutter (pt-2 / sm:p-4), level with the first
        // heading, and it never shifts once you scroll. Grid view has no side
        // gutter on a phone (tiles run to the screen edge), so it brings its own;
        // the other views already have px-2. The shadow is what lets it read as
        // floating over tiles.
        <div
          className={cn(
            "sticky top-0 z-10 flex h-0 items-start justify-end",
            viewMode === "grid" && "px-3 sm:px-0"
          )}
        >
          <div className="rounded-md shadow-md">{toolbar}</div>
        </div>
      )}
      {standardCategories.map(renderCategory)}
      {customCategories.length > 0 && (
        <section className="border-primary/30 bg-primary/5 mt-2 rounded-xl border p-3 sm:p-4">
          {customDepartmentLabel && (
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <Sparkles className="text-primary size-4 shrink-0" />
              <h2 className="text-base font-bold tracking-tight">{customDepartmentLabel}</h2>
            </div>
          )}
          {customCategories.map(renderCategory)}
        </section>
      )}
    </div>
  );
}
