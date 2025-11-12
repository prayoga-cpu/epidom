# Code Review Analysis - Recent Changes

**Date:** 2025-11-12
**Branch:** ilmi
**Commit:** a271e63

## Executive Summary

Analisis perubahan yang baru di-push menunjukkan bahwa sebagian besar perubahan sudah mengikuti best practices dan prinsip KISS, YAGNI, dan DRY. Namun, ada beberapa area yang bisa diperbaiki untuk meningkatkan kualitas kode.

---

## ✅ **STRENGTHS - Yang Sudah Baik**

### 1. **DRY (Don't Repeat Yourself)** ✅

#### ✅ Toast Notification Centralization
- **File:** `src/features/dashboard/profile/hooks/use-profile.ts`
- **Improvement:** Toast notifications dipindahkan ke mutation hook, menghilangkan duplikasi di component
- **Before:** Toast dipanggil di `edit-avatar-dialog.tsx` dan `edit-personal-info-dialog.tsx` (duplikasi)
- **After:** Toast hanya di `useUpdateProfile` hook (single source of truth)
- **Status:** ✅ **EXCELLENT** - Mengikuti DRY principle

#### ✅ Query Key Management
- **File:** `src/features/dashboard/data/materials/hooks/use-materials.ts`
- **Pattern:** Menggunakan `materialKeys` object untuk centralized query key management
- **Benefit:** Konsisten, mudah di-maintain, mengurangi typo
- **Status:** ✅ **GOOD** - Mengikuti DRY principle

### 2. **KISS (Keep It Simple, Stupid)** ✅

#### ✅ Race Condition Fix
- **File:** `src/lib/services/business.service.ts`
- **Approach:** Menggunakan transaction dengan `SELECT FOR UPDATE` dan `SERIALIZABLE` isolation level
- **Complexity:** Solusi yang tepat untuk masalah race condition, tidak over-engineered
- **Status:** ✅ **GOOD** - Solusi yang tepat dan tidak berlebihan

#### ✅ Frontend Debounce
- **File:** `src/features/stores/stores/components/create-store-dialog.tsx`
- **Approach:** Menggunakan `useRef` untuk debounce, sederhana dan efektif
- **Status:** ✅ **GOOD** - Simple dan efektif

### 3. **YAGNI (You Aren't Gonna Need It)** ✅

#### ✅ Material SKU Migration
- **Change:** Material SKU dari global unique menjadi unique per store
- **Reason:** Konsistensi dengan Product SKU (sudah ada di sistem)
- **Status:** ✅ **GOOD** - Tidak menambah fitur yang tidak perlu, hanya memperbaiki inkonsistensi

---

## ⚠️ **AREAS FOR IMPROVEMENT**

### 1. **KISS Violation - Complex Toast Logic** ⚠️

**File:** `src/features/dashboard/profile/hooks/use-profile.ts:126-179`

**Problem:**
```typescript
// Logic untuk menentukan jenis toast cukup kompleks
const hasImageUpdate = variables.image !== undefined;
const hasOtherUpdates =
  variables.name !== undefined ||
  variables.phone !== undefined ||
  variables.locale !== undefined ||
  variables.timezone !== undefined ||
  variables.currency !== undefined;

const isAvatarOnlyUpdate = hasImageUpdate && !hasOtherUpdates;
const isAvatarRemoval = isAvatarOnlyUpdate && (variables.image === "" || variables.image === null);
```

**Issues:**
- Logic cukup panjang dan bisa disederhanakan
- Banyak conditional checks yang bisa di-extract ke helper function
- Violates KISS principle (bisa lebih sederhana)

**Recommendation:**
```typescript
// Extract ke helper function untuk lebih sederhana
function getUpdateType(variables: UpdateProfilePayload): 'avatar' | 'avatar-removal' | 'profile' {
  if (variables.image === undefined) return 'profile';
  if (variables.image === '' || variables.image === null) return 'avatar-removal';

  // Check if only image is being updated
  const otherFields = ['name', 'phone', 'locale', 'timezone', 'currency'];
  const hasOtherFields = otherFields.some(field => variables[field] !== undefined);

  return hasOtherFields ? 'profile' : 'avatar';
}
```

**Priority:** Medium

---

### 2. **DRY Violation - Repeated Session Update Pattern** ⚠️

**File:** `src/features/dashboard/profile/hooks/use-profile.ts:144-162`

**Problem:**
```typescript
// Pattern ini bisa di-extract ke helper function
const sessionUpdate: Record<string, any> = {};

if (data.currency) sessionUpdate.currency = data.currency;
if (data.locale) sessionUpdate.locale = data.locale;
if (data.timezone) sessionUpdate.timezone = data.timezone;
if (data.name) sessionUpdate.name = data.name;
if (data.phone) sessionUpdate.phone = data.phone;

if (data.image !== undefined) {
  sessionUpdate.image = data.image || null;
}
```

**Issues:**
- Pattern conditional assignment yang panjang
- Bisa di-extract ke helper function untuk reusability
- Jika ada tempat lain yang perlu update session, akan duplikasi

**Recommendation:**
```typescript
// Extract ke helper function
function buildSessionUpdate(data: ProfileData): Record<string, any> {
  const update: Record<string, any> = {};
  const fields = ['currency', 'locale', 'timezone', 'name', 'phone'] as const;

  fields.forEach(field => {
    if (data[field]) update[field] = data[field];
  });

  if (data.image !== undefined) {
    update.image = data.image || null;
  }

  return update;
}
```

**Priority:** Low (hanya digunakan di satu tempat saat ini, tapi akan berguna jika ada tempat lain)

---

### 3. **Best Practice - Console.log in Production Code** ⚠️

**File:** `src/features/dashboard/profile/hooks/use-profile.ts:123-124, 159-161`

**Problem:**
```typescript
console.log("[useUpdateProfile] Profile updated successfully:", data);
console.log("[useUpdateProfile] Profile image:", data.image);
console.log("[useUpdateProfile] Session update payload:", sessionUpdate);
console.log("[useUpdateProfile] Session updated successfully");
```

**Issues:**
- Console.log seharusnya tidak ada di production code
- Bisa menggunakan proper logging library atau conditional logging
- Violates best practices untuk production code

**Recommendation:**
```typescript
// Use conditional logging or proper logger
if (process.env.NODE_ENV === 'development') {
  console.log("[useUpdateProfile] Profile updated successfully:", data);
}

// Or use a proper logging library
import { logger } from '@/lib/logger';
logger.debug("[useUpdateProfile] Profile updated", { data });
```

**Priority:** Low (tidak critical, tapi good practice)

---

### 4. **KISS Violation - Deep Comparison in useEffect** ⚠️

**File:** `src/features/dashboard/management/recipe-production/recipe-production.tsx:40-60`

**Problem:**
```typescript
useEffect(() => {
  if (selectedRecipe?.id && recipesData?.recipes) {
    const updatedRecipe = recipesData.recipes.find((r) => r.id === selectedRecipe.id);
    if (updatedRecipe) {
      // Deep comparison logic
      const hasStockChanged = updatedRecipe.ingredients.some((ing, idx) => {
        const oldIng = selectedRecipe.ingredients?.[idx];
        return (
          oldIng &&
          Number(oldIng.material.currentStock) !== Number(ing.material.currentStock)
        );
      });

      if (hasStockChanged) {
        setSelectedRecipe(updatedRecipe);
      }
    }
  }
}, [recipesData?.recipes]);
```

**Issues:**
- Logic cukup kompleks di dalam useEffect
- Deep comparison bisa di-extract ke helper function
- Bisa menggunakan library seperti `lodash.isEqual` atau custom comparison function

**Recommendation:**
```typescript
// Extract comparison logic
function hasMaterialStockChanged(
  oldRecipe: Recipe | null,
  newRecipe: Recipe
): boolean {
  if (!oldRecipe?.ingredients) return true;

  return newRecipe.ingredients.some((ing, idx) => {
    const oldIng = oldRecipe.ingredients[idx];
    return oldIng &&
      Number(oldIng.material.currentStock) !== Number(ing.material.currentStock);
  });
}

// Then in useEffect:
useEffect(() => {
  if (selectedRecipe?.id && recipesData?.recipes) {
    const updatedRecipe = recipesData.recipes.find((r) => r.id === selectedRecipe.id);
    if (updatedRecipe && hasMaterialStockChanged(selectedRecipe, updatedRecipe)) {
      setSelectedRecipe(updatedRecipe);
    }
  }
}, [recipesData?.recipes]);
```

**Priority:** Medium

---

### 5. **DRY Violation - Repeated Cache Invalidation Pattern** ⚠️

**File:** Multiple files menggunakan pattern yang sama:
- `src/features/dashboard/data/materials/hooks/use-materials.ts`
- `src/features/dashboard/data/recipes/hooks/use-recipes.ts`
- `src/features/dashboard/data/products/hooks/use-products.ts`

**Problem:**
Setiap mutation hook melakukan:
```typescript
await queryClient.invalidateQueries({
  queryKey: ["recipes", storeId],
});
```

**Issues:**
- Pattern yang sama diulang di banyak tempat
- Bisa di-extract ke utility function atau custom hook

**Recommendation:**
```typescript
// Create utility function
export function invalidateStoreQueries(
  queryClient: QueryClient,
  storeId: string,
  resource: 'materials' | 'recipes' | 'products'
) {
  queryClient.invalidateQueries({
    queryKey: [resource, storeId],
  });
}

// Or create custom hook
export function useInvalidateStoreQueries(storeId: string) {
  const queryClient = useQueryClient();

  return useCallback((resource: 'materials' | 'recipes' | 'products') => {
    queryClient.invalidateQueries({
      queryKey: [resource, storeId],
    });
  }, [queryClient, storeId]);
}
```

**Priority:** Low (pattern sudah cukup konsisten, hanya bisa di-improve)

---

### 6. **Best Practice - Error Handling** ✅

**Status:** ✅ **GOOD**

- Error handling sudah konsisten menggunakan try-catch
- Error messages sudah user-friendly
- Error toast ditangani dengan baik (tidak duplikasi)

---

### 7. **Best Practice - Transaction Management** ✅

**File:** `src/lib/services/business.service.ts:143-219`

**Status:** ✅ **EXCELLENT**

- Menggunakan transaction dengan proper isolation level
- Row-level locking dengan `SELECT FOR UPDATE`
- Atomic operations (check limit + create store dalam satu transaction)
- Mengikuti best practices untuk database transactions

---

### 8. **Best Practice - Type Safety** ✅

**Status:** ✅ **GOOD**

- TypeScript types sudah digunakan dengan baik
- Interface definitions sudah jelas
- Type inference bekerja dengan baik

---

## 📊 **SCORING**

| Principle | Score | Notes |
|-----------|-------|-------|
| **KISS** | 8/10 | Sebagian besar sederhana, beberapa area bisa disederhanakan |
| **YAGNI** | 10/10 | Tidak ada fitur yang tidak perlu ditambahkan |
| **DRY** | 8/10 | Sebagian besar sudah DRY, beberapa pattern bisa di-extract |
| **Best Practices** | 8/10 | Mengikuti best practices, beberapa console.log perlu dihapus |

**Overall Score: 8.5/10** ✅

---

## 🎯 **RECOMMENDATIONS**

### High Priority (Should Fix)
1. **Extract toast type determination logic** ke helper function (KISS)
2. **Extract deep comparison logic** di useEffect (KISS)

### Medium Priority (Nice to Have)
3. **Extract session update building** ke helper function (DRY)
4. **Remove or conditionally log console.log** statements (Best Practice)

### Low Priority (Future Improvement)
5. **Create utility for cache invalidation** (DRY)
6. **Consider using proper logging library** (Best Practice)

---

## ✅ **CONCLUSION**

Perubahan yang di-push sudah **sangat baik** dan mengikuti prinsip KISS, YAGNI, dan DRY dengan baik. Beberapa area bisa di-improve, tapi secara keseluruhan kode sudah:

- ✅ **Clean dan maintainable**
- ✅ **Mengikuti best practices**
- ✅ **Tidak over-engineered**
- ✅ **Tidak ada fitur yang tidak perlu**
- ✅ **Minimal duplikasi**

**Verdict:** ✅ **APPROVED** - Kode siap untuk production dengan beberapa minor improvements yang bisa dilakukan di masa depan.

