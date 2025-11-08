/**
 * Responsive utility classes for consistent breakpoint usage
 *
 * Breakpoint Strategy:
 * - Mobile: < 768px (default)
 * - Tablet: 768px - 1023px (md:)
 * - Desktop: >= 1024px (lg:)
 */

/**
 * Common responsive layout patterns
 */
export const responsive = {
  // Header layout: mobile vertical, tablet+ horizontal
  header: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",

  // Button group: mobile vertical stack, tablet+ horizontal
  buttonGroup: "flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end",

  // Button: mobile full-width, tablet+ auto-width
  button: "w-full md:w-auto",

  // Select/Input: mobile full-width, tablet+ fixed width
  select: "w-full md:w-[180px]",
  selectSmall: "w-full md:w-[140px]",
  selectMedium: "w-full md:w-[200px]",

  // Search input: mobile full-width, tablet+ fixed width
  searchInput: "w-full md:w-64",

  // Filters row: mobile center, tablet+ left
  filtersRow: "flex w-full flex-wrap items-center gap-2",

  // Grid layouts
  grid1to2: "grid grid-cols-1 gap-3 md:grid-cols-2",
  grid1to3: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
  grid1to4: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  grid2to4: "grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4",

  // Item card grid - commonly used patterns
  itemGrid: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  itemGrid3Col: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",

  // Card wrapper: consistent styling
  cardWrapper: "min-h-[calc(100vh-150px)] overflow-hidden shadow-md",
  cardHeader: "border-b",

  // Section spacing
  sectionSpacing: "space-y-4",
} as const;

/**
 * Common responsive text patterns
 */
export const responsiveText = {
  // Title: consistent sizing
  title: "text-lg font-bold",
  titleSmall: "text-sm font-medium",

  // Description: consistent sizing
  description: "text-sm",
  descriptionSmall: "text-xs",
} as const;

