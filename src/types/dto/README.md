# Data Transfer Objects (DTOs)

## ⚠️ Status: PREPARED BUT NOT IN USE

These DTO types were created in anticipation of future API layer refactoring,
but are **currently NOT being used** in the codebase.

### Why DTOs exist here:

1. **Future API versioning** - When we add API versioning, these DTOs will provide
   a stable contract between API versions and internal models
2. **Type safety for API responses** - Will help ensure consistent API response shapes
3. **Decoupling from Prisma models** - Allows API to evolve independently from database schema

### Current state (as of 2025):

- **NOT imported** anywhere in the codebase
- **NOT used** in any API routes or services
- The codebase currently uses **Prisma types directly** (e.g., `Material`, `Product`)
- Or uses **custom types from repositories** (e.g., `MaterialWithSuppliers`)

### When to use these:

⚠️ **DO NOT USE YET** - These are premature optimization (YAGNI violation)

✅ **Use these when:**

- Implementing API versioning (v1, v2, etc.)
- Need to expose different data shapes to external APIs
- Building GraphQL schema mappings
- Creating public SDK/client libraries

### Current approach (recommended):

Instead of DTOs, the project currently uses:

```typescript
// From repositories with proper relations
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";

// Direct Prisma types
import type { Material, Product, Recipe } from "@prisma/client";
```

### Cleanup options:

1. **Keep them** (current) - As preparation for future API refactoring
2. **Move to `/docs/future-types/`** - Document as "planned types"
3. **Delete them** - Remove until actually needed (true YAGNI)

---

**Last Updated:** 2025-01-24
**Decision:** Keep for now, but mark as unused to avoid confusion
