"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BaseItemCardProps {
  children: ReactNode;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  bulkSelectMode?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * BaseItemCard Component
 *
 * Base wrapper for item cards in data sections.
 * Provides consistent selection behavior and styling.
 * Follows DRY principle by centralizing common card patterns.
 */
export function BaseItemCard({
  children,
  isSelected = false,
  onSelect,
  bulkSelectMode = false,
  className,
  contentClassName,
}: BaseItemCardProps) {
  return (
    <Card
      className={cn(
        "group bg-card relative rounded-lg border px-0 py-4 shadow-sm transition-all hover:shadow-md",
        isSelected && "ring-primary ring-2",
        className
      )}
    >
      {/* Bulk Select Checkbox */}
      {bulkSelectMode && onSelect && (
        <div className="absolute top-4 left-2">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} />
        </div>
      )}

      {/* Content */}
      <CardContent className={cn(bulkSelectMode && "pl-8", contentClassName || "px-0")}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * ItemCardGrid Component
 *
 * Responsive grid wrapper for item cards.
 * Provides consistent grid layout across sections.
 */
interface ItemCardGridProps {
  children: ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    large?: number;
  };
  className?: string;
}

export function ItemCardGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3, large: 4 },
  className,
}: ItemCardGridProps) {
  // Use static classes since dynamic grid-cols-* don't work with Tailwind
  const gridClasses = cn(
    "grid gap-3 grid-cols-1",
    columns.tablet === 2 && "md:grid-cols-2",
    columns.tablet === 3 && "md:grid-cols-3",
    columns.tablet === 4 && "md:grid-cols-4",
    columns.desktop === 2 && "lg:grid-cols-2",
    columns.desktop === 3 && "lg:grid-cols-3",
    columns.desktop === 4 && "lg:grid-cols-4",
    columns.large === 2 && "xl:grid-cols-2",
    columns.large === 3 && "xl:grid-cols-3",
    columns.large === 4 && "xl:grid-cols-4",
    className
  );

  return <div className={gridClasses}>{children}</div>;
}

