# 📘 EPIDOM Technical Blueprint & Standards

> **Version**: 1.0.0
> **Last Updated**: 2025-12-22
> **Purpose**: Define implementation standards for 100% consistency

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Patterns](#2-architecture-patterns)
3. [File Naming Conventions](#3-file-naming-conventions)
4. [API Route Standards](#4-api-route-standards)
5. [Service Layer Standards](#5-service-layer-standards)
6. [Repository Layer Standards](#6-repository-layer-standards)
7. [Validation Schema Standards](#7-validation-schema-standards)
8. [Component Standards](#8-component-standards)
9. [Hook Standards](#9-hook-standards)
10. [Error Handling Standards](#10-error-handling-standards)
11. [Type Definition Standards](#11-type-definition-standards)
12. [Documentation Standards](#12-documentation-standards)
13. [Consistency Checklist](#13-consistency-checklist)
14. [Migration Guide](#14-migration-guide)

---

## 1. Project Overview

### Tech Stack

```
Framework:    Next.js 16 (App Router)
Language:     TypeScript 5.x (strict mode)
Database:     PostgreSQL (Neon) + Prisma 6.x
Auth:         Better Auth
Payments:     Stripe
State:        TanStack Query 5.x
Forms:        React Hook Form + Zod
UI:           Tailwind CSS 4 + shadcn/ui
```

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected routes
│   ├── (marketing)/       # Public routes
│   └── api/               # API routes
├── components/            # Shared components
│   ├── ui/               # shadcn primitives
│   ├── providers/        # Context providers
│   └── shared/           # Shared components
├── features/             # Feature modules (FDA)
│   └── [feature]/
│       ├── components/   # Feature components
│       ├── hooks/        # Feature hooks
│       └── [subfeature]/
├── lib/                  # Core utilities
│   ├── repositories/     # Data access layer
│   ├── services/         # Business logic layer
│   ├── validation/       # Zod schemas
│   ├── utils/            # Utility functions
│   └── errors/           # Typed errors
├── config/               # Configuration files
├── locales/              # i18n translations
├── types/                # TypeScript types
└── hooks/                # Global hooks
```

---

## 2. Architecture Patterns

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│                  withApiHandler HOF                          │
├─────────────────────────────────────────────────────────────┤
│                   Service Layer                              │
│              Business Logic & Validation                     │
├─────────────────────────────────────────────────────────────┤
│                  Repository Layer                            │
│               Data Access & Prisma                           │
├─────────────────────────────────────────────────────────────┤
│                    Prisma ORM                                │
│                  PostgreSQL (Neon)                           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Request → API Route → Service → Repository → Database
                ↓          ↓          ↓
            Validation  Business   Prisma
            (Zod)       Logic      Query
```

---

## 3. File Naming Conventions

### General Rules

| Type             | Format                   | Example                  |
| ---------------- | ------------------------ | ------------------------ |
| **Components**   | `kebab-case.tsx`         | `material-form.tsx`      |
| **Hooks**        | `use-[name].ts`          | `use-materials.ts`       |
| **Services**     | `[entity].service.ts`    | `material.service.ts`    |
| **Repositories** | `[entity].repository.ts` | `material.repository.ts` |
| **Schemas**      | `[entity].schemas.ts`    | `inventory.schemas.ts`   |
| **Types**        | `[context].ts`           | `entities.ts`            |
| **Config**       | `[context].config.ts`    | `rate-limit.config.ts`   |
| **Utils**        | `[function].ts`          | `csv-export.ts`          |

### Feature Module Structure

```
features/[feature]/
├── components/
│   ├── [feature]-list.tsx
│   ├── [feature]-form.tsx
│   ├── [feature]-card.tsx
│   └── [feature]-dialog.tsx
├── hooks/
│   ├── use-[feature].ts
│   ├── use-[feature]-mutations.ts
│   └── use-[feature]-filters.ts
└── [subfeature]/
    ├── components/
    └── hooks/
```

---

## 4. API Route Standards

### ✅ REQUIRED: Use `withApiHandler` HOF

**Pattern:**

```typescript
// ✅ CORRECT - Use arrow function export with HOF
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { entityService } from "@/lib/services/entity.service";
import { filterSchema, createSchema } from "@/lib/validation/entity.schemas";

/**
 * GET /api/stores/[id]/entities
 * Get all entities for a store with optional filtering
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const filters = filterSchema.parse({
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || "0",
      take: searchParams.get("take") || "50",
    });

    const result = await entityService.getEntities(storeId!, filters);

    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/entities",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/entities
 * Create a new entity
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const input = createSchema.parse({ ...body, storeId });

    const entity = await entityService.createEntity(input);

    return NextResponse.json(createSuccessResponse(entity), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/entities",
    requireStoreAuth: true,
  }
);
```

**❌ INCORRECT - Do NOT use this pattern:**

```typescript
// ❌ WRONG - Manual auth/error handling
export async function GET(request: Request, { params }: {...}) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(...);
    }
    await verifyStoreOwnership(...);
    // ...
  } catch (error) {
    return handleApiError(error, {...});
  }
}
```

### Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2025-12-22T00:00:00.000Z" }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  },
  "meta": { "timestamp": "2025-12-22T00:00:00.000Z" }
}
```

### HTTP Status Codes

| Status | When to Use                               |
| ------ | ----------------------------------------- |
| 200    | GET success, PATCH success                |
| 201    | POST success (created)                    |
| 400    | Validation error, business rule violation |
| 401    | Not authenticated                         |
| 403    | Not authorized, subscription limit        |
| 404    | Resource not found                        |
| 409    | Duplicate/conflict                        |
| 429    | Rate limit exceeded                       |
| 500    | Unexpected server error                   |
| 503    | Database timeout/error                    |

---

## 5. Service Layer Standards

### Class Structure

```typescript
/**
 * Entity Service
 *
 * Business logic layer for [entity] operations.
 * Handles validation, authorization, and orchestrates repository calls.
 */
import { entityRepository, EntityRepository } from "@/lib/repositories/entity.repository";

interface CreateEntityInput {
  storeId: string;
  name: string;
  // ...other fields
}

interface UpdateEntityInput {
  name?: string;
  // ...other fields (all optional)
}

class EntityService {
  constructor(private readonly entityRepo: EntityRepository = entityRepository) {}

  /**
   * Get all entities for a store
   */
  async getEntities(storeId: string, filters: EntityFilters = {}) {
    return this.entityRepo.findAll(storeId, filters);
  }

  /**
   * Get entity by ID
   */
  async getEntityById(entityId: string) {
    const entity = await this.entityRepo.findById(entityId);
    if (!entity) {
      throw new NotFoundError("Entity", entityId);
    }
    return entity;
  }

  /**
   * Create new entity
   */
  async createEntity(input: CreateEntityInput) {
    // 1. Validate business rules
    const existing = await this.entityRepo.existsBySku(input.storeId, input.sku);
    if (existing) {
      throw new DuplicateError("Entity", "sku", input.sku);
    }

    // 2. Create entity
    return this.entityRepo.create(input);
  }

  /**
   * Update entity
   */
  async updateEntity(entityId: string, storeId: string, input: UpdateEntityInput) {
    // 1. Verify entity exists
    const entity = await this.getEntityById(entityId);

    // 2. Verify ownership
    if (entity.storeId !== storeId) {
      throw new ForbiddenError("Entity does not belong to this store");
    }

    // 3. Update
    return this.entityRepo.update(entityId, input);
  }

  /**
   * Delete entity
   */
  async deleteEntity(entityId: string, storeId: string) {
    // 1. Verify entity exists and belongs to store
    const entity = await this.getEntityById(entityId);
    if (entity.storeId !== storeId) {
      throw new ForbiddenError("Entity does not belong to this store");
    }

    // 2. Delete
    await this.entityRepo.delete(entityId);
  }
}

// Export singleton instance
export const entityService = new EntityService();
```

### Naming Conventions

| Method Type | Prefix                 | Example               |
| ----------- | ---------------------- | --------------------- |
| Get single  | `get[Entity]ById`      | `getMaterialById`     |
| Get list    | `get[Entities]`        | `getMaterials`        |
| Create      | `create[Entity]`       | `createMaterial`      |
| Update      | `update[Entity]`       | `updateMaterial`      |
| Delete      | `delete[Entity]`       | `deleteMaterial`      |
| Bulk delete | `bulkDelete[Entities]` | `bulkDeleteMaterials` |
| Special     | `[action][Entity]`     | `recordPurchase`      |

---

## 6. Repository Layer Standards

### Class Structure

```typescript
import { Entity, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Entity Repository
 *
 * Handles all database operations related to [entity].
 * Follows the repository pattern for clean architecture.
 */

export type EntityWithRelations = Entity & {
  relatedEntities?: Array<...>;
};

export interface EntityFilters {
  search?: string;
  category?: string;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class EntityRepository extends BaseRepository {
  /**
   * Find all entities for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: EntityFilters = {}
  ): Promise<{ entities: EntityWithRelations[]; total: number }> {
    const { search, category, sortBy = "createdAt", sortOrder = "desc", skip = 0, take = 50 } = filters;

    const where: Prisma.EntityWhereInput = {
      storeId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(category && { category }),
    };

    const orderBy: Prisma.EntityOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Parallel execution for performance
    const [entities, total] = await Promise.all([
      this.db.entity.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { relatedEntities: true },
      }),
      this.db.entity.count({ where }),
    ]);

    return { entities, total };
  }

  /**
   * Find entity by ID
   */
  async findById(entityId: string): Promise<EntityWithRelations | null> {
    return this.db.entity.findUnique({
      where: { id: entityId },
      include: { relatedEntities: true },
    });
  }

  /**
   * Check if entity exists (optimized)
   */
  async existsBySku(storeId: string, sku: string, excludeId?: string): Promise<boolean> {
    const entity = await this.db.entity.findFirst({
      where: {
        storeId,
        sku: { equals: sku, mode: "insensitive" },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true }, // Only select id for performance
    });
    return !!entity;
  }

  /**
   * Create entity
   */
  async create(data: Prisma.EntityCreateInput): Promise<EntityWithRelations> {
    return this.db.entity.create({
      data,
      include: { relatedEntities: true },
    });
  }

  /**
   * Update entity
   */
  async update(entityId: string, data: Prisma.EntityUpdateInput): Promise<EntityWithRelations> {
    return this.db.entity.update({
      where: { id: entityId },
      data,
      include: { relatedEntities: true },
    });
  }

  /**
   * Delete entity
   */
  async delete(entityId: string): Promise<void> {
    await this.db.entity.delete({
      where: { id: entityId },
    });
  }

  /**
   * Bulk delete entities
   */
  async bulkDelete(entityIds: string[]): Promise<number> {
    const result = await this.db.entity.deleteMany({
      where: { id: { in: entityIds } },
    });
    return result.count;
  }

  /**
   * Check if entity belongs to store
   */
  async belongsToStore(entityId: string, storeId: string): Promise<boolean> {
    const entity = await this.db.entity.findFirst({
      where: { id: entityId, storeId },
      select: { id: true },
    });
    return !!entity;
  }
}

// Export singleton instance
export const entityRepository = new EntityRepository();
```

### Method Naming Conventions

| Method Type         | Name              | Return Type                        |
| ------------------- | ----------------- | ---------------------------------- |
| Get with filters    | `findAll`         | `{ entities: T[]; total: number }` |
| Get by ID           | `findById`        | `T \| null`                        |
| Get by unique field | `findBy[Field]`   | `T \| null`                        |
| Check existence     | `existsBy[Field]` | `boolean`                          |
| Check ownership     | `belongsToStore`  | `boolean`                          |
| Create              | `create`          | `T`                                |
| Update              | `update`          | `T`                                |
| Delete              | `delete`          | `void`                             |
| Bulk delete         | `bulkDelete`      | `number` (count)                   |
| Count               | `count`           | `number`                           |

---

## 7. Validation Schema Standards

### Location & Naming

```
src/lib/validation/
├── common.schemas.ts      # Shared primitives
├── auth.schemas.ts        # Auth-related
├── business.schemas.ts    # Business/Store
├── inventory.schemas.ts   # Materials, Products, Recipes
├── production.schemas.ts  # Production batches
├── orders.schemas.ts      # Orders
└── subscription.schemas.ts
```

### Schema Pattern

```typescript
import { z } from "zod";
import { cuidSchema, priceSchema, decimalSchema } from "./common.schemas";

// ============================================
// Entity Schemas
// ============================================

// Base schema (shared fields)
const baseEntitySchema = z.object({
  storeId: cuidSchema,
  sku: z.string().min(1, "SKU is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
});

// Create schema (with refinements)
export const createEntitySchema = baseEntitySchema.refine(
  (data) => data.minValue <= data.maxValue,
  { message: "Min must be <= max", path: ["minValue"] }
);

export type CreateEntityInput = z.infer<typeof createEntitySchema>;

// Update schema (all fields optional, no storeId)
export const updateEntitySchema = baseEntitySchema.partial().omit({ storeId: true });

export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;

// Filter schema (for query params)
export const entityFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(["name", "sku", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type EntityFilterInput = z.infer<typeof entityFilterSchema>;

// Form schema (client-side, without storeId)
export const createEntityFormSchema = baseEntitySchema.omit({ storeId: true });

export type CreateEntityFormInput = z.infer<typeof createEntityFormSchema>;
```

---

## 8. Component Standards

### Component Structure

```typescript
/**
 * EntityCard Component
 *
 * Displays a single entity in a card format.
 * Used in entity list views.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/locales";
import type { Entity } from "@/types/entities";

interface EntityCardProps {
  entity: Entity;
  onEdit?: (entity: Entity) => void;
  onDelete?: (entityId: string) => void;
}

export function EntityCard({ entity, onEdit, onDelete }: EntityCardProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(entity.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entity.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{entity.description}</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onEdit?.(entity)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t("common.deleting") : t("common.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Naming Conventions

| Component Type | Suffix     | Example            |
| -------------- | ---------- | ------------------ |
| Page wrapper   | `Client`   | `DashboardClient`  |
| List           | `List`     | `MaterialList`     |
| Card           | `Card`     | `MaterialCard`     |
| Form           | `Form`     | `MaterialForm`     |
| Dialog         | `Dialog`   | `MaterialDialog`   |
| Table          | `Table`    | `MaterialTable`    |
| Skeleton       | `Skeleton` | `MaterialSkeleton` |

---

## 9. Hook Standards

### Query Hook Pattern

```typescript
/**
 * use[Entities] Hook
 *
 * Fetches and manages [entities] data using TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import type { Entity, CreateEntityInput, UpdateEntityInput } from "@/types/entities";

// Query keys factory
export const entityKeys = {
  all: (storeId: string) => ["entities", storeId] as const,
  lists: (storeId: string) => [...entityKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters: EntityFilters) =>
    [...entityKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...entityKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, entityId: string) =>
    [...entityKeys.details(storeId), entityId] as const,
};

// Fetch function
async function fetchEntities(storeId: string, filters: EntityFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  // ...

  const res = await fetch(`/api/stores/${storeId}/entities?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");

  const data = await res.json();
  return data.data;
}

// Main hook
export function useEntities(storeId: string, filters: EntityFilters = {}) {
  return useQuery({
    queryKey: entityKeys.list(storeId, filters),
    queryFn: () => fetchEntities(storeId, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hooks
export function useCreateEntity(storeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (input: CreateEntityInput) => {
      const res = await fetch(`/api/stores/${storeId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.all(storeId) });
      toast.success(t("entity.created"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateEntity(storeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async ({ entityId, input }: { entityId: string; input: UpdateEntityInput }) => {
      const res = await fetch(`/api/stores/${storeId}/entities/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.all(storeId) });
      toast.success(t("entity.updated"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteEntity(storeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (entityId: string) => {
      const res = await fetch(`/api/stores/${storeId}/entities/${entityId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.all(storeId) });
      toast.success(t("entity.deleted"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

---

## 10. Error Handling Standards

### Use Typed Errors

```typescript
import { AppError, NotFoundError, DuplicateError, ForbiddenError } from "@/lib/errors";

// In service layer
async createEntity(input: CreateEntityInput) {
  // Check for duplicates
  const exists = await this.entityRepo.existsBySku(input.storeId, input.sku);
  if (exists) {
    throw new DuplicateError("Entity", "sku", input.sku);
  }

  // Check ownership
  if (entity.storeId !== storeId) {
    throw new ForbiddenError("Entity does not belong to this store");
  }

  // Not found
  const entity = await this.entityRepo.findById(entityId);
  if (!entity) {
    throw new NotFoundError("Entity", entityId);
  }
}
```

### Available Error Classes

| Error Class               | Status Code | Use Case           |
| ------------------------- | ----------- | ------------------ |
| `UnauthorizedError`       | 401         | Not logged in      |
| `ForbiddenError`          | 403         | No permission      |
| `NotFoundError`           | 404         | Resource not found |
| `ValidationError`         | 400         | Invalid input      |
| `DuplicateError`          | 409         | Already exists     |
| `ConflictError`           | 409         | Conflict           |
| `InsufficientStockError`  | 400         | Not enough stock   |
| `StoreLimitExceededError` | 403         | Subscription limit |
| `DatabaseError`           | 503         | DB error           |
| `RateLimitExceededError`  | 429         | Rate limited       |

---

## 11. Type Definition Standards

### Location

```
src/types/
├── api/
│   └── responses.ts     # API response types
├── dto/
│   └── [entity].ts      # Data transfer objects
├── entities.ts          # Domain entities
├── errors.ts            # Error types
└── [context].ts         # Other types
```

### Entity Type Pattern

```typescript
// src/types/entities.ts

export interface Material {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialWithSuppliers extends Material {
  materialSuppliers: Array<{
    id: string;
    supplierId: string;
    price: number;
    isPreferred: boolean;
    supplier: {
      id: string;
      name: string;
    };
  }>;
}
```

---

## 12. Documentation Standards

### JSDoc for Functions

```typescript
/**
 * Create a new material
 *
 * @param input - Material creation input
 * @param input.storeId - Store ID
 * @param input.sku - Unique SKU
 * @param input.name - Material name
 * @returns Created material with suppliers
 * @throws {DuplicateError} If SKU already exists
 *
 * @example
 * const material = await materialService.createMaterial({
 *   storeId: "abc123",
 *   sku: "MAT-001",
 *   name: "Flour",
 * });
 */
async createMaterial(input: CreateMaterialInput): Promise<MaterialWithSuppliers> {
  // ...
}
```

### API Route Comments

```typescript
/**
 * GET /api/stores/[id]/materials
 *
 * Get all materials for a store with optional filtering.
 * Query params: search, category, stockStatus, sortBy, sortOrder, skip, take
 *
 * @returns Paginated list of materials
 */
export const GET = withApiHandler(...)
```

---

## 13. Consistency Checklist

### API Routes

- [ ] All routes use `withApiHandler` HOF
- [ ] All routes have JSDoc with endpoint path
- [ ] All responses use `createSuccessResponse` / `createErrorResponse`
- [ ] All routes have `rateLimitEndpoint` configured
- [ ] Store routes have `requireStoreAuth: true`

### Services

- [ ] Class with dependency injection
- [ ] Singleton export
- [ ] JSDoc for all public methods
- [ ] Throws typed errors (`AppError` subclasses)
- [ ] Consistent method naming

### Repositories

- [ ] Extends `BaseRepository`
- [ ] Singleton export
- [ ] `Promise.all` for parallel queries
- [ ] `select: { id: true }` for existence checks
- [ ] Consistent method naming

### Validation

- [ ] All schemas in `/lib/validation`
- [ ] Type exports for all schemas
- [ ] Form schemas (without storeId)
- [ ] Filter schemas with defaults

### Components

- [ ] "use client" directive if needed
- [ ] Props interface defined
- [ ] JSDoc with description
- [ ] `useI18n` for translations

### Hooks

- [ ] Query keys factory
- [ ] Proper staleTime
- [ ] Toast notifications
- [ ] Cache invalidation

---

## 14. Migration Guide

### Converting Manual Routes to withApiHandler

**Before:**

```typescript
export async function GET(request: Request, { params }: {...}) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }
    await verifyStoreOwnership(storeId, session.user.id);
    // business logic
  } catch (error) {
    return handleApiError(error, {...});
  }
}
```

**After:**

```typescript
export const GET = withApiHandler(
  async (request, { storeId }) => {
    // business logic only
    const result = await service.getData(storeId!);
    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/entities",
    requireStoreAuth: true,
  }
);
```

---

_Blueprint Version 1.0.0 - Last Updated: 2025-12-22_
