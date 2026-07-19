"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import { responsive } from "@/lib/utils/responsive";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
}

interface FilterSectionProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  className?: string;
}

/**
 * FilterSection Component
 *
 * Reusable filter section with search input and filter dropdowns.
 * Supports multiple filter fields and clear filters functionality.
 * Follows DRY principle by centralizing the filter pattern.
 */
export function FilterSection({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  hasActiveFilters = false,
  onClearFilters,
  clearFiltersLabel = "Clear Filters",
  className,
}: FilterSectionProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search */}
      <div className="relative w-full">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9"
        />
      </div>

      {/* Filters Row */}
      {(filters.length > 0 || onClearFilters) && (
        <div className={responsive.filtersRow}>
          {filters.map((filter) => (
            <Select key={filter.key} value={filter.value || "all"} onValueChange={filter.onChange}>
              <SelectTrigger className={responsive.select}>
                <Filter className="mr-1 hidden h-4 w-4 sm:inline" />
                <SelectValue placeholder={filter.placeholder || filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Clear Filters */}
          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className={responsive.button}
            >
              <X className="mr-1 hidden h-4 w-4 sm:inline" />
              {clearFiltersLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
