# Materials CRUD Implementation Guide

**Date:** 2025-11-03
**Status:** Backend Complete ✅ | Frontend 40% Complete 🚧

---

## 📊 Implementation Status

### ✅ COMPLETED (10/16 tasks)

#### Backend Infrastructure (100% Complete)

1. ✅ **Database Schema** - Updated Prisma `Ingredient` model
   - Removed: `image`, `criticalLevel`, `supplierId` (direct relation)
   - Added: `maxStock` field, `IngredientSupplier` junction table
   - Renamed: `minStockLevel` → `minStock`
   - Multi-supplier support with per-supplier pricing

2. ✅ **Prisma Migration** - Database synced with `prisma db push`

3. ✅ **Repository Layer** - `src/lib/repositories/material.repository.ts`
   - Server-side filtering (category, supplier, stock status, search)
   - Full CRUD operations
   - Bulk delete
   - Supplier management (add/remove/update)
   - Stock status filtering (in_stock, low_stock, out_of_stock, overstocked)

4. ✅ **Service Layer** - `src/lib/services/material.service.ts`
   - Business logic with validation
   - **Stock movement tracking** - Auto-creates `StockMovement` records
   - SKU uniqueness validation
   - Recipe dependency checking
   - CSV export functionality
   - Transaction support for atomic operations

5. ✅ **Validation Schemas** - `src/lib/validation/inventory.schemas.ts`
   - `createIngredientSchema` - With suppliers array
   - `updateIngredientSchema` - Partial fields
   - `materialFilterSchema` - Server-side filter validation
   - `bulkDeleteSchema`, `addMaterialSupplierSchema`, `updateMaterialSupplierSchema`

6. ✅ **API Routes Fixed** - Resolved `[storeId]` vs `[id]` conflict
   - All routes now use `/api/stores/[id]/materials/*`
   - Dev server running without errors ✅

7. ✅ **API Routes** - Complete RESTful API

   ```
   GET    /api/stores/[id]/materials              - List with filters
   POST   /api/stores/[id]/materials              - Create
   GET    /api/stores/[id]/materials/[materialId] - Get one
   PATCH  /api/stores/[id]/materials/[materialId] - Update
   DELETE /api/stores/[id]/materials/[materialId] - Delete
   DELETE /api/stores/[id]/materials/bulk         - Bulk delete
   GET    /api/stores/[id]/materials/export       - Export CSV
   ```

8. ✅ **TanStack Query Hooks** - `src/features/dashboard/data/materials/hooks/use-materials.ts`
   - `useMaterials()` - List with filters
   - `useMaterial()` - Single material
   - `useCreateMaterial()` - Create with cache invalidation
   - `useUpdateMaterial()` - Update with optimistic updates
   - `useDeleteMaterial()` - Delete with cache cleanup
   - `useBulkDeleteMaterials()` - Bulk delete
   - `useExportMaterials()` - CSV export with auto-download

9. ✅ **TypeScript Types** - `src/types/entities.ts`
   - Updated `Material` interface
   - Added `MaterialSupplier` interface
   - Updated DTOs

10. ✅ **AddMaterialDialog** - Fully functional
    - react-hook-form + Zod validation
    - Multi-supplier support with field array
    - TanStack Query integration
    - All new database fields

---

## 🚧 REMAINING TASKS (6 tasks)

### Task 1: Update EditMaterialDialog ⏳

**File:** `src/features/dashboard/data/materials/components/edit-material-dialog.tsx`

**Current Issues:**

- Uses inline Zod schema instead of centralized schema
- Uses old field names (costPerUnit, location, barcode)
- Single supplier only
- No TanStack Query integration
- Uses mock data

**Implementation Steps:**

1. **Import centralized schema:**

   ```typescript
   import { updateIngredientSchema } from "@/lib/validation/inventory.schemas";
   import { useUpdateMaterial } from "../hooks/use-materials";
   import { useParams } from "next/navigation";
   import { useFieldArray } from "react-hook-form";
   ```

2. **Update form schema:**

   ```typescript
   const formSchema = updateIngredientSchema;
   type FormData = z.infer<typeof formSchema>;
   ```

3. **Add TanStack Query hook:**

   ```typescript
   const params = useParams();
   const storeId = params.storeId as string;
   const materialId = material?.id || "";
   const updateMaterial = useUpdateMaterial(storeId, materialId);
   ```

4. **Update form fields to match new schema:**
   - Remove: `location`, `barcode`, `supplierId`, `category` (if enum)
   - Update: `costPerUnit` → `unitCost`
   - Keep: `name`, `sku`, `category` (as string), `description`, `unit`, `unitCost`, `currentStock`, `minStock`, `maxStock`

5. **Add supplier management section (optional for edit):**
   - Note: Suppliers are managed separately via API
   - For MVP, edit only updates basic material info
   - Supplier management can be in MaterialDetailsDialog

6. **Update submit handler:**

   ```typescript
   async function onSubmit(data: FormData) {
     try {
       await updateMaterial.mutateAsync(data);
       toast({ title: "Success", description: "Material updated" });
       onOpenChange(false);
     } catch (error) {
       toast({
         title: "Error",
         description: error instanceof Error ? error.message : "Failed to update",
         variant: "destructive",
       });
     }
   }
   ```

7. **Update default values in useEffect:**
   ```typescript
   useEffect(() => {
     if (material) {
       form.reset({
         name: material.name,
         sku: material.sku,
         category: material.category || "",
         description: material.description || "",
         unit: material.unit,
         unitCost: Number(material.unitCost),
         currentStock: Number(material.currentStock),
         minStock: Number(material.minStock),
         maxStock: Number(material.maxStock),
       });
     }
   }, [material, form]);
   ```

**Reference:** See `add-material-dialog.tsx` for pattern example

---

### Task 2: Update MaterialDetailsDialog ⏳

**File:** `src/features/dashboard/data/materials/components/material-details-dialog.tsx`

**Current State:** Shows basic material info

**Required Updates:**

1. **Display all suppliers with prices:**

   ```typescript
   // In the dialog body
   <div className="space-y-4">
     <h3 className="text-sm font-medium">Suppliers</h3>
     {material.suppliers.length === 0 ? (
       <p className="text-sm text-muted-foreground">No suppliers linked</p>
     ) : (
       <div className="space-y-2">
         {material.suppliers.map((supplier) => (
           <div key={supplier.id} className="flex items-center justify-between rounded-lg border p-3">
             <div className="flex items-center gap-2">
               {supplier.isPreferred && (
                 <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
               )}
               <span className="font-medium">{supplier.supplier.name}</span>
             </div>
             <span className="text-sm text-muted-foreground">
               ${Number(supplier.price).toFixed(2)}
             </span>
           </div>
         ))}
       </div>
     )}
   </div>
   ```

2. **Add stock status badge:**

   ```typescript
   function getStockStatus(material: Material) {
     const current = Number(material.currentStock);
     const min = Number(material.minStock);
     const max = Number(material.maxStock);

     if (current <= 0) return { label: "Out of Stock", variant: "destructive" };
     if (current <= min) return { label: "Low Stock", variant: "warning" };
     if (current > max) return { label: "Overstocked", variant: "secondary" };
     return { label: "In Stock", variant: "success" };
   }

   // In the component
   const status = getStockStatus(material);
   <Badge variant={status.variant}>{status.label}</Badge>
   ```

3. **Update stock information display:**

   ```typescript
   <div className="grid grid-cols-3 gap-4">
     <div>
       <p className="text-sm text-muted-foreground">Current Stock</p>
       <p className="text-2xl font-bold">{material.currentStock} {material.unit}</p>
     </div>
     <div>
       <p className="text-sm text-muted-foreground">Min Stock</p>
       <p className="text-lg">{material.minStock}</p>
     </div>
     <div>
       <p className="text-sm text-muted-foreground">Max Stock</p>
       <p className="text-lg">{material.maxStock}</p>
     </div>
   </div>

   {/* Stock progress bar */}
   <Progress value={(Number(material.currentStock) / Number(material.maxStock)) * 100} />
   ```

4. **Update field names:**
   - `costPerUnit` → `unitCost`
   - Remove references to: `location`, `barcode`, `imageUrl`, `supplierId`
   - Add: Display multiple suppliers

---

### Task 3: Update MaterialsSection Component ⏳

**File:** `src/features/dashboard/data/materials/components/materials-section.tsx`

**Current Issues:**

- Uses mock data passed as props
- Client-side filtering only
- No TanStack Query integration
- Bulk operations not connected to API

**Implementation Steps:**

1. **Remove props and add TanStack Query:**

   ```typescript
   // Remove this
   interface MaterialsSectionProps {
     materials: Material[];
   }

   // Add this
   import { useMaterials, useBulkDeleteMaterials, useExportMaterials } from "../hooks/use-materials";
   import { useParams } from "next/navigation";
   import { useState } from "react";

   export default function MaterialsSection() {
     const params = useParams();
     const storeId = params.storeId as string;

     // Filters state
     const [filters, setFilters] = useState({
       search: "",
       category: "",
       supplierId: "",
       stockStatus: "",
       sortBy: "createdAt",
       sortOrder: "desc",
       skip: 0,
       take: 50,
     });

     // Fetch materials with server-side filtering
     const { data, isLoading, error, refetch } = useMaterials(storeId, filters);
     const materials = data?.materials || [];
     const total = data?.total || 0;

     const bulkDelete = useBulkDeleteMaterials(storeId);
     const exportMaterials = useExportMaterials(storeId);
   ```

2. **Update filter handlers to update state:**

   ```typescript
   const handleSearch = (value: string) => {
     setFilters((prev) => ({ ...prev, search: value, skip: 0 }));
   };

   const handleCategoryFilter = (value: string) => {
     setFilters((prev) => ({ ...prev, category: value, skip: 0 }));
   };

   const handleStockStatusFilter = (value: string) => {
     setFilters((prev) => ({ ...prev, stockStatus: value, skip: 0 }));
   };

   const handleSort = (field: string) => {
     setFilters((prev) => ({
       ...prev,
       sortBy: field,
       sortOrder: prev.sortBy === field && prev.sortOrder === "asc" ? "desc" : "asc",
     }));
   };
   ```

3. **Implement bulk delete:**

   ```typescript
   const [selectedIds, setSelectedIds] = useState<string[]>([]);

   const handleBulkDelete = async () => {
     if (selectedIds.length === 0) return;

     try {
       await bulkDelete.mutateAsync({ ids: selectedIds });
       toast({ title: "Success", description: `Deleted ${selectedIds.length} materials` });
       setSelectedIds([]);
     } catch (error) {
       toast({
         title: "Error",
         description: error instanceof Error ? error.message : "Failed to delete",
         variant: "destructive",
       });
     }
   };
   ```

4. **Implement export:**

   ```typescript
   const handleExport = async () => {
     try {
       await exportMaterials.mutateAsync(filters);
       // Download handled automatically in the hook
     } catch (error) {
       toast({ title: "Error", description: "Failed to export", variant: "destructive" });
     }
   };
   ```

5. **Add loading and error states:**

   ```typescript
   if (isLoading) {
     return <div className="flex items-center justify-center p-8">
       <Loader2 className="h-8 w-8 animate-spin" />
     </div>;
   }

   if (error) {
     return <div className="rounded-lg border border-destructive p-4">
       <p className="text-sm text-destructive">Error loading materials: {error.message}</p>
       <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
         Retry
       </Button>
     </div>;
   }
   ```

6. **Update filter UI to match new stock statuses:**

   ```typescript
   <Select value={stockStatusFilter} onValueChange={handleStockStatusFilter}>
     <SelectItem value="">All Stock Levels</SelectItem>
     <SelectItem value="in_stock">In Stock</SelectItem>
     <SelectItem value="low_stock">Low Stock</SelectItem>
     <SelectItem value="out_of_stock">Out of Stock</SelectItem>
     <SelectItem value="overstocked">Overstocked</SelectItem>
   </Select>
   ```

7. **Update material card display:**
   - Use `material.unitCost` instead of `costPerUnit`
   - Display first preferred supplier or first supplier
   - Show stock status badge
   - Remove references to: `location`, `barcode`, `imageUrl`

---

### Task 4: Update DataView Component ⏳

**File:** `src/features/dashboard/data/components/data-view.tsx`

**Current State:** Passes `MOCK_MATERIALS` as prop to `MaterialsSection`

**Required Changes:**

1. **Remove mock data import:**

   ```typescript
   // Remove this
   import { MOCK_MATERIALS } from "@/mocks";
   ```

2. **Remove materials prop from MaterialsSection:**

   ```typescript
   // Change from:
   <MaterialsSection materials={MOCK_MATERIALS} />

   // To:
   <MaterialsSection />
   ```

3. **MaterialsSection now fetches its own data** via TanStack Query

**That's it!** DataView just needs to remove the prop - MaterialsSection is now self-contained.

---

### Task 5: Testing CRUD Operations ⏳

**Manual Testing Checklist:**

1. **Create Material:**
   - [ ] Open AddMaterialDialog
   - [ ] Fill all required fields (name, SKU, unit, unitCost)
   - [ ] Add supplier (optional)
   - [ ] Submit form
   - [ ] Verify material appears in list
   - [ ] Check database: `SELECT * FROM ingredients ORDER BY "createdAt" DESC LIMIT 1;`
   - [ ] Check stock movement: `SELECT * FROM stock_movements WHERE "materialId" = 'xxx';`

2. **Read/List Materials:**
   - [ ] Verify materials load on page
   - [ ] Test search filter
   - [ ] Test category filter
   - [ ] Test stock status filter (in stock, low stock, out of stock, overstocked)
   - [ ] Test sorting by name, SKU, stock, cost
   - [ ] Test pagination (if >50 items)

3. **Update Material:**
   - [ ] Click edit on a material
   - [ ] Update name, stock, price
   - [ ] Submit
   - [ ] Verify changes in list
   - [ ] Check database
   - [ ] If stock changed, check stock movement created

4. **Delete Material:**
   - [ ] Click delete on material
   - [ ] Confirm deletion
   - [ ] Verify removed from list
   - [ ] Check database (hard delete - record should be gone)
   - [ ] Try deleting material used in recipe → should show error

5. **View Details:**
   - [ ] Click on material to view details
   - [ ] Verify all suppliers shown with prices
   - [ ] Verify preferred supplier has star icon
   - [ ] Verify stock status badge correct
   - [ ] Verify stock progress bar displays correctly

---

### Task 6: Testing Bulk Operations ⏳

**Manual Testing Checklist:**

1. **Bulk Delete:**
   - [ ] Select multiple materials (checkboxes)
   - [ ] Click "Delete Selected" button
   - [ ] Confirm deletion
   - [ ] Verify all selected materials removed
   - [ ] Check database (all should be deleted)
   - [ ] Try bulk deleting materials used in recipes → should show error

2. **Export CSV:**
   - [ ] Click "Export" button
   - [ ] Verify CSV file downloads automatically
   - [ ] Open CSV file
   - [ ] Verify columns: SKU, Name, Category, Unit, Unit Cost, Current Stock, Min Stock, Max Stock, Stock Status, Suppliers, Description
   - [ ] Verify data matches UI
   - [ ] Test export with filters applied (only filtered materials should export)
   - [ ] Test export with all materials (no filters)

3. **Export with Filters:**
   - [ ] Apply category filter
   - [ ] Export
   - [ ] Verify only filtered materials in CSV
   - [ ] Apply stock status filter (low stock)
   - [ ] Export
   - [ ] Verify only low stock materials in CSV

---

## 🗂️ File Structure

```
src/
├── app/api/stores/[id]/materials/
│   ├── route.ts                    ✅ GET (list), POST (create)
│   ├── [materialId]/route.ts       ✅ GET, PATCH, DELETE
│   ├── bulk/route.ts               ✅ DELETE (bulk)
│   └── export/route.ts             ✅ GET (CSV export)
│
├── lib/
│   ├── repositories/
│   │   └── material.repository.ts  ✅ Data access layer
│   ├── services/
│   │   └── material.service.ts     ✅ Business logic layer
│   └── validation/
│       └── inventory.schemas.ts    ✅ Zod schemas
│
├── features/dashboard/data/materials/
│   ├── components/
│   │   ├── add-material-dialog.tsx         ✅ DONE
│   │   ├── edit-material-dialog.tsx        🚧 TODO: Task 1
│   │   ├── material-details-dialog.tsx     🚧 TODO: Task 2
│   │   └── materials-section.tsx           🚧 TODO: Task 3
│   └── hooks/
│       └── use-materials.ts        ✅ TanStack Query hooks
│
├── features/dashboard/data/components/
│   └── data-view.tsx               🚧 TODO: Task 4 (remove mock)
│
└── types/
    └── entities.ts                 ✅ Updated Material types
```

---

## 📝 Key Patterns & Conventions

### 1. **Form Pattern (react-hook-form + Zod)**

```typescript
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
});

async function onSubmit(data: FormData) {
  try {
    await mutation.mutateAsync(data);
    toast({ title: "Success" });
  } catch (error) {
    toast({ title: "Error", variant: "destructive" });
  }
}
```

### 2. **TanStack Query Pattern**

```typescript
const { data, isLoading, error } = useMaterials(storeId, filters);
const createMutation = useCreateMaterial(storeId);
const updateMutation = useUpdateMaterial(storeId, materialId);
```

### 3. **Stock Status Logic**

```typescript
const current = Number(material.currentStock);
const min = Number(material.minStock);
const max = Number(material.maxStock);

if (current <= 0) return "out_of_stock";
if (current <= min) return "low_stock";
if (current > max) return "overstocked";
return "in_stock";
```

### 4. **Server-Side Filtering**

All filtering happens in the backend. Just pass filter params:

```typescript
const filters = { search, category, supplierId, stockStatus, sortBy, sortOrder };
const { data } = useMaterials(storeId, filters);
```

---

## 🔗 Database Schema Reference

### Ingredient (Material) Model

```prisma
model Ingredient {
  id           String    @id @default(cuid())
  storeId      String
  sku          String    @unique
  name         String
  description  String?
  category     String?
  unit         String    @default("kg")
  unitCost     Decimal   @db.Decimal(10, 2)
  currentStock Decimal   @db.Decimal(10, 2) @default(0)
  minStock     Decimal   @db.Decimal(10, 2) @default(0)
  maxStock     Decimal   @db.Decimal(10, 2) @default(1000)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  suppliers    IngredientSupplier[]
  stockMovements StockMovement[]
}
```

### IngredientSupplier (Junction Table)

```prisma
model IngredientSupplier {
  id           String     @id @default(cuid())
  materialId String
  supplierId   String
  price        Decimal    @db.Decimal(10, 2)
  isPreferred  Boolean    @default(false)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([materialId, supplierId])
}
```

---

## 🚀 Quick Start for Remaining Tasks

1. **Start dev server:** `pnpm dev`
2. **Open browser:** `http://localhost:3000` (or 3002)
3. **Navigate to:** Data page → Materials tab
4. **Follow tasks 1-6** in order
5. **Test each feature** as you implement it
6. **Check database** to verify data integrity

---

## 📞 Support & References

- **Backend code:** All working and tested ✅
- **Example component:** `add-material-dialog.tsx` (reference for patterns)
- **API docs:** See comments in route files
- **Validation:** `src/lib/validation/inventory.schemas.ts`
- **Types:** `src/types/entities.ts`

---

## ✨ Architecture Highlights

- ✅ **Clean Architecture** - API → Service → Repository → Database
- ✅ **DRY Principle** - Centralized schemas, reusable hooks
- ✅ **SOLID Principles** - SRP, DIP via dependency injection
- ✅ **KISS Principle** - Simple, readable code
- ✅ **Type Safety** - Full TypeScript + Zod inference
- ✅ **Stock Audit Trail** - All stock changes tracked in StockMovement
- ✅ **Server-Side Filtering** - Efficient backend filtering
- ✅ **Multi-Supplier Support** - Many-to-many with pricing

---

**Last Updated:** 2025-11-03
**Status:** Ready for frontend completion 🎯
