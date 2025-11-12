# Analisis Flow: Data > Materials ke Management > Start Production

## Overview
Dokumen ini menjelaskan logic dan flow dari halaman **Data > Materials** ke **Management > Start Production** di aplikasi dashboard EPIDOM.

---

## 1. Data Layer: Materials Management

### 1.1. Halaman Materials (`src/features/dashboard/data/materials/`)
**File**: `src/features/dashboard/data/materials/components/materials-section.tsx`

#### Fungsi Utama:
- Menampilkan daftar materials dengan stock information
- Filter berdasarkan kategori, supplier, dan stock status
- CRUD operations untuk materials
- Menampilkan `currentStock` untuk setiap material

#### Data Structure:
```typescript
MaterialWithSuppliers {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  unitCost: number;
  currentStock: number;  // ← Kunci untuk production
  minStock: number;
  maxStock: number;
  storeId: string;
  suppliers: MaterialSupplier[];
}
```

#### Key Points:
- `currentStock` adalah field utama yang digunakan untuk production
- Stock status dihitung berdasarkan `currentStock` vs `minStock`/`maxStock`
- Materials dapat di-update melalui halaman ini

---

## 2. Recipe Layer: Recipe dengan Ingredients

### 2.1. Recipe Structure
**File**: `src/features/dashboard/data/recipes/hooks/use-recipes.ts`

#### Data Structure:
```typescript
RecipeWithIngredients {
  id: string;
  name: string;
  yieldQuantity: number;  // Output quantity per batch
  yieldUnit: string;       // Unit untuk output
  productionTimeMinutes: number;
  costPerBatch: number;
  ingredients: Array<{
    id: string;
    materialId: string;    // ← Link ke Material
    quantity: number;      // ← Quantity yang dibutuhkan
    unit: string;
    material: {
      id: string;
      name: string;
      currentStock: number; // ← Stock saat ini
      unit: string;
      unitCost: number;
    };
  }>;
  products?: Array<{
    id: string;
    name: string;
    // Product yang dihasilkan dari recipe ini
  }>;
}
```

#### Key Points:
- Recipe memiliki multiple `ingredients` yang mereferensi `Material`
- Setiap ingredient memiliki `quantity` yang dibutuhkan
- Recipe memiliki `yieldQuantity` untuk menentukan output per batch
- Recipe bisa linked ke multiple `Products`

---

## 3. Production Flow: Start Production

### 3.1. Halaman Recipe Production
**File**: `src/features/dashboard/management/recipe-production/recipe-production.tsx`

#### Flow:
1. **User memilih Recipe** dari daftar recipes
2. **System menghitung Material Availability** berdasarkan:
   - Recipe ingredients (required quantity)
   - Material currentStock (available quantity)
   - Batch multiplier (plannedQuantity / yieldQuantity)

#### Logic Material Availability Check:
```67:92:src/features/dashboard/management/recipe-production/recipe-production.tsx
  // Get recipe ingredients with current stock availability
  const recipeIngredients = useMemo(() => {
    if (!selectedRecipe?.ingredients) return [];

    return selectedRecipe.ingredients.map((ingredient: any) => {
      const required = Number(ingredient.quantity);
      const available = Number(ingredient.material.currentStock);
      let status: "sufficient" | "low" | "insufficient";

      if (available >= required) {
        status = "sufficient";
      } else if (available >= required * 0.5) {
        status = "low";
      } else {
        status = "insufficient";
      }

      return {
        materialId: ingredient.materialId,
        materialName: ingredient.material.name,
        required,
        available,
        unit: ingredient.unit,
        status,
      };
    });
  }, [selectedRecipe]);
```

#### Status Calculation:
- **Sufficient**: `available >= required`
- **Low**: `available >= required * 0.5` (tapi kurang dari required)
- **Insufficient**: `available < required * 0.5`

#### Production Button Logic:
```94:101:src/features/dashboard/management/recipe-production/recipe-production.tsx
  // Check if production can start (all materials have sufficient quantity)
  const canStartProduction = useMemo(() => {
    if (!selectedRecipe || recipeIngredients.length === 0) return false;
    // Only allow production if all materials have available >= required
    return recipeIngredients.every(
      (ing: { available: number; required: number }) => ing.available >= ing.required
    );
  }, [selectedRecipe, recipeIngredients]);
```

**Key Point**: Production hanya bisa dimulai jika **SEMUA materials memiliki stock yang cukup** (`available >= required`).

---

### 3.2. Start Production Dialog
**File**: `src/features/dashboard/management/recipe-production/start-production-dialog.tsx`

#### Form Input:
- `productId`: Product yang akan dihasilkan
- `recipeId`: Recipe yang digunakan
- `plannedQuantity`: Quantity yang ingin diproduksi
- `scheduledDate`: Tanggal/jam produksi
- `notes`: Catatan tambahan

#### Calculated Values:
```118:121:src/features/dashboard/management/recipe-production/start-production-dialog.tsx
  // Watch planned quantity for real-time calculations
  const plannedQuantity = form.watch("plannedQuantity");
  const totalCost = (plannedQuantity / Number(recipe.yieldQuantity)) * Number(recipe.costPerBatch);
  const totalTime = (plannedQuantity / Number(recipe.yieldQuantity)) * recipe.productionTimeMinutes;
```

**Formula**:
- `batchMultiplier = plannedQuantity / yieldQuantity`
- `totalCost = batchMultiplier * costPerBatch`
- `totalTime = batchMultiplier * productionTimeMinutes`

#### Validation:
- Production tidak bisa dimulai jika ada materials dengan status `insufficient`
- Production tidak bisa dimulai jika tidak ada product linked ke recipe

---

### 3.3. Backend: Production Batch Service
**File**: `src/lib/services/production-batch.service.ts`

#### Start Production Process:

##### Step 1: Validate Recipe
```110:114:src/lib/services/production-batch.service.ts
    // Validate recipe exists and belongs to store
    const recipe = await recipeRepository.findById(data.recipeId);
    if (!recipe || recipe.storeId !== data.storeId) {
      throw new Error("Recipe not found or does not belong to this store");
    }
```

##### Step 2: Calculate Batch Multiplier
```116:117:src/lib/services/production-batch.service.ts
    // Calculate batch multiplier
    const batchMultiplier = data.plannedQuantity / Number(recipe.yieldQuantity);
```

**Example**:
- Recipe yield: 10 units per batch
- Planned quantity: 30 units
- Batch multiplier: 30 / 10 = 3 batches

##### Step 3: Check Material Availability
```119:131:src/lib/services/production-batch.service.ts
    // Check material availability
    const { isAvailable, ingredients } = await this.checkMaterialAvailability(
      data.recipeId,
      batchMultiplier
    );

    if (!isAvailable) {
      const insufficientMaterials = ingredients
        .filter((ing) => ing.status === "insufficient")
        .map((ing) => ing.materialName)
        .join(", ");
      throw new Error(`Insufficient materials: ${insufficientMaterials}`);
    }
```

**Material Availability Check Logic**:
```67:97:src/lib/services/production-batch.service.ts
    const ingredients = recipe.ingredients.map((ingredient) => {
      const required = Number(ingredient.quantity) * multiplier;
      const available = Number(ingredient.material.currentStock);
      let status: "sufficient" | "low" | "insufficient";

      if (available >= required) {
        status = "sufficient";
      } else if (available >= required * 0.5) {
        status = "low";
      } else {
        status = "insufficient";
      }

      return {
        materialId: ingredient.materialId,
        materialName: ingredient.material.name,
        required,
        available,
        unit: ingredient.unit,
        status,
      };
    });

    // Check if ALL materials have sufficient stock (available >= required)
    const isAvailable = ingredients.every((ing) => ing.available >= ing.required);
```

**Key Point**:
- `required = ingredient.quantity * batchMultiplier`
- Production hanya bisa dimulai jika **semua materials memiliki `available >= required`**

##### Step 4: Create Production Batch (Transaction)
```136:190:src/lib/services/production-batch.service.ts
    // Start transaction
    return prisma.$transaction(async (tx) => {
      // 1. Create production batch
      const batch = await tx.productionBatch.create({
        data: {
          storeId: data.storeId,
          batchNumber,
          productId: data.productId,
          recipeId: data.recipeId,
          plannedQuantity: data.plannedQuantity,
          unit: recipe.yieldUnit,
          status: ProductionStatus.IN_PROGRESS,
          scheduledDate: data.scheduledDate,
          notes: data.notes || null,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
          recipe: {
            select: {
              id: true,
              name: true,
              yieldQuantity: true,
              yieldUnit: true,
              ingredients: {
                include: {
                  material: {
                    select: {
                      id: true,
                      name: true,
                      currentStock: true,
                      unit: true,
                    },
                  },
                },
              },
            },
          },
          stockMovements: {
            select: {
              id: true,
              type: true,
              quantity: true,
              unit: true,
              createdAt: true,
            },
          },
        },
      });
```

##### Step 5: Deduct Materials from Stock
```192:225:src/lib/services/production-batch.service.ts
      // 2. Deduct materials from stock and create stock movements
      for (const ingredient of recipe.ingredients) {
        const deductionAmount = Number(ingredient.quantity) * batchMultiplier;
        const material = await tx.material.findUnique({
          where: { id: ingredient.materialId },
        });

        if (!material) {
          throw new Error(`Material ${ingredient.materialId} not found`);
        }

        const newBalance = Number(material.currentStock) - deductionAmount;

        // Update material stock
        await tx.material.update({
          where: { id: ingredient.materialId },
          data: {
            currentStock: newBalance,
          },
        });

        // Create stock movement record (PRODUCTION_OUT for materials)
        await tx.stockMovement.create({
          data: {
            materialId: ingredient.materialId,
            productionBatchId: batch.id,
            type: MovementType.PRODUCTION_OUT,
            quantity: deductionAmount,
            unit: ingredient.unit,
            balanceAfter: newBalance,
            notes: `Production batch ${batchNumber} - ${recipe.name}`,
          },
        });
      }
```

**Process**:
1. Untuk setiap ingredient dalam recipe:
   - Hitung `deductionAmount = ingredient.quantity * batchMultiplier`
   - Ambil material current stock
   - Hitung `newBalance = currentStock - deductionAmount`
   - Update material `currentStock` dengan `newBalance`
   - Buat `StockMovement` record dengan type `PRODUCTION_OUT`

**Key Points**:
- Semua operasi dilakukan dalam **database transaction** untuk consistency
- Materials langsung dikurangi saat production dimulai (bukan saat complete)
- Setiap deduction dicatat dalam `StockMovement` untuk audit trail

---

## 4. Complete Production

### 4.1. Complete Production Process
**File**: `src/lib/services/production-batch.service.ts`

#### Process:
```234:302:src/lib/services/production-batch.service.ts
  async completeProduction(
    batchId: string,
    storeId: string,
    actualQuantity: number
  ): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Get batch details
    const batch = await productionBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error("Production batch not found");
    }

    // Validate status
    if (batch.status !== ProductionStatus.IN_PROGRESS) {
      throw new Error("Only batches in progress can be completed");
    }

    // Start transaction
    return prisma.$transaction(async (tx) => {
      // 1. Get current product stock
      const product = await tx.product.findUnique({
        where: { id: batch.productId },
      });

      if (!product) {
        throw new Error("Product not found");
      }

      const newBalance = Number(product.currentStock) + actualQuantity;

      // 2. Update product stock
      await tx.product.update({
        where: { id: batch.productId },
        data: {
          currentStock: newBalance,
        },
      });

      // 3. Create stock movement record (PRODUCTION_IN for products)
      await tx.stockMovement.create({
        data: {
          productId: batch.productId,
          productionBatchId: batchId,
          type: MovementType.PRODUCTION_IN,
          quantity: actualQuantity,
          unit: batch.unit,
          balanceAfter: newBalance,
          notes: `Production batch ${batch.batchNumber} completed`,
        },
      });

      // 4. Update batch status
      const updatedBatch = await tx.productionBatch.update({
        where: { id: batchId },
        data: {
          status: ProductionStatus.COMPLETED,
          actualQuantity,
          completedDate: new Date(),
        },
      });

      return updatedBatch;
    });
  }
```

#### Key Points:
- Materials sudah dikurangi saat **Start Production**
- Products ditambahkan ke stock saat **Complete Production**
- `actualQuantity` bisa berbeda dengan `plannedQuantity` (actual hasil produksi)

---

## 5. Cancel Production

### 5.1. Cancel Production Process
**File**: `src/lib/services/production-batch.service.ts`

#### Process:
```307:382:src/lib/services/production-batch.service.ts
  async cancelProduction(
    batchId: string,
    storeId: string,
    notes?: string
  ): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Get batch details
    const batch = await productionBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error("Production batch not found");
    }

    // Validate status
    if (batch.status === ProductionStatus.COMPLETED) {
      throw new Error("Cannot cancel completed batches");
    }

    if (batch.status === ProductionStatus.CANCELLED) {
      throw new Error("Batch is already cancelled");
    }

    // Start transaction
    return prisma.$transaction(async (tx) => {
      // 1. Restore materials to stock (if batch was started)
      if (batch.status === ProductionStatus.IN_PROGRESS && batch.recipe) {
        const batchMultiplier = Number(batch.plannedQuantity) / Number(batch.recipe.yieldQuantity);

        for (const ingredient of batch.recipe.ingredients) {
          const restorationAmount = Number(ingredient.quantity) * batchMultiplier;
          const material = await tx.material.findUnique({
            where: { id: ingredient.materialId },
          });

          if (!material) continue;

          const newBalance = Number(material.currentStock) + restorationAmount;

          // Update material stock
          await tx.material.update({
            where: { id: ingredient.materialId },
            data: {
              currentStock: newBalance,
            },
          });

          // Create stock movement record (ADJUSTMENT for material restoration)
          await tx.stockMovement.create({
            data: {
              materialId: ingredient.materialId,
              productionBatchId: batchId,
              type: MovementType.ADJUSTMENT,
              quantity: restorationAmount,
              unit: ingredient.unit,
              balanceAfter: newBalance,
              notes: `Production batch ${batch.batchNumber} cancelled - materials restored`,
            },
          });
        }
      }

      // 2. Update batch status
      const updatedBatch = await tx.productionBatch.update({
        where: { id: batchId },
        data: {
          status: ProductionStatus.CANCELLED,
          notes: notes || batch.notes,
        },
      });

      return updatedBatch;
    });
  }
```

#### Key Points:
- Jika batch status `IN_PROGRESS`, materials akan dikembalikan ke stock
- Materials dikembalikan dengan amount yang sama dengan yang dikurangi
- Stock movement type `ADJUSTMENT` digunakan untuk restoration

---

## 6. Cache Invalidation

### 6.1. After Start Production
**File**: `src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts`

```229:243:src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts
export function useStartProduction(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductionBatchFormInput) => createProductionBatch(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-batches", storeId] });
      queryClient.invalidateQueries({ queryKey: ["materials", storeId] });
      // Invalidate alerts (material stock may have changed)
      queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) });
      // Invalidate stock movements (materials were consumed)
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all(storeId) });
    },
  });
}
```

#### Cache yang di-invalidate:
1. **Production batches**: Update daftar batches
2. **Materials**: Update stock materials (karena sudah dikurangi)
3. **Alerts**: Update low stock alerts
4. **Stock movements**: Update daftar stock movements

---

## 7. Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA > MATERIALS                         │
│  - User mengelola materials                                 │
│  - Set currentStock untuk setiap material                   │
│  - Materials memiliki minStock, maxStock                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    RECIPE SETUP                             │
│  - Recipe memiliki ingredients (link ke Materials)          │
│  - Setiap ingredient memiliki quantity                      │
│  - Recipe memiliki yieldQuantity (output per batch)         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              MANAGEMENT > START PRODUCTION                   │
│  1. User memilih Recipe                                     │
│  2. System check Material Availability:                     │
│     - required = ingredient.quantity                        │
│     - available = material.currentStock                     │
│     - status: sufficient / low / insufficient               │
│  3. User input plannedQuantity                              │
│  4. System calculate batchMultiplier:                       │
│     - batchMultiplier = plannedQuantity / yieldQuantity     │
│  5. System check availability dengan multiplier:            │
│     - required = ingredient.quantity * batchMultiplier      │
│     - available >= required ? ✅ : ❌                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              START PRODUCTION (BACKEND)                     │
│  1. Validate recipe exists & belongs to store               │
│  2. Calculate batchMultiplier                               │
│  3. Check material availability                             │
│  4. Create ProductionBatch (status: IN_PROGRESS)            │
│  5. Deduct materials from stock (TRANSACTION):              │
│     - For each ingredient:                                  │
│       * deductionAmount = quantity * batchMultiplier        │
│       * newBalance = currentStock - deductionAmount         │
│       * Update material.currentStock = newBalance           │
│       * Create StockMovement (PRODUCTION_OUT)               │
│  6. Return batch with updated data                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPLETE PRODUCTION                            │
│  1. User input actualQuantity                               │
│  2. Update Product stock:                                   │
│     - newBalance = product.currentStock + actualQuantity    │
│     - Update product.currentStock = newBalance              │
│     - Create StockMovement (PRODUCTION_IN)                  │
│  3. Update batch status: COMPLETED                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Key Points Summary

### 8.1. Materials Stock Management
- **Materials** memiliki `currentStock` yang digunakan untuk production
- Stock dikurangi saat **Start Production** (bukan saat Complete)
- Stock dikembalikan jika production **Cancelled**

### 8.2. Recipe & Ingredients
- **Recipe** memiliki multiple `ingredients` yang link ke `Materials`
- Setiap ingredient memiliki `quantity` yang dibutuhkan per batch
- Recipe memiliki `yieldQuantity` untuk menentukan output

### 8.3. Production Flow
1. **Check Availability**: System check apakah semua materials cukup
2. **Calculate Multiplier**: `batchMultiplier = plannedQuantity / yieldQuantity`
3. **Deduct Materials**: Materials dikurangi dengan amount = `quantity * batchMultiplier`
4. **Create Batch**: ProductionBatch dibuat dengan status `IN_PROGRESS`
5. **Complete Production**: Products ditambahkan ke stock saat complete

### 8.4. Transaction Safety
- Semua operasi stock dilakukan dalam **database transaction**
- Jika ada error, semua perubahan di-rollback
- Stock movements dicatat untuk audit trail

### 8.5. Validation Rules
- Production hanya bisa dimulai jika **semua materials cukup**
- Production hanya bisa di-complete jika status `IN_PROGRESS`
- Production hanya bisa di-cancel jika status bukan `COMPLETED`

---

## 9. File References

### Frontend
- `src/features/dashboard/data/materials/components/materials-section.tsx`
- `src/features/dashboard/data/materials/hooks/use-materials.ts`
- `src/features/dashboard/data/recipes/hooks/use-recipes.ts`
- `src/features/dashboard/management/recipe-production/recipe-production.tsx`
- `src/features/dashboard/management/recipe-production/start-production-dialog.tsx`
- `src/features/dashboard/management/recipe-production/material-availability-check.tsx`
- `src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts`

### Backend
- `src/lib/services/production-batch.service.ts`
- `src/lib/repositories/production-batch.repository.ts`
- `src/lib/repositories/material.repository.ts`
- `src/lib/repositories/recipe.repository.ts`
- `src/app/api/stores/[id]/production-batches/route.ts`

### Database
- `prisma/schema.prisma` (Material, Recipe, RecipeIngredient, ProductionBatch, StockMovement)

---

## 10. Conclusion

Flow dari **Data > Materials** ke **Management > Start Production** adalah:

1. **Materials** dikelola di halaman Data > Materials dengan `currentStock`
2. **Recipe** dibuat dengan ingredients yang link ke Materials
3. **Start Production** check availability, calculate multiplier, dan deduct materials
4. **Complete Production** menambahkan products ke stock
5. **Cancel Production** mengembalikan materials ke stock (jika sudah started)

Semua operasi dilakukan dengan **transaction safety** dan **audit trail** melalui StockMovement records.

