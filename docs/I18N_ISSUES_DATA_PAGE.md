# i18n Issues Analysis - Data Page

## 📋 Summary

Analysis of internationalization (i18n) implementation issues in the Data page section of Epidom Dashboard.

**Date:** 2025-10-31
**Location:** `src/features/dashboard/data/**/*`
**Locale Files:** `src/locales/en.ts`, `src/locales/fr.ts`, `src/locales/id.ts`

---

## 🔍 How i18n Works in Epidom

### Implementation Pattern

1. **I18nProvider** (`src/components/lang/i18n-provider.tsx`)
   - Provides `useI18n()` hook with `locale`, `setLocale()`, and `t()` function
   - Uses localStorage to persist user's language choice
   - Supports 3 languages: English (en), French (fr), Indonesian (id)

2. **Translation Keys** (Dot notation with nested objects)
   ```typescript
   t("nav.dashboard")  // "Dashboard" / "Tableau de bord" / "Dasbor"
   t("data.materials.pageTitle")  // "Materials"
   t("actions.delete")  // "Delete"
   ```

3. **Usage Pattern**
   ```typescript
   const { t } = useI18n();
   const title = t("data.materials.pageTitle") || "Materials";  // Fallback
   ```

---

## ❌ Issues Found

### 1. Hardcoded Toast Messages - Delete Operations

**Location:** All `*-section.tsx` files in Data page

**Problem:** Delete toast messages are hardcoded in English instead of using translation keys.

**Affected Files:**
- `src/features/dashboard/data/materials/components/materials-section.tsx`
- `src/features/dashboard/data/products/components/products-section.tsx`
- `src/features/dashboard/data/recipes/components/recipes-section.tsx`
- `src/features/dashboard/data/suppliers/components/suppliers-section.tsx`

**Current Code:**
```typescript
// materials-section.tsx (Line 173-176)
toast({
  title: "Material Deleted",
  description: `${selectedMaterial?.name} has been deleted successfully.`,
});

// materials-section.tsx (Line 183-186)
toast({
  title: "Materials Deleted",
  description: `${selectedIds.size} materials have been deleted successfully.`,
});
```

**Missing Translation Keys:**
```typescript
// Should exist in src/locales/en.ts, fr.ts, id.ts
data.materials.toasts.deleted = {
  title: "Material Deleted",
  description: "{name} has been deleted successfully.",
}
data.materials.toasts.bulkDeleted = {
  title: "Materials Deleted",
  description: "{count} materials have been deleted successfully.",
}
```

**Repeat for:** Products, Recipes, Suppliers (same pattern)

---

### 2. Hardcoded Toast Messages - Update Operations

**Location:** All `edit-*-dialog.tsx` files in Data page

**Problem:** Update toast messages are inconsistent - some use i18n, some are hardcoded.

**Affected Files:**
- `src/features/dashboard/data/materials/components/edit-material-dialog.tsx` ❌ Hardcoded
- `src/features/dashboard/data/products/components/edit-product-dialog.tsx` ❌ Hardcoded
- `src/features/dashboard/data/recipes/components/edit-recipe-dialog.tsx` ✅ Uses i18n
- `src/features/dashboard/data/suppliers/components/edit-supplier-dialog.tsx` ❌ Hardcoded

**Good Example (Recipe):**
```typescript
// edit-recipe-dialog.tsx (Line 133-136)
toast({
  title: t("data.recipes.toasts.updated.title") || "Recipe Updated Successfully",
  description: t("data.recipes.toasts.updated.description")?.replace("{name}", data.name) || `${data.name} has been updated.`,
});
```

**Bad Examples:**
```typescript
// edit-material-dialog.tsx (Line 136-139)
toast({
  title: "Material Updated Successfully",
  description: `${data.name} has been updated.`,
});
```

**Note:** The translation keys **already exist** in locale files but are not being used!

---

### 3. Hardcoded Placeholder Text in Filter Dropdowns

**Location:** All `*-section.tsx` files

**Problem:** Select placeholder text is hardcoded instead of using translation keys.

**Affected Files:**
- `src/features/dashboard/data/materials/components/materials-section.tsx`
- `src/features/dashboard/data/suppliers/components/suppliers-section.tsx`

**Current Code:**
```typescript
// materials-section.tsx (Line 278)
<SelectValue placeholder="Category" />

// materials-section.tsx (Line 296)
<SelectValue placeholder="Supplier" />

// materials-section.tsx (Line 314)
<SelectValue placeholder="Stock Status" />

// materials-section.tsx (Line 338)
<SelectValue placeholder="Sort by" />
```

**Missing Translation Keys:** None exist for these placeholders in `data.materials.*` or `filters.*`

---

### 4. Hardcoded Placeholder Text in Edit Dialogs

**Location:** `edit-material-dialog.tsx`

**Problem:** Many input placeholders are hardcoded in English.

**Examples:**
```typescript
// Line 168
<Input placeholder="e.g., Flour T55" {...field} />

// Line 182
<Input placeholder="e.g., FLR-T55-25KG" {...field} />

// Line 255
<Input type="number" placeholder="100" {...field} />

// Line 341
<Input placeholder="e.g., Storage Room A, Shelf 1" {...field} />
```

**Note:** `add-material-dialog.tsx` already uses i18n properly!
```typescript
placeholder={t("data.materials.form.namePlaceholder") || "e.g., Flour, Sugar, Butter"}
```

---

### 5. Hardcoded Export Button Title

**Location:** All `*-section.tsx` files

**Problem:** Export button title is hardcoded.

**Current Code:**
```typescript
// materials-section.tsx (Line 209)
<ExportButton
  data={processedMaterials}
  filename="materials"
  columns={exportColumns}
  title="Materials"  // ❌ Hardcoded
/>
```

---

## ✅ What's Working Well

1. **Add Material Dialog** - Fully uses i18n with proper fallbacks
2. **Edit Recipe Dialog** - Uses i18n for all toast messages
3. **Recipe Details Dialog** - Properly implemented
4. **Most form placeholders** in `add-*-dialog.tsx` files
5. **Page titles** - All use `t("data.materials.pageTitle")`
6. **Navigation** - All tabs use translation keys
7. **Filter labels** - Most use i18n keys

---

## 🔧 Recommended Fixes

### Fix 1: Add Missing Translation Keys

Add to **all 3 locale files** (`en.ts`, `fr.ts`, `id.ts`):

```typescript
// src/locales/en.ts (and fr.ts, id.ts)

data: {
  materials: {
    // ... existing ...
    toasts: {
      added: {
        title: "Material Added Successfully",
        description: "{name} has been added to your inventory.",
      },
      updated: {
        title: "Material Updated Successfully",
        description: "{name} has been updated.",
      },
      deleted: {  // ✅ ADD THIS
        title: "Material Deleted",
        description: "{name} has been deleted successfully.",
      },
      bulkDeleted: {  // ✅ ADD THIS
        title: "Materials Deleted",
        description: "{count} materials have been deleted successfully.",
      },
    },
  },
  // Repeat for products, recipes, suppliers
  products: {
    toasts: {
      // ... existing ...
      deleted: {  // ✅ ADD
        title: "Product Deleted",
        description: "{name} has been deleted successfully.",
      },
      bulkDeleted: {  // ✅ ADD
        title: "Products Deleted",
        description: "{count} products have been deleted successfully.",
      },
    },
  },
  recipes: {
    toasts: {
      // ... existing ...
      deleted: {  // ✅ ADD
        title: "Recipe Deleted",
        description: "{name} has been deleted successfully.",
      },
    },
  },
  suppliers: {
    toasts: {
      // ... existing ...
      deleted: {  // ✅ ADD
        title: "Supplier Deleted",
        description: "{name} has been deleted successfully.",
      },
    },
  },
},
```

### Fix 2: Add Placeholder Keys

Add to locale files:

```typescript
filters: {
  // ... existing ...
  placeholderCategory: "Category",
  placeholderSupplier: "Supplier",
  placeholderStockStatus: "Stock Status",
  placeholderSortBy: "Sort by",
  placeholderPaymentTerms: "Payment Terms",
  placeholderRating: "Rating",
},
```

### Fix 3: Update Code to Use i18n

**For Delete Operations:**
```typescript
// materials-section.tsx
const handleDeleteConfirm = () => {
  toast({
    title: t("data.materials.toasts.deleted.title"),
    description: t("data.materials.toasts.deleted.description").replace(
      "{name}",
      selectedMaterial?.name || ""
    ),
  });
  // ...
};

const handleBulkDelete = () => {
  toast({
    title: t("data.materials.toasts.bulkDeleted.title"),
    description: t("data.materials.toasts.bulkDeleted.description").replace(
      "{count}",
      selectedIds.size.toString()
    ),
  });
  // ...
};
```

**For Update Operations:**
```typescript
// edit-material-dialog.tsx (Line 136-139)
toast({
  title: t("data.materials.toasts.updated.title"),
  description: t("data.materials.toasts.updated.description").replace(
    "{name}",
    data.name
  ),
});
```

**For Placeholder Text:**
```typescript
<SelectValue placeholder={t("filters.placeholderCategory")} />
<SelectValue placeholder={t("filters.placeholderSupplier")} />
<SelectValue placeholder={t("filters.placeholderStockStatus")} />
<SelectValue placeholder={t("filters.placeholderSortBy")} />
```

---

## 📊 Impact Summary

| Category | Issues Found | Files Affected | Severity |
|----------|-------------|----------------|----------|
| Delete Toasts | 8 missing keys | 4 section files | 🔴 High |
| Update Toasts | 3 hardcoded | 3 dialog files | 🟡 Medium |
| Filter Placeholders | 6 hardcoded | 2 section files | 🟡 Medium |
| Edit Placeholders | ~15 hardcoded | 1 dialog file | 🟢 Low |
| Export Titles | 4 hardcoded | 4 section files | 🟢 Low |

**Total Issues:** ~36 instances of hardcoded English text

---

## ✅ Next Steps

1. Add missing translation keys to all 3 locale files (en, fr, id)
2. Update `*-section.tsx` files to use i18n for delete operations
3. Update `edit-*-dialog.tsx` files to use i18n for update operations
4. Add placeholder keys and update filter dropdowns
5. Test with all 3 languages to ensure proper display
6. Consider adding ESLint rule to detect hardcoded strings

---

## 🔗 Related Files

### Main Files to Update:
- `src/locales/en.ts` - Add missing keys
- `src/locales/fr.ts` - Add French translations
- `src/locales/id.ts` - Add Indonesian translations

### Component Files to Update:
- `src/features/dashboard/data/materials/components/materials-section.tsx`
- `src/features/dashboard/data/materials/components/edit-material-dialog.tsx`
- `src/features/dashboard/data/products/components/products-section.tsx`
- `src/features/dashboard/data/products/components/edit-product-dialog.tsx`
- `src/features/dashboard/data/recipes/components/recipes-section.tsx`
- `src/features/dashboard/data/suppliers/components/suppliers-section.tsx`
- `src/features/dashboard/data/suppliers/components/edit-supplier-dialog.tsx`

---

**End of Analysis**

