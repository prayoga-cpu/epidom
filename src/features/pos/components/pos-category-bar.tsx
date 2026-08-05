"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_CATEGORY } from "@/lib/constants/pos";

interface PosCategoryBarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function PosCategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: PosCategoryBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        variant={selectedCategory === null ? "default" : "secondary"}
        className="shrink-0 rounded-full"
        onClick={() => onSelectCategory(null)}
      >
        {t("pos.menu.all")}
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          size="sm"
          variant={selectedCategory === category ? "default" : "secondary"}
          className="shrink-0 rounded-full"
          onClick={() => onSelectCategory(category)}
        >
          {category === UNCATEGORIZED_CATEGORY ? t("common.uncategorized") : category}
        </Button>
      ))}
    </div>
  );
}
