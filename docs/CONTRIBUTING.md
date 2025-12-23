# Contributing Guide

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies with `pnpm install`
4. Copy `.env.example` to `.env` and configure
5. Run `pnpm dev` to start development server

---

## Code Style

### Formatting

We use ESLint and Prettier. Format before committing:

```bash
pnpm lint
pnpm format
```

### Naming Conventions

| Type         | Convention           | Example                  |
| ------------ | -------------------- | ------------------------ |
| Components   | PascalCase           | `MaterialsSection.tsx`   |
| Hooks        | camelCase with `use` | `useMaterials.ts`        |
| Services     | camelCase            | `material.service.ts`    |
| Repositories | camelCase            | `material.repository.ts` |
| Utils        | camelCase            | `api-error-handler.ts`   |
| Constants    | SCREAMING_SNAKE      | `MAX_RETRIES`            |

---

## File Organization

### Feature Module Structure

```
features/dashboard/data/materials/
├── components/
│   ├── materials-section.tsx
│   ├── material-details-dialog.tsx
│   └── add-material-dialog.tsx
├── hooks/
│   └── use-materials.ts
├── utils/
│   └── stock-helpers.ts
└── types/
    └── material-types.ts
```

---

## Adding a New Feature

### 1. Create Repository

```typescript
// src/lib/repositories/feature.repository.ts
export class FeatureRepository extends BaseRepository {
  async findAll(storeId: string) {
    return this.db.feature.findMany({ where: { storeId } });
  }
}

export const featureRepository = new FeatureRepository();
```

### 2. Create Service

```typescript
// src/lib/services/feature.service.ts
export class FeatureService {
  constructor(private repo = featureRepository) {}

  async getFeatures(storeId: string) {
    return this.repo.findAll(storeId);
  }
}

export const featureService = new FeatureService();
```

### 3. Create API Route

```typescript
// src/app/api/stores/[id]/features/route.ts
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const result = await featureService.getFeatures(storeId!);
    return NextResponse.json(createSuccessResponse(result));
  },
  { requireStoreAuth: true }
);
```

### 4. Create Hook

```typescript
// src/features/.../hooks/use-features.ts
export function useFeatures(storeId: string) {
  return useQuery({
    queryKey: ["features", storeId],
    queryFn: () => fetch(`/api/stores/${storeId}/features`).then((r) => r.json()),
  });
}
```

---

## Commit Messages

Follow conventional commits:

```
feat: add material export functionality
fix: correct stock calculation in production batch
docs: update API reference
refactor: extract common filter logic to hook
test: add material service tests
```

---

## Pull Request Process

1. Create feature branch from `main`
2. Implement changes following code style
3. Add tests for new functionality
4. Update documentation if needed
5. Submit PR with clear description
6. Address review feedback
7. Squash and merge when approved

---

## Testing Requirements

- Add unit tests for services
- Add integration tests for critical flows
- Ensure no regressions in existing tests

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode
pnpm test:cov    # With coverage
```
