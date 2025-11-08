# Shared Components Refactoring

## Overview

Refactoring untuk mengimplementasikan rekomendasi dari CODE_QUALITY_ANALYSIS.md dengan mengekstrak common patterns ke shared components.

## Components Created

### 1. SectionLoadingState
**Location:** `src/features/dashboard/data/components/section-loading-state.tsx`

**Purpose:** Centralized loading state untuk semua data sections.

**Usage:**
```tsx
<SectionLoadingState
  title={t("data.materials.title")}
  exportLabel={t("common.actions.export")}
  addLabel={t("data.materials.addButton")}
  selectLabel={t("common.actions.select")}
/>
```

**Benefits:**
- ✅ Eliminates duplication across Materials, Recipes, Products, Suppliers
- ✅ Consistent loading UI
- ✅ Easy to maintain

### 2. FilterSection
**Location:** `src/features/dashboard/data/components/filter-section.tsx`

**Purpose:** Reusable filter section dengan search dan multiple filter dropdowns.

**Usage:**
```tsx
<FilterSection
  searchValue={filters.search}
  onSearchChange={handleSearch}
  searchPlaceholder={t("actions.searchPlaceholder")}
  filters={[
    {
      key: "category",
      label: t("filters.allCategories"),
      value: filters.category || "all",
      onChange: handleCategoryFilter,
      options: [...],
    },
  ]}
  hasActiveFilters={hasActiveFilters}
  onClearFilters={clearFilters}
  clearFiltersLabel={t("common.actions.clearFilters")}
/>
```

**Benefits:**
- ✅ Centralized filter pattern
- ✅ Consistent responsive behavior
- ✅ Type-safe with TypeScript interfaces

### 3. BaseItemCard & ItemCardGrid
**Location:** `src/features/dashboard/data/components/base-item-card.tsx`

**Purpose:** Base wrapper untuk item cards dengan selection behavior.

**Usage:**
```tsx
<ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
  {items.map((item) => (
    <BaseItemCard
      key={item.id}
      isSelected={selectedIds.has(item.id)}
      bulkSelectMode={bulkSelectMode}
      onSelect={(checked) => toggleSelect(item.id, checked)}
    >
      {/* Item content */}
    </BaseItemCard>
  ))}
</ItemCardGrid>
```

**Benefits:**
- ✅ Consistent card styling
- ✅ Built-in selection behavior
- ✅ Responsive grid layout

## Refactoring Status

### ✅ Completed
- [x] Create SectionLoadingState component
- [x] Create FilterSection component
- [x] Create BaseItemCard & ItemCardGrid components
- [x] Refactor MaterialsSection to use shared components

### 🔄 In Progress
- [ ] Refactor RecipesSection to use shared components
- [ ] Refactor ProductsSection to use shared components
- [ ] Refactor SuppliersSection to use shared components

## Code Reduction

**Before:**
- Loading state: ~25 lines per section × 4 sections = 100 lines
- Filter section: ~50 lines per section × 4 sections = 200 lines
- Item card wrapper: ~10 lines per section × 4 sections = 40 lines
- **Total: ~340 lines of duplicated code**

**After:**
- Loading state: 1 component (45 lines) reused 4× = 45 lines
- Filter section: 1 component (80 lines) reused 4× = 80 lines
- Item card: 1 component (95 lines) reused 4× = 95 lines
- **Total: ~220 lines (35% reduction)**

## Next Steps

1. Complete refactoring untuk RecipesSection, ProductsSection, SuppliersSection
2. Update documentation
3. Consider extracting more patterns (error states, pagination, etc.)

