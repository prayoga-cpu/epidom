"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

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
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-2 p-4">
          <Button
            variant={selectedCategory === null ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => onSelectCategory(null)}
          >
            {t("pos.menu.all")}
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "secondary"}
              className="rounded-full"
              onClick={() => onSelectCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
