"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import type { PosMenuItem, PosMenuCategory } from "../types/pos.types";
import { useCurrency } from "@/components/providers/currency-provider";
import { UNCATEGORIZED_CATEGORY } from "@/lib/constants/pos";
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
}

export function PosItemGrid({
  categories,
  selectedCategory,
  selectedDepartment = null,
  onItemClick,
  searchQuery,
  customDepartmentLabel,
}: PosItemGridProps) {
  const { t } = useI18n();
  // Menu item prices are literal in the store's display currency, never
  // IDR — passing `currency` skips formatPrice's default base-currency
  // conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          (selectedCategory === null || cat.name === selectedCategory) &&
          (selectedDepartment === null || item.department === selectedDepartment) &&
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  const renderCategory = (category: (typeof filteredCategories)[number]) => (
        <div key={category.name} className="mb-6 last:mb-0 sm:mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight sm:mb-4">
            {category.name === UNCATEGORIZED_CATEGORY ? t("common.uncategorized") : category.name}
          </h2>
          <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
            {category.items.map((item) => (
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
                  <div className="text-primary mt-2 text-sm font-semibold">
                    {formatPrice(item.price)}
                  </div>
                </div>
                {!item.isAvailable && (
                  <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                    <span className="bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs font-bold">
                      {t("pos.menu.unavailable")}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
  );

  return (
    // pt-2 (not p-2) on mobile: only top spacing below the search/category
    // bar is needed — no left/right container padding, so tiles run to the
    // actual screen edge. pb-24 stays regardless of breakpoint: that's
    // functional clearance for the floating cart bar, not decorative
    // padding.
    <div className="min-h-0 flex-1 overflow-auto pt-2 pb-24 sm:p-4 lg:pb-4">
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
