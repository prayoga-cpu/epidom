# Backend Query Analysis - Dashboard App

## 📋 Executive Summary

Analisis komprehensif terhadap backend/query pada dashboard app untuk mengevaluasi:
- ✅ Best practices compliance
- ⚠️ Performance optimization opportunities
- ⚠️ KISS, YAGNI, DRY principle violations

**Status:** Ada beberapa area yang perlu diperbaiki untuk optimalisasi performa dan maintainability.

---

## 🔍 Findings

### 1. ⚠️ **DRY Violation - Duplicate Authorization Checks**

**Problem:**
Setiap API route handler melakukan duplicate checks untuk:
- `getBusinessByUserId(session.user.id)`
- `getStoreById(storeId)`
- Verifikasi store belongs to business

**Impact:**
- Code duplication di 25+ route handlers
- Sulit untuk maintain dan update authorization logic
- Risk of inconsistency jika ada perubahan business rules

**Example:**
```typescript
// Repeated in every route handler
const business = await businessService.getBusinessByUserId(session.user.id);
if (!business) {
  return NextResponse.json(createErrorResponse(...), { status: 404 });
}
const store = await businessService.getStoreById(storeId);
if (!store || store.businessId !== business.id) {
  return NextResponse.json(createErrorResponse(...), { status: 404 });
}
```

**Files Affected:**
- `src/app/api/stores/[id]/materials/route.ts`
- `src/app/api/stores/[id]/suppliers/route.ts`
- `src/app/api/stores/[id]/production-batches/route.ts`
- `src/app/api/stores/[id]/materials/[materialId]/route.ts`
- Dan 20+ file lainnya

**Recommendation:**
- Create middleware/helper function untuk authorization checks
- Extract ke `src/lib/api/auth-helpers.ts` atau Next.js middleware
- Reuse di semua route handlers

---

### 2. ⚠️ **Performance Issue - In-Memory Filtering**

**Problem:**
Material repository melakukan filtering di-memory setelah fetch semua data dari database:

```typescript
// src/lib/repositories/material.repository.ts:84-133
let materials = await this.db.material.findMany({
  where,
  include: { ... },
  orderBy,
});
// No skip/take here - fetches ALL materials

// Apply stock status filter in-memory
if (stockStatus) {
  materials = materials.filter((material) => {
    // Filter logic...
  });
}

// Apply pagination AFTER filtering
const paginatedMaterials = materials.slice(skip, skip + take);
```

**Impact:**
- Fetches semua materials dari database (bisa ribuan records)
- Filtering dilakukan di application layer, bukan database
- Pagination dilakukan setelah filtering (inefficient)
- High memory usage untuk large datasets
- Slow query untuk stores dengan banyak materials

**Recommendation:**
- Move stock status filtering ke database query (jika memungkinkan)
- Atau implement database-level filtering dengan computed columns
- Apply pagination di database level (sudah ada skip/take, tapi tidak digunakan dengan benar)

---

### 3. ⚠️ **Query Key Inconsistency**

**Problem:**
Query keys tidak konsisten antar hooks:

1. **Materials hook** - Uses structured query keys:
   ```typescript
   materialKeys.list(storeId, filters) // ["materials", storeId, "list", filters]
   ```

2. **Products hook** - Uses flat query keys:
   ```typescript
   ["products", storeId, filters] // Flat array
   ```

3. **Dashboard hook** - Hardcodes query keys:
   ```typescript
   ["materials", storeId, "list", undefined] // Hardcoded, doesn't use materialKeys
   ```

**Impact:**
- Cache tidak shared dengan benar antar hooks
- `useDashboardData` tidak bisa reuse cache dari `useMaterials`
- Potential cache invalidation issues
- Harder to maintain query keys

**Example:**
```typescript
// use-dashboard-data.ts:28
{
  queryKey: ["materials", storeId, "list", undefined],
  // Should use: materialKeys.list(storeId, undefined)
}

// use-products.ts:162
{
  queryKey: ["products", storeId, filters],
  // Should use: productKeys.list(storeId, filters)
}
```

**Recommendation:**
- Standardize semua query keys menggunakan factory functions
- Update `useDashboardData` untuk menggunakan query key factories
- Ensure cache sharing antar hooks

---

### 4. ⚠️ **DRY Violation - Duplicate Query Logic**

**Problem:**
`useDashboardData` hook duplikasi query logic instead of reusing hooks:

```typescript
// use-dashboard-data.ts
export function useDashboardData(storeId: string | null) {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["materials", storeId, "list", undefined],
        queryFn: async () => {
          // Duplicate fetch logic from useMaterials
          const response = await fetch(`/api/stores/${storeId}/materials`);
          // ...
        },
      },
      // Similar for suppliers and production batches
    ],
  });
}
```

**Impact:**
- Code duplication
- Jika ada perubahan di API response format, harus update di 2 tempat
- Tidak bisa reuse error handling dari individual hooks
- Maintenance burden

**Recommendation:**
- Refactor `useDashboardData` untuk menggunakan individual hooks
- Atau extract query functions ke shared module
- Reuse existing hooks: `useMaterials()`, `useSuppliers()`, `useProductionBatches()`

---

### 5. ⚠️ **Error Response Inconsistency**

**Problem:**
Tidak konsisten dalam error response format:

1. **Materials route** - Uses `createErrorResponse`:
   ```typescript
   return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
     status: 401,
   });
   ```

2. **Suppliers route** - Uses plain object:
   ```typescript
   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   ```

3. **Production batches route** - Uses plain object:
   ```typescript
   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   ```

**Impact:**
- Client-side error handling menjadi kompleks
- Inconsistent API contract
- Harder to maintain error handling di frontend

**Recommendation:**
- Standardize semua error responses menggunakan `createErrorResponse`
- Atau create middleware untuk error handling
- Ensure consistent error format across all routes

---

### 6. ⚠️ **N+1 Query Potential**

**Problem:**
Beberapa repository queries mungkin memiliki N+1 issues:

1. **Material repository** - Fetches materials dengan suppliers:
   ```typescript
   include: {
     materialSuppliers: {
       include: {
         supplier: {
           select: { id: true, name: true },
         },
       },
     },
   },
   ```
   This is OK - menggunakan include, bukan separate queries.

2. **Recipe repository** - Fetches recipes dengan ingredients:
   ```typescript
   include: {
     ingredients: {
       include: {
         material: {
           select: { ... },
         },
       },
     },
   },
   ```
   This is OK - proper use of includes.

**Status:** ✅ No N+1 issues detected - queries menggunakan proper `include` statements.

---

### 7. ⚠️ **Cache Invalidation - Too Aggressive**

**Problem:**
Cache invalidation mungkin terlalu agresif:

```typescript
// cache-utils.ts:38-65
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["materials", storeId] }),
    queryClient.invalidateQueries({ queryKey: ["suppliers", storeId] }),
    queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) }),
    queryClient.invalidateQueries({ queryKey: ["stock-movements", storeId] }),
    queryClient.invalidateQueries({ queryKey: ["recipes", storeId] }),
  ]);
}
```

**Impact:**
- Setiap material update invalidates 5 different query types
- Bisa menyebabkan unnecessary refetches
- Potential performance impact jika banyak queries aktif

**Recommendation:**
- Review apakah semua invalidations diperlukan
- Consider more granular invalidation
- Atau use optimistic updates instead of invalidation

---

### 8. ✅ **Good Practices Found**

**Positive Findings:**
1. ✅ **Parallel Queries** - `useDashboardData` uses `useQueries` for parallel fetching
2. ✅ **Query Key Factories** - Materials dan suppliers hooks use query key factories
3. ✅ **Cache Utilities** - Centralized cache invalidation utilities
4. ✅ **Transaction Usage** - Proper use of Prisma transactions untuk atomic operations
5. ✅ **Select Specific Fields** - Queries menggunakan `select` untuk fetch hanya fields yang diperlukan
6. ✅ **Promise.all for Parallel Operations** - Repository methods use `Promise.all` untuk parallel queries

---

## 🎯 Recommendations Priority

### High Priority (P0) - Immediate Fix

1. **Extract Authorization Middleware**
   - Create `src/lib/api/auth-helpers.ts`
   - Implement `verifyStoreAccess(userId, storeId)` helper
   - Replace duplicate checks di semua routes

2. **Fix Material Repository Filtering**
   - Move stock status filtering ke database level
   - Implement proper pagination di database
   - Avoid fetching all records untuk filtering

3. **Standardize Query Keys**
   - Update semua hooks untuk menggunakan query key factories
   - Update `useDashboardData` untuk reuse existing hooks
   - Ensure cache sharing

### Medium Priority (P1) - Next Sprint

4. **Standardize Error Responses**
   - Update semua routes untuk menggunakan `createErrorResponse`
   - Create error handling middleware
   - Ensure consistent API contract

5. **Refactor useDashboardData**
   - Reuse existing hooks instead of duplicating logic
   - Extract shared query functions
   - Improve error handling

### Low Priority (P2) - Future Improvement

6. **Optimize Cache Invalidation**
   - Review invalidation strategy
   - Consider optimistic updates
   - Implement more granular invalidation

---

## 📊 Performance Metrics

### Current State:
- **Query Efficiency:** ⚠️ Medium (in-memory filtering issues)
- **Code Duplication:** ⚠️ High (authorization checks, query logic)
- **Cache Efficiency:** ✅ Good (proper use of TanStack Query)
- **Database Queries:** ✅ Good (proper use of includes, no N+1 issues)

### Target State:
- **Query Efficiency:** ✅ High
- **Code Duplication:** ✅ Low
- **Cache Efficiency:** ✅ High
- **Database Queries:** ✅ High

---

## 🔧 Implementation Plan

### Phase 1: Authorization Middleware (2-3 hours)
1. Create `src/lib/api/auth-helpers.ts`
2. Implement `verifyStoreAccess` helper
3. Update 5-10 critical routes sebagai pilot
4. Test authorization flow
5. Rollout ke semua routes

### Phase 2: Material Repository Optimization (3-4 hours)
1. Analyze stock status filtering requirements
2. Implement database-level filtering (jika memungkinkan)
3. Fix pagination logic
4. Test dengan large datasets
5. Monitor performance improvements

### Phase 3: Query Key Standardization (2-3 hours)
1. Create/update query key factories untuk semua resources
2. Update `useDashboardData` untuk menggunakan factories
3. Refactor untuk reuse existing hooks
4. Test cache sharing
5. Verify no cache invalidation issues

### Phase 4: Error Response Standardization (1-2 hours)
1. Update semua routes untuk menggunakan `createErrorResponse`
2. Create error handling middleware (optional)
3. Update frontend error handling
4. Test error scenarios

---

## 📝 Code Examples

### Before (Current):
```typescript
// Duplicate authorization in every route
export async function GET(request: Request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = await businessService.getBusinessByUserId(session.user.id);
  if (!business) {
    return NextResponse.json(createErrorResponse(...), { status: 404 });
  }
  const store = await businessService.getStoreById(storeId);
  if (!store || store.businessId !== business.id) {
    return NextResponse.json(createErrorResponse(...), { status: 404 });
  }
  // ... actual logic
}
```

### After (Recommended):
```typescript
// Reusable authorization helper
import { verifyStoreAccess } from "@/lib/api/auth-helpers";

export async function GET(request: Request, { params }) {
  const session = await getServerSession(authOptions);
  const { id: storeId } = await params;

  const { store, business } = await verifyStoreAccess(
    session?.user?.id,
    storeId
  );

  // ... actual logic
}
```

---

## ✅ Conclusion

**Overall Assessment:**
- ✅ **Architecture:** Good - Clean separation of concerns
- ⚠️ **Code Quality:** Medium - Some DRY violations
- ⚠️ **Performance:** Medium - In-memory filtering issues
- ✅ **Best Practices:** Good - Proper use of TanStack Query, transactions

**Key Improvements Needed:**
1. Extract authorization middleware (DRY)
2. Fix material repository filtering (Performance)
3. Standardize query keys (Maintainability)
4. Standardize error responses (Consistency)

**Estimated Effort:** 8-12 hours untuk implement semua improvements.

---

## 📚 References

- [TanStack Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Next.js API Routes Best Practices](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)

---

**Last Updated:** 2025-01-27
**Reviewed By:** AI Assistant
**Status:** ⚠️ Needs Improvement

