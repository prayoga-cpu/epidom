# System Architecture

## Overview

EPIDOM follows a **Clean Layered Architecture** with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │ Components  │  │   Feature Modules   │  │
│  │  (app/)     │  │ (ui/, etc.) │  │    (features/)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       State Layer                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              TanStack Query (React Query)            │    │
│  │         Custom Hooks (use-materials.ts, etc.)        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Next.js API Routes                   │    │
│  │              (withApiHandler wrapper)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   material.service.ts  │  production-batch.service  │    │
│  │   recipe.service.ts    │  subscription.service      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   material.repository  │  recipe.repository         │    │
│  │   product.repository   │  BaseRepository            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Database                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              PostgreSQL (via Prisma ORM)             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected app routes
│   ├── (marketing)/       # Public marketing pages
│   └── api/               # API routes
│
├── components/            # Shared UI components
│   ├── ui/               # Base UI components (shadcn)
│   ├── lang/             # i18n components
│   └── providers/        # Context providers
│
├── features/              # Feature modules (FDA)
│   ├── auth/             # Authentication
│   ├── dashboard/        # Main dashboard
│   │   ├── data/        # Materials, recipes, products
│   │   ├── tracking/    # Production, orders
│   │   └── management/  # Store settings
│   ├── marketing/        # Landing pages
│   └── stores/           # Store management
│
├── lib/                   # Core libraries
│   ├── repositories/     # Data access layer
│   ├── services/         # Business logic
│   ├── validation/       # Zod schemas
│   ├── errors/           # Custom error classes
│   └── utils/            # Utility functions
│
├── locales/              # i18n translations
│   ├── en.ts
│   ├── fr.ts
│   └── id.ts
│
└── types/                # TypeScript definitions
    └── api/              # API response types
```

---

## Key Patterns

### 1. Repository Pattern

```typescript
// lib/repositories/material.repository.ts
export class MaterialRepository extends BaseRepository {
  async findAll(storeId: string, filters: MaterialFilters) {
    return this.db.material.findMany({ where: { storeId, ...filters } });
  }
}
```

### 2. Service Layer

```typescript
// lib/services/material.service.ts
export class MaterialService {
  constructor(private readonly materialRepo: MaterialRepository) {}

  async createMaterial(input: CreateMaterialInput) {
    // Business logic validation
    await this.validateSku(input.storeId, input.sku);
    return this.materialRepo.create(input);
  }
}
```

### 3. API Handler Wrapper

```typescript
// All API routes use withApiHandler for consistency
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    const result = await materialService.getMaterials(storeId);
    return NextResponse.json(createSuccessResponse(result));
  },
  { requireStoreAuth: true }
);
```

### 4. Hybrid SSR + Client State

```typescript
// Server Component fetches initial data
export default async function Page({ params }) {
  const data = await fetchMaterialsForPage(storeId);
  return <ClientComponent initialData={data} />;
}

// Client Component uses TanStack Query with initialData
function useMaterials(storeId, initialData) {
  return useQuery({
    queryKey: ['materials', storeId],
    queryFn: fetchMaterials,
    initialData,
  });
}
```

---

## Data Flow

```
User Action → React Component → TanStack Query Hook
                                       ↓
                              API Route (withApiHandler)
                                       ↓
                                Service Layer
                                       ↓
                              Repository Layer
                                       ↓
                                 PostgreSQL
```
