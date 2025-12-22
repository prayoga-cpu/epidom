# Architecture Refactoring Plan: API Routes & Error Handling

> **Date Created**: 2025-12-22
> **Priority**: Medium
> **Estimated Effort**: 4-6 hours
> **Risk Level**: Low (non-breaking changes)

---

## 📋 Executive Summary

This plan addresses two architectural issues identified during code review:

1. **Mixed Concerns in API Routes** - Some routes contain business logic that should be in services
2. **Inconsistent Error Handling** - Two different patterns used across routes

---

## 🔍 Current State Analysis

### Issue 1: Mixed Concerns in API Routes

**Problem**: Some API routes contain business logic instead of pure delegation to services.

| Route                               | Issue                                                    | Severity  |
| ----------------------------------- | -------------------------------------------------------- | --------- |
| `POST /api/stores`                  | Auto-creates business if missing (lines 45-56)           | 🔴 High   |
| `POST /api/stores`                  | Manual store limit error handling (lines 67-83)          | 🔴 High   |
| `GET/PATCH/DELETE /api/stores/[id]` | Manual auth + ownership check (not using withApiHandler) | 🟡 Medium |

### Issue 2: Inconsistent Error Handling Patterns

**Two patterns currently in use:**

#### Pattern A: `withApiHandler` wrapper (PREFERRED ✅)

```typescript
// Used in: materials, products, recipes, subscriptions
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const result = await service.getData(storeId!);
    return NextResponse.json(createSuccessResponse(result));
  },
  { requireStoreAuth: true }
);
```

#### Pattern B: Manual try-catch (DEPRECATED ❌)

```typescript
// Used in: /api/stores/[id]/route.ts
export async function GET(request, { params }) {
  let session = null;
  try {
    session = await getSession();
    if (!session?.user?.id) { /* manual 401 */ }
    await verifyStoreOwnership(...);
    // ... logic
  } catch (error) {
    return handleApiError(error, { ... });
  }
}
```

---

## 🎯 Target State

### Principle 1: API Routes = Pure Delegation

```
API Route responsibilities:
✅ Parse request body/params
✅ Validate input with Zod
✅ Call service method (SINGLE call)
✅ Return standardized response

API Route should NOT:
❌ Contain business logic
❌ Make multiple service calls with conditional logic
❌ Handle errors manually (use withApiHandler)
```

### Principle 2: Consistent Error Handling via Typed Errors

```
┌────────────────┐     throws      ┌──────────────────┐
│    Service     │ ──────────────> │   Typed Error    │
└────────────────┘                 └──────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────┐
                    │          handleApiError()            │
                    │  Maps typed errors to HTTP responses │
                    └──────────────────────────────────────┘
```

---

## 📁 Implementation Plan

### Phase 1: Create Typed Error Classes (30 mins)

**File: `src/lib/errors/index.ts`** (NEW)

```typescript
/**
 * Custom Application Errors
 *
 * These errors are thrown by services and automatically mapped
 * to appropriate HTTP responses by handleApiError().
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ============================================
// Authentication & Authorization Errors
// ============================================

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, "FORBIDDEN", 403);
  }
}

// ============================================
// Resource Errors
// ============================================

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      "NOT_FOUND",
      404,
      { resource, id }
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
  }
}

// ============================================
// Business Logic Errors
// ============================================

export class StoreLimitExceededError extends AppError {
  constructor(current: number, limit: number) {
    super(
      `Store limit exceeded. You have ${current}/${limit} stores. Please upgrade your plan.`,
      "STORE_LIMIT_EXCEEDED",
      403,
      { current, limit, upgradeRequired: true }
    );
  }
}

export class ProductLimitExceededError extends AppError {
  constructor(current: number, limit: number) {
    super(
      `Product limit exceeded. You have ${current}/${limit} products.`,
      "PRODUCT_LIMIT_EXCEEDED",
      403,
      { current, limit, upgradeRequired: true }
    );
  }
}

export class InsufficientStockError extends AppError {
  constructor(materialName: string, required: number, available: number) {
    super(
      `Insufficient stock for '${materialName}'. Required: ${required}, Available: ${available}`,
      "INSUFFICIENT_STOCK",
      400,
      { materialName, required, available }
    );
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(feature: string) {
    super(`Active subscription required to access ${feature}`, "SUBSCRIPTION_REQUIRED", 403, {
      feature,
    });
  }
}

// ============================================
// Validation Errors
// ============================================

export class ValidationError extends AppError {
  constructor(message: string, fields?: Array<{ field: string; message: string }>) {
    super(message, "VALIDATION_ERROR", 400, { fields });
  }
}
```

---

### Phase 2: Update handleApiError to Handle Typed Errors (20 mins)

**File: `src/lib/utils/api-error-handler.ts`** (MODIFY)

Add this at the TOP of the function, before ZodError handling:

```typescript
import {
  AppError,
  NotFoundError,
  StoreLimitExceededError,
  // ... other errors
} from "@/lib/errors";

export function handleApiError(error: unknown, options: ErrorHandlerOptions): NextResponse {
  const { endpoint, context = {}, customMessages = {} } = options;

  // ========================================
  // Handle Typed Application Errors (NEW)
  // ========================================
  if (error instanceof AppError) {
    // Log non-client errors
    if (error.statusCode >= 500) {
      logger.error(`${error.name} at ${endpoint}`, error, context);
    }

    return NextResponse.json(
      createErrorResponse(error.code as ApiErrorCode, error.message, error.details),
      { status: error.statusCode }
    );
  }

  // ... rest of existing logic (ZodError, string matching, etc.)
}
```

---

### Phase 3: Refactor businessService.createStore (30 mins)

**File: `src/lib/services/business.service.ts`** (MODIFY)

Create a new unified method that handles all logic:

```typescript
import {
  StoreLimitExceededError,
  NotFoundError
} from "@/lib/errors";

/**
 * Create a store for user, auto-creating business if needed.
 *
 * This is the preferred method for creating stores as it:
 * 1. Auto-creates business if missing (better UX)
 * 2. Checks store limits internally
 * 3. Throws typed errors for proper HTTP response mapping
 */
async createStoreForUser(
  userId: string,
  input: CreateStoreInput
): Promise<Store> {
  // 1. Get or create business
  let business = await businessRepository.findByUserId(userId);

  if (!business) {
    business = await businessRepository.create({
      userId,
      name: "My Business",
      currency: "EUR",
      timezone: "UTC",
      locale: "en",
    });
  }

  // 2. Check store limit
  const storeCheck = await subscriptionService.canCreateStore(userId);

  if (!storeCheck.allowed) {
    throw new StoreLimitExceededError(storeCheck.current, storeCheck.limit);
  }

  // 3. Create store
  return this.createStore(business.id, userId, input);
}
```

---

### Phase 4: Refactor /api/stores/route.ts POST (15 mins)

**File: `src/app/api/stores/route.ts`** (MODIFY)

BEFORE (current - 50 lines):

```typescript
export const POST = withApiHandler(async (request, { userId }) => {
  // ... 40+ lines of business logic
});
```

AFTER (clean - 10 lines):

```typescript
/**
 * POST /api/stores
 * Create a new store. Auto-creates business if needed.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = createStoreSchema.parse(body);

    // Single service call - all logic handled internally
    const store = await businessService.createStoreForUser(userId, input);

    return NextResponse.json(createSuccessResponse(store), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores" }
);
```

---

### Phase 5: Migrate /api/stores/[id]/route.ts to withApiHandler (30 mins)

**File: `src/app/api/stores/[id]/route.ts`** (MODIFY)

BEFORE (manual pattern):

```typescript
export async function GET(request, { params }) {
  let session = null;
  try {
    session = await getSession();
    if (!session?.user?.id) { /* ... */ }
    await verifyStoreOwnership(id, session.user.id);
    // ...
  } catch (error) {
    return handleApiError(error, { ... });
  }
}
```

AFTER (withApiHandler):

```typescript
/**
 * GET /api/stores/[id]
 * Get a single store by ID.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const store = await businessService.getStoreById(storeId!);

    if (!store) {
      throw new NotFoundError("Store", storeId);
    }

    return NextResponse.json(createSuccessResponse(store));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true, // Handles ownership verification
  }
);

/**
 * PATCH /api/stores/[id]
 * Update a store.
 */
export const PATCH = withApiHandler(
  async (request, { userId, storeId }) => {
    const body = await request.json();
    const input = createStoreSchema.partial().parse(body);

    const updatedStore = await businessService.updateStoreForUser(storeId!, userId, input);

    return NextResponse.json(createSuccessResponse(updatedStore));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]
 * Delete a store.
 */
export const DELETE = withApiHandler(
  async (request, { userId, storeId }) => {
    await businessService.deleteStoreForUser(storeId!, userId);

    return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);
```

---

### Phase 6: Update businessService for Simplified Methods (20 mins)

**File: `src/lib/services/business.service.ts`** (MODIFY)

Add these simplified methods that handle business lookup internally:

```typescript
/**
 * Update store for user (handles business lookup internally)
 */
async updateStoreForUser(
  storeId: string,
  userId: string,
  input: UpdateStoreInput
): Promise<Store> {
  const business = await businessRepository.findByUserId(userId);

  if (!business) {
    throw new NotFoundError("Business");
  }

  return this.updateStore(storeId, business.id, userId, input);
}

/**
 * Delete store for user (handles business lookup internally)
 */
async deleteStoreForUser(storeId: string, userId: string): Promise<void> {
  const business = await businessRepository.findByUserId(userId);

  if (!business) {
    throw new NotFoundError("Business");
  }

  return this.deleteStore(storeId, business.id, userId);
}
```

---

## 📊 Files to Modify

| File                                   | Action | Priority  |
| -------------------------------------- | ------ | --------- |
| `src/lib/errors/index.ts`              | CREATE | 🔴 High   |
| `src/lib/utils/api-error-handler.ts`   | MODIFY | 🔴 High   |
| `src/lib/services/business.service.ts` | MODIFY | 🔴 High   |
| `src/app/api/stores/route.ts`          | MODIFY | 🔴 High   |
| `src/app/api/stores/[id]/route.ts`     | MODIFY | 🟡 Medium |

---

## ✅ Success Criteria

After implementation:

1. **All API routes use `withApiHandler`** - No more manual try-catch patterns
2. **API routes are < 15 lines** - Pure delegation, no business logic
3. **Services throw typed errors** - `StoreLimitExceededError`, `NotFoundError`, etc.
4. **handleApiError maps typed errors** - Consistent HTTP responses

---

## 🧪 Testing Checklist

After refactoring, verify these scenarios still work:

- [ ] Create store when business doesn't exist → Business auto-created
- [ ] Create store when at limit → 403 with `upgradeRequired: true`
- [ ] Get store that doesn't exist → 404
- [ ] Update store without ownership → 403
- [ ] Delete store → Success + image cleanup

---

## 📈 Benefits After Refactoring

| Metric                              | Before | After |
| ----------------------------------- | ------ | ----- |
| Lines of code in `/api/stores` POST | 50     | 10    |
| Patterns for error handling         | 2      | 1     |
| Testability of business logic       | Medium | High  |
| Consistency across routes           | Low    | High  |

---

## 🚀 Quick Start

To begin implementation, run these commands:

```bash
# 1. Create errors module
mkdir -p src/lib/errors
touch src/lib/errors/index.ts

# 2. After each change, verify build
pnpm build

# 3. Test the refactored endpoints
curl -X POST http://localhost:3000/api/stores ...
```

---

## 📝 Notes

- This is a LOW-RISK refactoring as we're not changing behavior, only organization
- Keep existing tests passing (if any)
- Can be done incrementally - one route at a time
- Backward compatible - old routes will still work during migration
