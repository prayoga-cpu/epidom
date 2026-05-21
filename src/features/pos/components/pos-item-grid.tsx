"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import type { PosMenuItem, PosMenuCategory } from "../types/pos.types";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import Image from "next/image";

interface PosItemGridProps {
  categories: PosMenuCategory[];
  selectedCategory: string | null;
  onItemClick: (item: PosMenuItem) => void;
  searchQuery: string;
}

export function PosItemGrid({
  categories,
  selectedCategory,
  onItemClick,
  searchQuery,
}: PosItemGridProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();

  const filteredCategories = categories.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        (selectedCategory === null || cat.name === selectedCategory) &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  if (filteredCategories.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        <p>{t("pos.menu.noItems")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 pb-24 lg:pb-4">
      {filteredCategories.map((category) => (
        <div key={category.name} className="mb-8 last:mb-0">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            {category.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {category.items.map((item) => (
              <button
                key={item.id}
                disabled={!item.isAvailable}
                onClick={() => onItemClick(item)}
                className={`group relative flex h-full min-h-[120px] flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  !item.isAvailable ? "opacity-50 grayscale" : ""
                }`}
              >
                {item.imageUrl && (
                  <div className="relative h-32 w-full overflow-hidden bg-muted">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <h3 className="line-clamp-2 font-medium leading-tight">
                      {item.name}
                    </h3>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-primary">
                    {formatCurrency(item.price, currency)}
                  </div>
                </div>
                {!item.isAvailable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                    <span className="rounded-md bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">
                      {t("pos.menu.unavailable")}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
