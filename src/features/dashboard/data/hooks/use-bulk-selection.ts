import { useState, useCallback } from "react";

/**
 * Reusable hook for bulk selection functionality
 *
 * Follows DRY principle by centralizing bulk selection logic
 * used across Materials, Products, Recipes, and Suppliers sections
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleBulkSelect = useCallback(() => {
    setBulkSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }, [items, selectedIds.size]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkSelectMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    bulkSelectMode,
    selectedIds,
    selectedCount: selectedIds.size,
    toggleBulkSelect,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isSelected,
    setBulkSelectMode,
    setSelectedIds,
  };
}

