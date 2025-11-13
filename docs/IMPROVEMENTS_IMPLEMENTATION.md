# Backend Query Improvements - Implementation Guide

## 📋 Overview

Dokumen ini menjelaskan implementasi improvements yang direkomendasikan berdasarkan analisis backend query.

---

## ✅ Completed Improvements

### 1. Authorization Helper Created

**File:** `src/lib/api/auth-helpers.ts`

**Purpose:**
- Centralized authorization logic
- Reduces code duplication (DRY)
- Consistent error handling

**Usage Example:**

```typescript
// Before (Duplicate in every route)
export async function GET(request: Request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(...), { status: 401 });
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

// After (Using auth helper)
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

export async function GET(request: Request, { params }) {
  try {
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    // Extract store and business from result
    const { store, business, userId: verifiedUserId } = result;

    // ... actual logic
  } catch (error) {
    // Handle errors
  }
}
```

**Benefits:**
- ✅ Reduces code duplication by ~15 lines per route
- ✅ Consistent error handling
- ✅ Single source of truth for authorization logic
- ✅ Easier to maintain and update

---

### 2. Query Key Standardization

**File:** `src/features/dashboard/dashboard/hooks/use-dashboard-data.ts`

**Improvements:**
- ✅ Uses `materialKeys.list()` factory function
- ✅ Uses `supplierKeys.list()` factory function
- ✅ Consistent query key structure
- ✅ Proper cache sharing with individual hooks

**Before:**
```typescript
{
  queryKey: ["materials", storeId, "list", undefined], // Hardcoded
  // ...
}
```

**After:**
```typescript
{
  queryKey: materialKeys.list(storeId!, materialFilters), // Factory function
  // ...
}
```

**Benefits:**
- ✅ Cache sharing dengan individual hooks
- ✅ Consistent query key structure
- ✅ Easier to maintain
- ✅ No cache invalidation issues

---

## 🚧 Recommended Next Steps

### Phase 1: Update Routes to Use Auth Helper (2-3 hours)

**Priority:** High

**Steps:**
1. Update critical routes first (materials, suppliers, production-batches)
2. Test authorization flow
3. Update remaining routes
4. Remove duplicate authorization code

**Example Route Update:**

```typescript
// src/app/api/stores/[id]/materials/route.ts
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Get authenticated user
    const userId = await getAuthenticatedUserId();

    // Verify store access
    const result = await verifyStoreAccessFromRequest(userId, params);
    if (result instanceof NextResponse) {
      return result; // Error response
    }

    const { store, business } = result;
    const { id: storeId } = await params;

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filters = materialFilterSchema.parse({
      // ... filter parsing
    });

    // Get materials with filters
    const result = await materialService.getMaterials(storeId, filters);

    return NextResponse.json(createSuccessResponse(result));
  } catch (error) {
    // Error handling
  }
}
```

---

### Phase 2: Fix Material Repository Filtering (3-4 hours)

**Priority:** High

**Problem:**
Material repository fetches all materials, then filters in-memory, then paginates.

**Current Implementation:**
```typescript
// src/lib/repositories/material.repository.ts
let materials = await this.db.material.findMany({
  where,
  include: { ... },
  orderBy,
  // No skip/take - fetches ALL materials
});

// Apply stock status filter in-memory
if (stockStatus) {
  materials = materials.filter((material) => {
    // Filter logic...
  });
}

// Apply pagination AFTER filtering
const paginatedMaterials = materials.slice(skip, skip + take);
```

**Recommended Solution:**

**Option 1: Database-level filtering (Recommended)**
```typescript
// Use Prisma raw query or computed columns for stock status
// This requires database schema changes or raw queries

const where: Prisma.MaterialWhereInput = {
  storeId,
  isActive: true,
  // Add stock status filtering at database level
  ...(stockStatus === "out_of_stock" && {
    currentStock: { lte: 0 },
  }),
  ...(stockStatus === "low_stock" && {
    currentStock: {
      gt: 0,
      lte: prisma.raw(`min_stock`), // Requires raw query
    },
  }),
  // ... other filters
};

const [materials, total] = await Promise.all([
  this.db.material.findMany({
    where,
    include: { ... },
    orderBy,
    skip,
    take, // Apply pagination at database level
  }),
  this.db.material.count({ where }),
]);
```

**Option 2: Two-step approach (Easier, but still suboptimal)**
```typescript
// Step 1: Apply stock status filter in where clause (if possible)
// Step 2: Fetch with pagination
// Step 3: Filter remaining stock status in-memory (if needed)

// This is a compromise - better than current, but not optimal
```

**Option 3: Accept limitation (Current)**
```typescript
// If stock status filtering is complex and cannot be done at DB level,
// document the limitation and accept it
// But still apply pagination at DB level for other filters

// Apply pagination for non-stock-status filters
const materials = await this.db.material.findMany({
  where: {
    storeId,
    isActive: true,
    // ... other filters (excluding stockStatus)
  },
  include: { ... },
  orderBy,
  skip,
  take,
});

// Then filter stock status in-memory (smaller dataset)
const filteredMaterials = stockStatus
  ? materials.filter((material) => {
      // Filter logic...
    })
  : materials;
```

**Recommendation:**
- Start with Option 3 (quick win)
- Plan for Option 1 (long-term solution)
- Monitor performance dengan large datasets

---

### Phase 3: Standardize Error Responses (1-2 hours)

**Priority:** Medium

**Problem:**
Inconsistent error response format across routes.

**Current State:**
- Materials route: Uses `createErrorResponse`
- Suppliers route: Uses plain `{ error: ... }`
- Production batches route: Uses plain `{ error: ... }`

**Recommended Solution:**

**Update all routes to use `createErrorResponse`:**

```typescript
// Standardized error response
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

// Success
return NextResponse.json(createSuccessResponse(data));

// Errors
return NextResponse.json(
  createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
  { status: 401 }
);

return NextResponse.json(
  createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Invalid input", errors),
  { status: 400 }
);
```

**Benefits:**
- ✅ Consistent API contract
- ✅ Easier client-side error handling
- ✅ Better error tracking
- ✅ Type-safe error responses

---

### Phase 4: Create Production Batch Query Key Factory (1 hour)

**Priority:** Low

**Problem:**
Production batches hook uses flat query keys instead of factory function.

**Current:**
```typescript
queryKey: ["production-batches", storeId, filters]
```

**Recommended:**
```typescript
// src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts
export const productionBatchKeys = {
  all: (storeId: string) => ["production-batches", storeId] as const,
  lists: (storeId: string) => [...productionBatchKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: ProductionBatchFilterInput) =>
    [...productionBatchKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...productionBatchKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...productionBatchKeys.details(storeId), id] as const,
};

// Usage
export function useProductionBatches(storeId: string, filters: ProductionBatchFilterInput) {
  return useQuery({
    queryKey: productionBatchKeys.list(storeId, filters),
    queryFn: () => fetchProductionBatches(storeId, filters),
    enabled: !!storeId,
  });
}
```

**Then update useDashboardData:**
```typescript
{
  queryKey: productionBatchKeys.list(storeId!, productionBatchFilters),
  // ...
}
```

---

## 📊 Performance Impact

### Expected Improvements:

1. **Authorization Checks:**
   - **Before:** 15-20 lines per route × 25 routes = 375-500 lines of duplicate code
   - **After:** 1-2 lines per route × 25 routes = 25-50 lines + 1 helper file
   - **Reduction:** ~90% code reduction

2. **Query Cache Sharing:**
   - **Before:** Dashboard queries don't share cache with individual hooks
   - **After:** Dashboard queries share cache with individual hooks
   - **Impact:** Reduced API calls, faster page loads

3. **Material Repository:**
   - **Before:** Fetches all materials, filters in-memory, paginates
   - **After:** Pagination at database level (even with in-memory filtering)
   - **Impact:** Reduced memory usage, faster queries for large datasets

---

## 🧪 Testing Checklist

### Authorization Helper:
- [ ] Test with authenticated user
- [ ] Test with unauthenticated user
- [ ] Test with user without business
- [ ] Test with user accessing wrong store
- [ ] Test with valid store access

### Query Key Standardization:
- [ ] Test cache sharing between dashboard and individual hooks
- [ ] Test cache invalidation
- [ ] Test query refetching
- [ ] Test with different filter combinations

### Material Repository:
- [ ] Test with small dataset (< 100 materials)
- [ ] Test with large dataset (> 1000 materials)
- [ ] Test pagination
- [ ] Test stock status filtering
- [ ] Test performance with large datasets

### Error Responses:
- [ ] Test error response format
- [ ] Test client-side error handling
- [ ] Test error tracking

---

## 📝 Notes

1. **Backward Compatibility:**
   - Auth helper is backward compatible
   - Can be adopted gradually
   - No breaking changes

2. **Performance Considerations:**
   - Material repository filtering is the biggest performance concern
   - Consider database indexing for stock status queries
   - Monitor query performance dengan large datasets

3. **Future Improvements:**
   - Consider implementing database-level stock status filtering
   - Consider implementing query result caching (Redis)
   - Consider implementing API rate limiting
   - Consider implementing query batching middleware

---

## 🚀 Quick Start

### Step 1: Update One Route (Pilot)
```bash
# Update materials route to use auth helper
# Test thoroughly
# Then rollout to other routes
```

### Step 2: Test Query Key Standardization
```bash
# Verify cache sharing works
# Test dashboard and individual hooks
# Verify no cache invalidation issues
```

### Step 3: Monitor Performance
```bash
# Monitor query performance
# Check memory usage
# Check API response times
```

---

## 📚 References

- [Authorization Helper](../src/lib/api/auth-helpers.ts)
- [Backend Query Analysis](./BACKEND_QUERY_ANALYSIS.md)
- [TanStack Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)

---

**Last Updated:** 2025-01-27
**Status:** ✅ Ready for Implementation
**Estimated Effort:** 8-12 hours total

