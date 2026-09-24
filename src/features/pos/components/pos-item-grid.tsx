"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useOnlineStatus } from "@/hooks/use-network-status";
import type { PosMenuItem, PosMenuCategory } from "../types/pos.types";
import type { PosViewMode } from "../hooks/use-pos-view-mode";
import { useCurrency } from "@/components/providers/currency-provider";
import { UNCATEGORIZED_CATEGORY } from "@/lib/constants/pos";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { matchesMenuDepartment, type PosMenuDepartment } from "../lib/menu-department";

interface PosItemGridProps {
  categories: PosMenuCategory[];
  /** The category whose items are open, or null for the category cards. */
  selectedCategory: string | null;
  /** Opens a category card (its name) or goes back to the cards (null). */
  onSelectCategory: (category: string | null) => void;
  selectedDepartment?: PosMenuDepartment | null;
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

/**
 * The till's menu, two taps deep: category cards first, then the chosen
 * category's items behind a Back card in the first (top-left) slot. The Food /
 * Drink tab above (PosDepartmentBar) narrows both levels. Typing a search skips
 * the cards: it looks through every category (of the current tab) at once and
 * lists the hits under their category headings.
 */
export function PosItemGrid({
  categories,
  selectedCategory,
  onSelectCategory,
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

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;

  // Categories that still have something under the current Food / Drink tab.
  const tabCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => matchesMenuDepartment(item.department, selectedDepartment)),
    }))
    .filter((cat) => cat.items.length > 0);

  // A search looks past the category cards, through every category of the tab.
  const searchResults = isSearching
    ? tabCategories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (item) =>
              item.name.toLowerCase().includes(query) ||
              // A barcode typed (or partly typed) into the search box narrows to its
              // product too — Enter then adds an exact match (see PosShell).
              (!!item.barcode && item.barcode.toLowerCase().includes(query))
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : [];

  // The open category. A category that has gone (a menu refresh, or the other tab
  // has none of it) falls back to the cards rather than an empty page, and a tab
  // with a single category skips a pointless card and opens it straight away —
  // with no Back card, since there is nothing to go back to.
  const hasCategoryCards = tabCategories.length > 1;
  const openCategory = isSearching
    ? null
    : (tabCategories.find((cat) => cat.name === selectedCategory) ??
      (hasCategoryCards ? null : (tabCategories[0] ?? null)));
  const showBack = openCategory !== null && hasCategoryCards;

  // Each level starts at the top: tapping a card far down the list must not open
  // its items already scrolled past the first ones.
  const scrollRef = useRef<HTMLDivElement>(null);
  const openCategoryName = openCategory?.name ?? null;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [openCategoryName, selectedDepartment, isSearching]);

  const shownCategories = isSearching
    ? searchResults
    : openCategory
      ? [openCategory]
      : tabCategories;

  // The optional second product line (Product.productLine, tagged
  // department: "CUSTOM" server-side) gets its own visually distinct block
  // below the regular menu rather than sitting among the food/drink
  // categories — it's a different kind of offering, and reading as just
  // another category is what the merchant flagged.
  const standardCategories: typeof shownCategories = [];
  const customCategories: typeof shownCategories = [];
  for (const category of shownCategories) {
    const customItems = category.items.filter((i) => i.department === "CUSTOM");
    const standardItems = category.items.filter((i) => i.department !== "CUSTOM");
    if (standardItems.length > 0) standardCategories.push({ ...category, items: standardItems });
    if (customItems.length > 0) customCategories.push({ ...category, items: customItems });
  }

  if (shownCategories.length === 0) {
    // An empty Food or Drink tab almost always means the items were never given a
    // department (it defaults to Kitchen), so say where that is set.
    const emptyMessage =
      !isSearching && selectedDepartment === "KITCHEN"
        ? t("pos.menu.noFoodItems")
        : !isSearching && selectedDepartment === "BAR"
          ? t("pos.menu.noDrinkItems")
          : t("pos.menu.noItems");
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center">
        <p className="max-w-sm">{emptyMessage}</p>
      </div>
    );
  }

  const categoryLabel = (name: string) =>
    name === UNCATEGORIZED_CATEGORY ? t("common.uncategorized") : name;

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

  // A category card: tinted so it never reads as an item, the same size as an
  // item tile in each layout (120px / 72px / a 56px row) — well over the 40px floor.
  const renderCategoryCard = (category: (typeof shownCategories)[number]) => {
    const count = t("pos.menu.itemCount").replace("{count}", String(category.items.length));
    const base =
      "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40 focus-visible:ring-primary touch-manipulation border transition-colors focus-visible:ring-2 focus-visible:outline-none";
    if (viewMode === "list") {
      return (
        <button
          key={category.name}
          type="button"
          onClick={() => onSelectCategory(category.name)}
          className={cn(base, "flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left")}
        >
          <span className="min-w-0 flex-1 truncate font-semibold">
            {categoryLabel(category.name)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{count}</span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </button>
      );
    }
    return (
      <button
        key={category.name}
        type="button"
        onClick={() => onSelectCategory(category.name)}
        className={cn(
          base,
          "flex flex-col items-center justify-center gap-1 p-3 text-center",
          viewMode === "columns" ? "min-h-[72px] rounded-lg" : "min-h-[120px] sm:rounded-xl"
        )}
      >
        <span className="line-clamp-3 leading-tight font-semibold">
          {categoryLabel(category.name)}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      </button>
    );
  };

  // The Back card takes the first slot of the open category's items, so the way
  // out is always in the same top-left spot, one tap away.
  const renderBackCard = (name: string) => (
    <button
      key="__back"
      type="button"
      onClick={() => onSelectCategory(null)}
      className={cn(
        "bg-muted/60 hover:bg-muted focus-visible:ring-primary flex touch-manipulation border border-dashed text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        viewMode === "list"
          ? "min-h-14 items-center gap-3 rounded-lg px-3 py-2"
          : cn(
              "flex-col justify-center gap-1 p-3",
              viewMode === "columns" ? "min-h-[72px] rounded-lg" : "min-h-[120px] sm:rounded-xl"
            )
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeft className="size-4 shrink-0" />
        {t("common.actions.back")}
      </span>
      <span className="text-primary line-clamp-2 leading-tight font-semibold">
        {categoryLabel(name)}
      </span>
    </button>
  );

  // Search results keep a heading per category, since they mix categories.
  const renderSearchCategory = (category: (typeof shownCategories)[number]) => (
    <div key={category.name} className="mb-6 last:mb-0 sm:mb-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight sm:mb-4">
        {categoryLabel(category.name)}
      </h2>
      <div className={itemsLayoutClass}>{category.items.map(renderTile)}</div>
    </div>
  );

  // The open category's items. The Back card goes into whichever block comes
  // first — the regular menu, or the custom line's when that is all there is.
  const renderOpenCategory = (category: (typeof shownCategories)[number], withBack: boolean) => (
    <div key={category.name} className={itemsLayoutClass}>
      {withBack && renderBackCard(category.name)}
      {category.items.map(renderTile)}
    </div>
  );

  const renderBlock = (blockCategories: typeof shownCategories, isFirstBlock: boolean) =>
    isSearching
      ? blockCategories.map(renderSearchCategory)
      : openCategory
        ? blockCategories.map((cat) => renderOpenCategory(cat, showBack && isFirstBlock))
        : [
            <div key="cards" className={itemsLayoutClass}>
              {blockCategories.map(renderCategoryCard)}
            </div>,
          ];

  const departmentLabel =
    selectedDepartment === "KITCHEN"
      ? t("pos.menu.food")
      : selectedDepartment === "BAR"
        ? t("pos.menu.drink")
        : selectedDepartment === "CUSTOM"
          ? customDepartmentLabel
          : null;

  // Where the cashier is: Categories › Drink › Classic Coffee. The last crumb is
  // the heading of what is on screen; "Categories" goes back to the cards.
  // pr-36 keeps it clear of the view switch floating at the top right.
  const breadcrumb = !isSearching && (
    <div
      className={cn(
        "mb-3 flex min-h-10 min-w-0 items-center gap-1 pr-36 text-sm sm:mb-4",
        // Grid view has no side gutter on a phone; bring one, like the view switch.
        viewMode === "grid" && "pl-3 sm:pl-0"
      )}
    >
      {showBack ? (
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className="text-muted-foreground hover:text-foreground flex min-h-10 shrink-0 cursor-pointer touch-manipulation items-center font-medium transition-colors"
        >
          {t("pos.menu.categories")}
        </button>
      ) : openCategory ? (
        <span className="text-muted-foreground shrink-0 font-medium">
          {t("pos.menu.categories")}
        </span>
      ) : (
        <h2 className="shrink-0 font-semibold">{t("pos.menu.categories")}</h2>
      )}
      {departmentLabel && (
        <>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          <span
            className={cn(
              "shrink-0",
              openCategory ? "text-muted-foreground font-medium" : "text-primary font-semibold"
            )}
          >
            {departmentLabel}
          </span>
        </>
      )}
      {openCategory && (
        <>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          <h2 className="text-primary min-w-0 truncate font-semibold">
            {categoryLabel(openCategory.name)}
          </h2>
        </>
      )}
    </div>
  );

  return (
    // pt-2 (not p-2) on mobile: only top spacing below the search/category
    // bar is needed — no left/right container padding in grid view, so tiles
    // run to the actual screen edge. Columns and list keep a small gutter, since
    // their tiles are rounded cards. pb-24 is functional clearance for the phone's
    // floating cart button (PosHeader), not decorative padding: it must hold at
    // every width that shows the button (below md), so sm:p-4 re-states it.
    <div
      ref={scrollRef}
      data-view-mode={viewMode}
      className={cn(
        "min-h-0 flex-1 overflow-auto pt-2 pb-24 sm:p-4 sm:pb-24 md:pb-4",
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
      {breadcrumb}
      {standardCategories.length > 0 && renderBlock(standardCategories, true)}
      {customCategories.length > 0 && (
        <section
          className={cn(
            "border-primary/30 bg-primary/5 rounded-xl border p-3 sm:p-4",
            standardCategories.length > 0 && "mt-6 sm:mt-8"
          )}
        >
          {customDepartmentLabel && (
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <Sparkles className="text-primary size-4 shrink-0" />
              <h2 className="text-base font-bold tracking-tight">{customDepartmentLabel}</h2>
            </div>
          )}
          {renderBlock(customCategories, standardCategories.length === 0)}
        </section>
      )}
    </div>
  );
}
