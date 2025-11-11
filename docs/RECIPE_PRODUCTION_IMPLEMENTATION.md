# Recipe Production Implementation Guide

## Overview
This document tracks the implementation of the Recipe Production functionality for the Management page. The feature allows users to start production batches, track progress, manage materials, and complete production with automatic inventory updates.

## ✅ Completed Implementation

### 1. Backend Infrastructure

#### Repository Layer (`src/lib/repositories/production-batch.repository.ts`)
- ✅ Complete CRUD operations for production batches
- ✅ Advanced filtering (status, recipe, product, date ranges)
- ✅ Batch number generation with auto-incrementing sequence
- ✅ Active batches retrieval by recipe
- ✅ Due date filtering for production scheduling
- ✅ Full type-safe integration with Prisma

**Key Methods:**
- `findAll()` - Get batches with filters
- `findById()` - Get single batch with full relations
- `create()` - Create new production batch
- `update()` - Update batch details
- `updateStatus()` - Update batch status
- `delete()` - Delete batch (hard delete)
- `getActiveBatchesByRecipe()` - Get in-progress batches
- `generateBatchNumber()` - Auto-generate unique batch numbers

#### Service Layer (`src/lib/services/production-batch.service.ts`)
- ✅ Business logic for production workflows
- ✅ Material availability checking
- ✅ Stock deduction on production start
- ✅ Product addition on production complete
- ✅ Material restoration on cancellation
- ✅ Stock movement audit trail creation
- ✅ Transaction handling for data consistency

**Key Business Logic:**
1. **Start Production:**
   - Validates recipe exists and belongs to store
   - Calculates batch multiplier based on recipe yield
   - Checks material availability
   - Creates production batch (IN_PROGRESS status)
   - Deducts materials from stock
   - Creates PRODUCTION_OUT stock movements

2. **Complete Production:**
   - Validates batch status (must be IN_PROGRESS)
   - Adds finished products to inventory
   - Creates PRODUCTION_IN stock movement
   - Updates batch to COMPLETED status
   - Records actual quantity and completion date

3. **Cancel Production:**
   - Validates batch status (cannot cancel COMPLETED)
   - Optionally restores materials to stock
   - Creates ADJUSTMENT stock movements
   - Updates batch to CANCELLED status

#### Validation Schemas (`src/lib/validation/production.schemas.ts`)
- ✅ Type-safe Zod schemas for all operations
- ✅ Form schemas for client-side validation
- ✅ Filter schemas for query parameters
- ✅ Complete TypeScript type inference

**Schemas:**
- `createProductionBatchSchema` - Start production
- `updateProductionBatchSchema` - Update batch details
- `completeProductionSchema` - Complete production
- `cancelProductionSchema` - Cancel production
- `productionBatchFilterSchema` - Query filters

### 2. API Routes

#### List & Create (`src/app/api/stores/[id]/production-batches/route.ts`)
- ✅ `GET /api/stores/[id]/production-batches` - List all batches with filtering
- ✅ `POST /api/stores/[id]/production-batches` - Start production
- ✅ Authentication verification
- ✅ Query parameter validation
- ✅ Error handling with specific status codes

#### Single Batch Operations (`src/app/api/stores/[id]/production-batches/[batchId]/route.ts`)
- ✅ `GET /api/stores/[id]/production-batches/[batchId]` - Get single batch
- ✅ `PATCH /api/stores/[id]/production-batches/[batchId]` - Update batch
- ✅ `DELETE /api/stores/[id]/production-batches/[batchId]` - Delete batch
- ✅ Store ownership verification

#### Status Updates
- ✅ `POST /api/stores/[id]/production-batches/[batchId]/complete` - Complete production
- ✅ `POST /api/stores/[id]/production-batches/[batchId]/cancel` - Cancel production

### 3. React Query Hooks (`src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts`)
- ✅ Query hooks for data fetching
- ✅ Mutation hooks for CRUD operations
- ✅ Automatic cache invalidation
- ✅ Type-safe with full TypeScript support

**Hooks Available:**
- `useProductionBatches(storeId, filters)` - Fetch batches with filters
- `useProductionBatch(storeId, batchId)` - Fetch single batch
- `useStartProduction(storeId)` - Start production mutation
- `useUpdateProductionBatch(storeId, batchId)` - Update batch mutation
- `useCompleteProduction(storeId)` - Complete production mutation
- `useCancelProduction(storeId)` - Cancel production mutation
- `useDeleteProductionBatch(storeId)` - Delete batch mutation

---

## 🔄 Remaining Frontend Integration

### 4. Update Components to Use API Hooks

#### A. `recipe-production.tsx` - Main Component
**Current State:** Uses MOCK_RECIPES, MOCK_PRODUCTION_BATCHES, MOCK_MATERIALS

**Required Changes:**
```typescript
// Replace mock imports
import { useRecipes } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useProductionBatches } from "./hooks/use-production-batches";
import { useParams } from "next/navigation";

// Add at component start
const params = useParams();
const storeId = params.storeId as string;

// Replace mock data with API calls
const { data: recipesData, isLoading: recipesLoading } = useRecipes(storeId, {
  sortBy: "name",
  sortOrder: "asc",
  skip: 0,
  take: 100,
});
const recipes = recipesData?.recipes || [];

const { data: batchesData, isLoading: batchesLoading } = useProductionBatches(storeId, {
  status: ["IN_PROGRESS", "PLANNED"],
  recipeId: selectedRecipe?.id,
  sortBy: "scheduledDate",
  sortOrder: "asc",
});
const activeBatches = batchesData?.batches || [];

// Add loading states
if (recipesLoading || batchesLoading) {
  return <RecipeProductionSkeleton />;
}
```

**Additional Tasks:**
- Create `RecipeProductionSkeleton` component for loading state
- Add error handling with ErrorMessage component
- Update filtered recipes to work with API data
- Update recipe ingredients calculation to use real-time material stock

#### B. `start-production-dialog.tsx` - Create Batch Dialog
**Current State:** Mock implementation without API integration

**Required Changes:**
```typescript
import { useStartProduction } from "./hooks/use-production-batches";
import { useParams } from "next/navigation";
import { toast } from "sonner";

// Add at component start
const params = useParams();
const storeId = params.storeId as string;
const startProduction = useStartProduction(storeId);

// Update submit handler
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    await startProduction.mutateAsync({
      productId: selectedProductId, // Need to add product selection
      recipeId: recipe.id,
      plannedQuantity: quantity,
      scheduledDate: new Date(scheduledDate),
      notes,
    });

    toast.success("Production started successfully!");
    onOpenChange(false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to start production");
  }
};
```

**Additional Tasks:**
- Add product selection dropdown (products linked to recipe)
- Add form validation with react-hook-form + Zod
- Add loading state to submit button
- Show material availability warnings before submission

#### C. `production-batch-card.tsx` - Batch Status Management
**Current State:** Display-only card without status update actions

**Required Changes:**
```typescript
import { useCompleteProduction, useCancelProduction } from "./hooks/use-production-batches";
import { useParams } from "next/navigation";
import { toast } from "sonner";

// Add at component start
const params = useParams();
const storeId = params.storeId as string;
const completeProduction = useCompleteProduction(storeId);
const cancelProduction = useCancelProduction(storeId);

// Add complete handler
const handleComplete = async () => {
  try {
    await completeProduction.mutateAsync({
      batchId: batch.id,
      data: { actualQuantity: batch.plannedQuantity },
    });
    toast.success("Production completed successfully!");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to complete production");
  }
};

// Add cancel handler
const handleCancel = async () => {
  try {
    await cancelProduction.mutateAsync({
      batchId: batch.id,
      data: { restoreMaterials: true },
    });
    toast.success("Production cancelled and materials restored!");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to cancel production");
  }
};
```

**Additional Tasks:**
- Add action buttons for Complete and Cancel
- Add confirmation dialogs for destructive actions
- Add actual quantity input for complete action
- Add option to restore materials on cancel
- Show loading states on action buttons
- Display stock movements timeline

#### D. `material-availability-check.tsx` - Real-time Stock Checking
**Current State:** Uses static ingredient data

**Required Changes:**
```typescript
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useParams } from "next/navigation";

// Add at component start
const params = useParams();
const storeId = params.storeId as string;

// Fetch real-time material stock
const { data: materialsData } = useMaterials(storeId, {
  sortBy: "name",
  sortOrder: "asc",
});

// Map ingredients with real-time stock
const ingredientsWithStock = ingredients.map((ing) => {
  const material = materialsData?.materials.find((m) => m.id === ing.materialId);
  return {
    ...ing,
    available: material?.currentStock || 0,
    status: calculateStatus(ing.required, material?.currentStock || 0),
  };
});
```

**Additional Tasks:**
- Add real-time stock polling (refetch every 30 seconds)
- Add visual indicators for stock status changes
- Show last updated timestamp
- Add "Refresh" button for manual updates

---

## 📋 Testing Checklist

Once frontend integration is complete, test the following scenarios:

### Happy Path
- [ ] Browse and select recipes
- [ ] View recipe details and ingredients
- [ ] Check material availability (all sufficient)
- [ ] Start production successfully
- [ ] View active batches
- [ ] Complete production batch
- [ ] Verify product stock increased
- [ ] Verify material stock decreased correctly

### Edge Cases
- [ ] Try to start production with insufficient materials (should fail)
- [ ] Try to complete batch that's not IN_PROGRESS (should fail)
- [ ] Cancel production and verify materials restored
- [ ] Try to cancel completed batch (should fail)
- [ ] Delete planned batch successfully
- [ ] Try to delete in-progress batch (should fail)

### Multi-Store
- [ ] Verify batches are scoped to correct store
- [ ] Switch stores and verify separate batches
- [ ] Verify materials from different stores cannot be used

### Stock Movements
- [ ] Verify PRODUCTION_OUT movements created on start
- [ ] Verify PRODUCTION_IN movements created on complete
- [ ] Verify ADJUSTMENT movements created on cancel with restore
- [ ] Verify balanceAfter calculated correctly

---

## 🎨 UI/UX Enhancements (Optional)

### Loading States
- Skeleton loaders for recipe list
- Skeleton loaders for batch cards
- Spinner for material availability check
- Button loading states during mutations

### Error Handling
- Toast notifications for all errors
- Error boundary for critical failures
- Retry buttons for failed operations
- Detailed error messages from API

### Real-time Updates
- WebSocket or polling for batch status changes
- Live material stock updates
- Notifications for production milestones

### Data Visualization
- Production timeline chart
- Material usage charts
- Batch completion statistics
- Production efficiency metrics

---

## 🔗 Related Files & Dependencies

### Backend
- `prisma/schema.prisma` - ProductionBatch, StockMovement models
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/auth.ts` - NextAuth configuration

### Frontend
- `src/components/ui/*` - shadcn/ui components
- `src/locales/*` - Translation files (update if needed)
- `src/features/dashboard/data/recipes/hooks/use-recipes.ts` - Recipe hooks
- `src/features/dashboard/data/materials/hooks/use-materials.ts` - Material hooks

### Types
- `@prisma/client` - Generated Prisma types
- `src/types/entities.ts` - May need updates for consistency

---

## 📝 Next Steps

1. **Implement Frontend Integration (Priority: High)**
   - Update `recipe-production.tsx` to use API hooks
   - Update `start-production-dialog.tsx` with form submission
   - Update `production-batch-card.tsx` with status actions
   - Update `material-availability-check.tsx` with real-time data

2. **Add Loading & Error States (Priority: High)**
   - Create skeleton components
   - Add error boundaries
   - Implement toast notifications

3. **Testing (Priority: High)**
   - Manual testing of all workflows
   - Edge case validation
   - Multi-store testing

4. **UI/UX Polish (Priority: Medium)**
   - Add animations and transitions
   - Improve mobile responsiveness
   - Add confirmation dialogs

5. **Documentation (Priority: Low)**
   - Add JSDoc comments
   - Update user guide
   - Create API documentation

---

## 🐛 Known Issues & Limitations

None currently - backend implementation is complete and tested through type checking. Frontend integration will reveal any edge cases.

---

## 📚 Resources

- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Zod Validation](https://zod.dev/)

---

**Last Updated:** 2025-11-04
**Status:** Backend Complete ✅ | Frontend Integration Pending 🔄
