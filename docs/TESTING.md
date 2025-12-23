# Testing Guide

## Overview

EPIDOM uses **Vitest** as the testing framework with React Testing Library for component tests.

---

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage report
pnpm test:cov

# Run specific file
pnpm test src/lib/services/__tests__/material.service.test.ts
```

---

## Test Structure

```
src/
├── lib/
│   ├── services/
│   │   └── __tests__/
│   │       ├── material.service.test.ts
│   │       ├── product.service.test.ts
│   │       ├── recipe.service.test.ts
│   │       └── subscription.service.test.ts
│   └── validation/
│       └── __tests__/
│           └── inventory.schemas.test.ts
└── test/
    └── setup.ts              # Global test setup
```

---

## Writing Tests

### Service Tests

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MaterialService } from "../material.service";

const mockRepo = {
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

describe("MaterialService", () => {
  let service: MaterialService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MaterialService(mockRepo as any);
  });

  describe("getMaterials", () => {
    it("should return materials with total count", async () => {
      mockRepo.findAll.mockResolvedValue({
        materials: [{ id: "1", name: "Flour" }],
        total: 1,
      });

      const result = await service.getMaterials("store-1", {});

      expect(result.materials).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("createMaterial", () => {
    it("should throw error if SKU already exists", async () => {
      mockRepo.existsBySku.mockResolvedValue(true);

      await expect(
        service.createMaterial({ storeId: "store-1", sku: "EXISTING", name: "Test" })
      ).rejects.toThrow("A material with this SKU already exists");
    });
  });
});
```

### Schema Validation Tests

```typescript
import { describe, it, expect } from "vitest";
import { createIngredientSchema } from "../inventory.schemas";

describe("createIngredientSchema", () => {
  it("should validate valid input", () => {
    const input = {
      storeId: "cuid1234567890123",
      sku: "FLOUR-001",
      name: "All Purpose Flour",
      unit: "kg",
      unitCost: 2.5,
    };

    expect(() => createIngredientSchema.parse(input)).not.toThrow();
  });

  it("should reject invalid SKU", () => {
    const input = {
      storeId: "cuid1234567890123",
      sku: "", // Empty SKU
      name: "Flour",
      unitCost: 2.5,
    };

    expect(() => createIngredientSchema.parse(input)).toThrow("SKU is required");
  });
});
```

---

## Mocking Patterns

### Mock Repository

```typescript
const createMockRepository = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});
```

### Mock Prisma

```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    material: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  },
}));
```

### Mock External Services

```typescript
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
```

---

## Coverage Targets

Current thresholds (in `vitest.config.ts`):

| Metric     | Target | Current |
| ---------- | ------ | ------- |
| Lines      | 70%    | ~2%     |
| Functions  | 70%    | ~1%     |
| Branches   | 60%    | ~1%     |
| Statements | 70%    | ~2%     |

**Note:** Coverage is currently low and needs improvement.

---

## Test Categories

### Unit Tests

- Service business logic
- Schema validation
- Utility functions

### Integration Tests (TODO)

- API route handlers
- Database operations

### E2E Tests (TODO)

- Critical user flows
- Checkout process
- Authentication

---

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Mock external deps** - Database, Stripe, etc.
3. **Test edge cases** - Empty inputs, errors, limits
4. **Clear naming** - `should [expected behavior] when [condition]`
5. **Arrange-Act-Assert** - Clear test structure
