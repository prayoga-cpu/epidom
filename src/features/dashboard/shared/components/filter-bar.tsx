"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Select/date-range controls rendered after the search input. */
  children?: ReactNode;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  clearLabel: string;
  className?: string;
}

/**
 * Consistent search + filter-controls + clear-button row, shared across the
 * Stock and History tabs (and anywhere else that needs the same shape)
 * instead of each screen hand-building its own layout.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
  hasActiveFilters,
  onClearFilters,
  clearLabel,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {children}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="shrink-0">
          <X className="mr-1 h-4 w-4" />
          {clearLabel}
        </Button>
      )}
    </div>
  );
}
