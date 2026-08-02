import { useState, useCallback } from "react";

export type SortDir = "asc" | "desc";

/**
 * Click-to-sort state for a table's column headers. Same click-again-to-flip
 * behavior as the original implementation in shifts-client.tsx: clicking the
 * active column flips direction, clicking a new column selects it (desc
 * first, since that's the useful default for revenue/count columns).
 */
export function useSortable<T extends string>(defaultField: T, defaultDir: SortDir = "desc") {
  const [sortField, setSortField] = useState<T>(defaultField);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggleSort = useCallback(
    (field: T) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  return { sortField, sortDir, toggleSort };
}

/** Sorts `rows` by whatever `getValue` extracts for the currently active field. */
export function sortRows<T>(rows: T[], dir: SortDir, getValue: (row: T) => string | number): T[] {
  return [...rows].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    const cmp =
      typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
    return dir === "asc" ? cmp : -cmp;
  });
}
