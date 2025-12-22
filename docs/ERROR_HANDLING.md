# Error Handling

## Overview

EPIDOM uses a comprehensive error handling system with typed errors and consistent API responses.

---

## Error Classes

All application errors extend the base `AppError` class:

```typescript
// src/lib/errors/index.ts

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### Available Error Classes

| Class                     | Status | Use Case             |
| ------------------------- | ------ | -------------------- |
| `UnauthorizedError`       | 401    | Not authenticated    |
| `ForbiddenError`          | 403    | Not authorized       |
| `NotFoundError`           | 404    | Resource not found   |
| `ValidationError`         | 400    | Invalid input        |
| `ConflictError`           | 409    | Duplicate resource   |
| `StoreLimitExceededError` | 403    | Plan limit reached   |
| `InsufficientStockError`  | 400    | Not enough inventory |
| `DatabaseError`           | 503    | DB connection issue  |
| `RateLimitExceededError`  | 429    | Too many requests    |

---

## Throwing Errors

### In Services

```typescript
// src/lib/services/material.service.ts
async createMaterial(input: CreateMaterialInput) {
  const exists = await this.repo.existsBySku(input.storeId, input.sku);
  if (exists) {
    throw new DuplicateError('Material', 'SKU', input.sku);
  }

  return this.repo.create(input);
}
```

### In Repositories

```typescript
async findById(id: string) {
  const material = await this.db.material.findUnique({ where: { id } });
  if (!material) {
    throw new NotFoundError('Material', id);
  }
  return material;
}
```

---

## Central Error Handler

All API routes use `handleApiError` for consistent responses:

```typescript
// src/lib/utils/api-error-handler.ts
export function handleApiError(error: unknown, options: ErrorHandlerOptions) {
  // Handle typed AppError
  if (error instanceof AppError) {
    return NextResponse.json(createErrorResponse(error.code, error.message, error.details), {
      status: error.statusCode,
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Invalid input", error.errors),
      { status: 400 }
    );
  }

  // Handle unknown errors
  logger.error("Unexpected error", error);
  return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An error occurred"), {
    status: 500,
  });
}
```

---

## API Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A material with this SKU already exists",
    "details": {
      "resource": "Material",
      "field": "SKU",
      "value": "FLOUR-001"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Error Codes Reference

| Code                          | HTTP | Description                |
| ----------------------------- | ---- | -------------------------- |
| `UNAUTHORIZED`                | 401  | Not authenticated          |
| `FORBIDDEN`                   | 403  | Access denied              |
| `NOT_FOUND`                   | 404  | Resource not found         |
| `VALIDATION_ERROR`            | 400  | Invalid input              |
| `CONFLICT`                    | 409  | Resource conflict          |
| `RATE_LIMIT_EXCEEDED`         | 429  | Too many requests          |
| `INSUFFICIENT_STOCK`          | 400  | Not enough inventory       |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 403  | Plan limit reached         |
| `SUBSCRIPTION_REQUIRED`       | 403  | Active subscription needed |
| `DATABASE_ERROR`              | 503  | Database issue             |
| `INTERNAL_ERROR`              | 500  | Unexpected error           |

---

## Client-Side Error Handling

```typescript
// In React components
import { toast } from "sonner";

const mutation = useMutation({
  mutationFn: createMaterial,
  onError: (error) => {
    if (error instanceof Error) {
      toast.error(error.message);
    }
  },
});
```

---

## Logging

Errors are logged with context:

```typescript
// Only 5xx errors are logged to prevent noise
if (error.statusCode >= 500) {
  logger.error(`${error.name} at ${endpoint}`, error, context);
}
```
