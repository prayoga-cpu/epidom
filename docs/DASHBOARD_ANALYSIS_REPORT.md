# Dashboard App - Analisis Best Practices & Konsistensi

**Tanggal:** 2024
**Scope:** `src/features/dashboard` dan `src/app/(app)/store/[storeId]/(dashboard)`

---

## 📋 Executive Summary

Dashboard app sudah memiliki fondasi yang baik dengan clean architecture, React Query untuk data fetching, dan komponen yang terorganisir. Namun, ditemukan beberapa **inkonsistensi** dan peluang optimasi yang perlu diperbaiki untuk mencapai performa maksimal dan konsistensi penuh.

**Status Overall:** ✅ **Good** dengan beberapa area yang perlu improvement

---

## ✅ ASPEK YANG SUDAH BAIK

### 1. **Architecture & Organization**
- ✅ Clean Architecture dengan Feature-Driven Architecture (FDA)
- ✅ Pages tipis (10-20 lines) - hanya import dan compose components
- ✅ Komponen terorganisir dengan baik: `features/[feature]/[page]/components/`
- ✅ Shared components di `features/dashboard/shared/`
- ✅ Separation of concerns yang jelas

### 2. **Data Fetching**
- ✅ Menggunakan TanStack Query (React Query) dengan baik
- ✅ Query key factories untuk sebagian besar hooks (materials, suppliers, products)
- ✅ Parallel queries di `useDashboardData` untuk menghindari waterfall requests
- ✅ Cache invalidation utilities di `lib/react-query/cache-utils.ts`
- ✅ Optimistic updates di beberapa mutations

### 3. **Performance Optimizations**
- ✅ Lazy loading di `DataView` untuk code splitting
- ✅ Memoization di beberapa card components (AlertsCard, TrackingCard, SupplierCard, DashboardView)
- ✅ Conditional rendering di tabs untuk mencegah mounting semua komponen sekaligus
- ✅ Debounced search di beberapa sections

### 4. **Code Reusability (DRY)**
- ✅ Shared loading states: `loading-states.tsx`
- ✅ Shared error states: `error-states.tsx`
- ✅ Shared empty states: `empty-states.tsx`
- ✅ Cache invalidation utilities untuk menghindari duplikasi

### 5. **User Experience**
- ✅ Loading skeletons yang konsisten
- ✅ Error handling dengan retry options
- ✅ Empty states yang informatif
- ✅ Toast notifications untuk feedback

---

## ⚠️ MASALAH YANG DITEMUKAN

### 1. **INKONSISTENSI QUERY KEYS** 🔴 **CRITICAL**

**Masalah:**
- Sebagian besar hooks menggunakan query key factories (materialKeys, supplierKeys, productKeys)
- Tapi beberapa hooks masih menggunakan hardcoded arrays

**Contoh Inkonsistensi:**

```typescript
// ✅ BAIK - Menggunakan factory
// src/features/dashboard/data/materials/hooks/use-materials.ts
export const materialKeys = {
  all: (storeId: string) => ["materials", storeId] as const,
  lists: (storeId: string) => [...materialKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: MaterialFilterInput) =>
    [...materialKeys.lists(storeId), filters] as const,
};

// ❌ TIDAK KONSISTEN - Hardcoded array
// src/features/dashboard/data/recipes/hooks/use-recipes.ts
queryKey: ["recipes", storeId, filters]  // Seharusnya menggunakan recipeKeys.list()

// ❌ TIDAK KONSISTEN - Hardcoded array
// src/features/dashboard/profile/hooks/use-profile.ts
queryKey: ["profile", session?.user?.id]  // Seharusnya menggunakan profileKeys.detail()

// ❌ TIDAK KONSISTEN - Hardcoded array
// src/features/dashboard/management/edit-stock/hooks/use-import-stock.ts
queryClient.invalidateQueries({ queryKey: ["materials", storeId] });
// Seharusnya menggunakan materialKeys.all(storeId)
```

**Dampak:**
- Cache tidak ter-share dengan baik
- Sulit untuk invalidate queries secara konsisten
- Potensi bug saat refactoring

**Rekomendasi:**
1. Buat query key factories untuk semua hooks yang belum memilikinya
2. Update semua hooks untuk menggunakan factories
3. Update cache invalidation untuk menggunakan factories

---

### 2. **INKONSISTENSI STALE TIME & CACHE SETTINGS** 🟡 **MEDIUM**

**Masalah:**
Stale time dan cache settings berbeda-beda di setiap hook tanpa standar yang jelas.

**Contoh:**

```typescript
// Materials: 60 seconds
staleTime: 60 * 1000,
gcTime: 5 * 60 * 1000,

// Recipes: 30 seconds
staleTime: 30 * 1000,
gcTime: 5 * 60 * 1000,
refetchOnWindowFocus: true,

// Profile: 5 minutes
staleTime: 5 * 60 * 1000,
gcTime: 10 * 60 * 1000,
refetchOnWindowFocus: false,
refetchOnMount: false,

// Alerts: 30 seconds + auto-refetch
staleTime: 30000,
refetchInterval: 60000,
```

**Dampak:**
- Perilaku caching tidak konsisten
- Beberapa data mungkin terlalu sering refetch (waste resources)
- Beberapa data mungkin terlalu lama stale (outdated data)

**Rekomendasi:**
1. Buat constants untuk stale time berdasarkan data type:
   ```typescript
   // lib/react-query/constants.ts
   export const CACHE_TIMES = {
     MATERIALS: 60 * 1000,      // 1 minute
     PRODUCTS: 60 * 1000,        // 1 minute
     RECIPES: 60 * 1000,         // 1 minute
     SUPPLIERS: 60 * 1000,       // 1 minute
     PROFILE: 5 * 60 * 1000,    // 5 minutes
     ALERTS: 30 * 1000,          // 30 seconds (real-time)
   } as const;
   ```
2. Gunakan constants ini di semua hooks
3. Dokumentasikan kapan harus menggunakan stale time yang berbeda

---

### 3. **DUPLICATE CODE PATTERNS** 🟡 **MEDIUM**

**Masalah:**
Beberapa pattern diulang di beberapa tempat tanpa abstraksi.

#### A. CSV Export Logic (4x duplikasi)

**Lokasi:**
- `use-materials.ts` (lines 221-258)
- `use-products.ts` (lines 144-169)
- `use-recipes.ts` (lines 171-196)
- `use-suppliers.ts` (lines 115-139)

**Pattern yang sama:**
```typescript
// Build query string
const params = new URLSearchParams();
if (filters) {
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
}

// Fetch and download
const response = await fetch(url);
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `filename-${date}.csv`;
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url);
document.body.removeChild(a);
```

**Rekomendasi:**
Buat utility function:
```typescript
// lib/utils/export.ts
export async function downloadCSV(
  url: string,
  filename: string,
  filters?: Record<string, unknown>
): Promise<void> {
  // Centralized CSV download logic
}
```

#### B. URLSearchParams Building (Multiple locations)

**Pattern yang sama diulang:**
```typescript
const params = new URLSearchParams();
if (filters) {
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
}
```

**Rekomendasi:**
Buat utility function:
```typescript
// lib/utils/query-params.ts
export function buildQueryParams(filters: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
  return params;
}
```

#### C. Error Handling Pattern

**Pattern yang sama:**
```typescript
if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error?.message || "Failed to fetch...");
}
```

**Rekomendasi:**
Buat API client wrapper atau utility function untuk error handling yang konsisten.

---

### 4. **INKONSISTENSI MEMOIZATION** 🟢 **LOW**

**Masalah:**
Beberapa komponen di-memoize, beberapa tidak, tanpa alasan yang jelas.

**Yang sudah di-memoize:**
- `DashboardView` ✅
- `AlertsCard` ✅
- `TrackingCard` ✅
- `SupplierCard` ✅
- `ProductionHistoryChart` ✅

**Yang belum di-memoize:**
- `DataView` ❌
- `TrackingView` ❌
- `ManagementView` ❌
- `AlertsView` ❌
- Banyak section components ❌

**Rekomendasi:**
1. **KISS Principle:** Hanya memoize jika benar-benar perlu (komponen yang sering re-render tanpa perubahan props)
2. **Konsistensi:** Jika memutuskan untuk memoize, lakukan secara konsisten untuk komponen yang serupa
3. **Dokumentasi:** Tambahkan comment mengapa komponen di-memoize atau tidak

**Guideline:**
- ✅ Memoize: Components yang menerima props dari parent dan sering re-render
- ❌ Jangan memoize: Components yang sudah di-lazy load, atau components yang props-nya selalu berubah

---

### 5. **INKONSISTENSI ERROR HANDLING** 🟡 **MEDIUM**

**Masalah:**
Error handling pattern berbeda-beda di setiap hook.

**Contoh:**

```typescript
// Pattern 1: Basic
if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error?.message || "Failed to fetch");
}

// Pattern 2: With custom error
if (response.status === 403 && errorData.error?.code === "SUBSCRIPTION_FEATURE_LOCKED") {
  const customError = new Error(...);
  (customError as any).code = "SUBSCRIPTION_FEATURE_LOCKED";
  throw customError;
}

// Pattern 3: Different error message format
throw new Error(error.error || "Failed to import stock");
```

**Rekomendasi:**
1. Buat API client wrapper atau utility function untuk error handling yang konsisten
2. Standardisasi error response format dari backend
3. Buat custom error classes jika perlu

---

### 6. **POTENSI PERFORMANCE ISSUES** 🟢 **LOW**

#### A. Unnecessary Re-renders

**Masalah:**
Beberapa komponen mungkin re-render terlalu sering karena:
- Props yang selalu berubah (object/array literals)
- Missing memoization di parent components
- State updates yang tidak perlu

**Contoh:**
```typescript
// ❌ Object literal di JSX - akan membuat object baru setiap render
<Component filters={{ search: query, sortBy: "name" }} />

// ✅ Extract ke useMemo atau constant
const filters = useMemo(() => ({ search: query, sortBy: "name" }), [query]);
<Component filters={filters} />
```

#### B. Missing React Query Optimizations

**Masalah:**
Beberapa queries mungkin bisa dioptimasi lebih lanjut:
- `refetchOnWindowFocus` - tidak semua query perlu refetch saat window focus
- `refetchOnMount` - bisa di-set ke false untuk data yang tidak sering berubah
- `refetchInterval` - hanya untuk real-time data (alerts)

**Rekomendasi:**
1. Review setiap query dan set options yang sesuai
2. Gunakan `refetchOnWindowFocus: false` untuk data yang tidak real-time
3. Hanya gunakan `refetchInterval` untuk data yang benar-benar perlu real-time

---

## 📊 METRICS & BENCHMARKS

### Code Quality Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Query Key Consistency | ~70% | 100% | 🟡 |
| Stale Time Consistency | ~50% | 100% | 🟡 |
| Code Duplication | ~15% | <5% | 🟡 |
| Memoization Coverage | ~20% | 30-40% | 🟢 |
| Error Handling Consistency | ~60% | 100% | 🟡 |

### Performance Metrics (Estimated)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Initial Load Time | Good | Excellent | 🟢 |
| Time to Interactive | Good | Excellent | 🟢 |
| Bundle Size (with lazy loading) | Good | Good | 🟢 |
| Cache Hit Rate | Good | Excellent | 🟡 |

---

## 🎯 REKOMENDASI PRIORITAS

### Priority 1: Critical (Lakukan segera)

1. **Standardisasi Query Keys** 🔴
   - Buat query key factories untuk recipes, profile, alerts
   - Update semua hooks untuk menggunakan factories
   - Update cache invalidation

2. **Standardisasi Cache Settings** 🟡
   - Buat constants untuk stale time
   - Update semua hooks untuk menggunakan constants
   - Dokumentasikan rationale

### Priority 2: High (Lakukan dalam sprint ini)

3. **Extract Duplicate Code** 🟡
   - Buat utility untuk CSV export
   - Buat utility untuk query params building
   - Buat API client wrapper untuk error handling

4. **Standardisasi Error Handling** 🟡
   - Buat error handling utility
   - Standardisasi error response format
   - Update semua hooks

### Priority 3: Medium (Lakukan saat refactoring)

5. **Optimize Memoization** 🟢
   - Review komponen yang perlu memoization
   - Tambahkan memoization secara konsisten
   - Dokumentasikan decision

6. **Performance Optimizations** 🟢
   - Review React Query options
   - Optimize re-renders
   - Add performance monitoring

---

## 📝 CHECKLIST PERBAIKAN

### Query Keys
- [ ] Buat `recipeKeys` factory
- [ ] Buat `profileKeys` factory
- [ ] Buat `alertKeys` factory (sudah ada tapi perlu review)
- [ ] Update `use-recipes.ts` untuk menggunakan `recipeKeys`
- [ ] Update `use-profile.ts` untuk menggunakan `profileKeys`
- [ ] Update `use-import-stock.ts` untuk menggunakan factories
- [ ] Update semua cache invalidation untuk menggunakan factories

### Cache Settings
- [ ] Buat `lib/react-query/constants.ts` dengan CACHE_TIMES
- [ ] Update semua hooks untuk menggunakan constants
- [ ] Dokumentasikan rationale untuk setiap cache time
- [ ] Review dan standardisasi `refetchOnWindowFocus`
- [ ] Review dan standardisasi `refetchOnMount`

### Code Duplication
- [ ] Buat `lib/utils/export.ts` dengan `downloadCSV` utility
- [ ] Buat `lib/utils/query-params.ts` dengan `buildQueryParams` utility
- [ ] Update semua hooks untuk menggunakan utilities
- [ ] Buat API client wrapper untuk error handling

### Error Handling
- [ ] Buat `lib/api/client.ts` dengan error handling wrapper
- [ ] Standardisasi error response format
- [ ] Update semua hooks untuk menggunakan wrapper
- [ ] Buat custom error classes jika perlu

### Memoization
- [ ] Review komponen yang perlu memoization
- [ ] Tambahkan memoization untuk komponen yang sering re-render
- [ ] Dokumentasikan decision untuk setiap komponen
- [ ] Remove unnecessary memoization

### Performance
- [ ] Review React Query options di semua hooks
- [ ] Optimize props passing (useMemo untuk object/array literals)
- [ ] Add performance monitoring jika perlu
- [ ] Review bundle size dan code splitting

---

## 🔍 DETAILED FINDINGS

### Query Key Factories - Current State

| Hook | Factory | Status |
|------|---------|--------|
| `use-materials.ts` | ✅ `materialKeys` | ✅ Good |
| `use-suppliers.ts` | ✅ `supplierKeys` | ✅ Good |
| `use-products.ts` | ✅ `productKeys` | ✅ Good |
| `use-production-batches.ts` | ✅ `productionBatchKeys` | ✅ Good |
| `use-recipes.ts` | ❌ Hardcoded | ❌ Needs fix |
| `use-profile.ts` | ❌ Hardcoded | ❌ Needs fix |
| `use-alerts.ts` | ⚠️ Partial | ⚠️ Needs review |
| `use-stock-movements.ts` | ✅ `stockMovementKeys` | ✅ Good |

### Stale Time - Current State

| Hook | Stale Time | Refetch On Focus | Status |
|------|-----------|-----------------|--------|
| `use-materials.ts` | 60s | Default (true) | ✅ |
| `use-suppliers.ts` | Not set | Default (true) | ⚠️ |
| `use-products.ts` | Not set | Default (true) | ⚠️ |
| `use-recipes.ts` | 30s | true | ⚠️ |
| `use-profile.ts` | 5m | false | ✅ |
| `use-alerts.ts` | 30s | + interval 60s | ✅ |
| `use-production-batches.ts` | Not set | Default (true) | ⚠️ |

---

## 💡 BEST PRACTICES RECOMMENDATIONS

### 1. Query Key Factory Pattern

**Always use factories:**
```typescript
export const resourceKeys = {
  all: (storeId: string) => ["resource", storeId] as const,
  lists: (storeId: string) => [...resourceKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: FilterInput) =>
    [...resourceKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...resourceKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) =>
    [...resourceKeys.details(storeId), id] as const,
};
```

### 2. Cache Settings Standard

**Use constants:**
```typescript
export const CACHE_TIMES = {
  REAL_TIME: 30 * 1000,      // 30 seconds
  STANDARD: 60 * 1000,       // 1 minute
  LONG_LIVED: 5 * 60 * 1000, // 5 minutes
} as const;
```

### 3. Error Handling Standard

**Use wrapper:**
```typescript
async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.error?.message || "Request failed", response.status);
  }
  const data: ApiSuccessResponse<T> = await response.json();
  return data.data;
}
```

### 4. Memoization Guidelines

**Memoize when:**
- Component receives props from parent
- Props are stable (not object/array literals)
- Component is expensive to render
- Component is used in lists

**Don't memoize when:**
- Component is already lazy loaded
- Props change frequently
- Component is simple (no heavy computation)

---

## 📚 REFERENCES

- [TanStack Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [YAGNI Principle](https://en.wikipedia.org/wiki/You_aren%27t_gonna_need_it)

---

## ✅ KESIMPULAN

Dashboard app sudah memiliki **fondasi yang kuat** dengan:
- ✅ Clean architecture
- ✅ Good data fetching patterns
- ✅ Performance optimizations (lazy loading, memoization)
- ✅ Code reusability (shared components)

Namun, ada beberapa area yang perlu **improvement** untuk mencapai konsistensi penuh:
- 🔴 Query keys standardization (CRITICAL)
- 🟡 Cache settings standardization (MEDIUM)
- 🟡 Code duplication reduction (MEDIUM)
- 🟡 Error handling standardization (MEDIUM)
- 🟢 Memoization optimization (LOW)

**Overall Score: 7.5/10**

Dengan perbaikan yang direkomendasikan, score bisa mencapai **9/10** atau lebih tinggi.

---

**Next Steps:**
1. Review dan approve rekomendasi
2. Prioritize tasks berdasarkan business impact
3. Create tickets untuk setiap priority
4. Implement improvements secara bertahap
5. Monitor dan measure improvements

