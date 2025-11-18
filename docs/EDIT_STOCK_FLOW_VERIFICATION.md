# Edit Stock Flow - Verifikasi Menyeluruh

## ✅ Status Verifikasi: SEMUA TEMUAN BENAR

Setelah melakukan investigasi menyeluruh pada seluruh app dashboard, semua temuan yang diidentifikasi **TERBUKTI BENAR**. Berikut adalah bukti-bukti verifikasi:

---

## 🔍 Verifikasi Detail

### 1. ✅ **Data Form Tidak Lengkap Dikirim ke API** - TERBUKTI

**Bukti:**
- **File:** `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx`
- **Line 146-167:** Form mengumpulkan `reason`, `notes`, `referenceId`, `adjustmentType`
- **Line 165-167:** Hanya mengirim `currentStock` ke API

```typescript
// ❌ Hanya mengirim currentStock
await updateMaterialMutation.mutateAsync({
  currentStock: newStock,
});

// Data yang TIDAK dikirim:
// - data.reason
// - data.notes
// - data.referenceId
// - data.adjustmentType
```

**Dampak:** Data audit trail hilang, tidak bisa dilacak kenapa stock di-adjust.

---

### 2. ✅ **StockMovement Notes Hardcoded** - TERBUKTI

**Bukti:**
- **File:** `src/lib/services/material.service.ts`
- **Line 201-209:** StockMovement dibuat dengan notes hardcoded

```typescript
await tx.stockMovement.create({
  data: {
    materialId: materialId,
    type: MovementType.ADJUSTMENT,
    quantity: difference,
    unit: material.unit,
    balanceAfter: newStock,
    notes: `Stock ${difference > 0 ? "increase" : "decrease"} - Manual adjustment`, // ❌ Hardcoded
  },
});
```

**Dampak:** Notes selalu sama, tidak informatif, tidak menggunakan reason/notes dari form.

---

### 3. ✅ **Tidak Ada Endpoint Khusus untuk Stock Adjustment** - TERBUKTI

**Bukti:**
- **Pencarian:** `glob_file_search` untuk `**/stock/adjust/**` → **0 files found**
- **Endpoint yang ada:**
  - `GET /api/stores/[id]/stock-movements` (untuk read)
  - `POST /api/stores/[id]/stock/import` (untuk CSV import)
  - **TIDAK ADA** `POST /api/stores/[id]/stock/adjust`

**Dokumentasi API:**
- **File:** `docs/API_SPECIFICATION.md` line 469-486
- Dokumentasi menyebutkan `POST /api/stock/adjust` tapi **TIDAK ADA implementasinya**

**Dampak:** Menggunakan endpoint update material yang tidak dirancang untuk adjustment.

---

### 4. ✅ **Cache Invalidation Key Mismatch** - TERBUKTI

**Bukti:**

**File 1:** `src/lib/utils/cache-helpers.ts` line 57
```typescript
queryClient.invalidateQueries({
  queryKey: ["stockMovements", storeId],  // ❌ camelCase, no dash
  exact: false,
});
```

**File 2:** `src/features/dashboard/management/edit-stock/hooks/use-stock-movements.ts` line 45
```typescript
export const stockMovementKeys = {
  all: (storeId: string) => ["stock-movements", storeId] as const,  // ❌ kebab-case, with dash
  // ...
};
```

**Temuan Lain:**
- **File:** `src/features/dashboard/management/edit-stock/hooks/use-import-stock.ts` line 54
  - Menggunakan: `["stock-movements", storeId]` ✅ (benar)
- **File:** `src/features/dashboard/data/products/hooks/use-products.ts` line 195, 214
  - Menggunakan: `stockMovementKeys.all(storeId)` ✅ (benar)
- **File:** `src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts` line 240, 275, 295
  - Menggunakan: `stockMovementKeys.all(storeId)` ✅ (benar)

**Kesimpulan:**
- `cache-helpers.ts` menggunakan key yang SALAH
- Semua hook lain menggunakan key yang BENAR
- Cache invalidation dari material update **TIDAK BEKERJA** untuk stock movements

**Dampak:** History dialog tidak refresh setelah adjustment, menampilkan data lama.

---

### 5. ✅ **Schema StockMovement Tidak Punya Field Reason/ReferenceId** - TERBUKTI

**Bukti:**
- **File:** `prisma/schema.prisma` line 282-304

```prisma
model StockMovement {
  id                String           @id @default(cuid())
  productId         String?
  type              MovementType
  quantity          Decimal          @db.Decimal(10, 3)
  unit              String
  balanceAfter      Decimal          @db.Decimal(10, 3)
  orderId           String?
  productionBatchId String?
  notes             String?          // ✅ Ada notes
  createdAt         DateTime         @default(now())
  materialId        String?
  // ❌ TIDAK ADA field reason
  // ❌ TIDAK ADA field referenceId
}
```

**Dampak:** Tidak bisa menyimpan reason dan referenceId meskipun form mengumpulkannya.

---

### 6. ✅ **Enum AdjustmentType Tidak Sesuai dengan MovementType** - TERBUKTI

**Bukti:**

**File 1:** `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx` line 47-50
```typescript
enum AdjustmentType {
  IN = "ADJUSTMENT_IN",   // ❌ Enum lokal
  OUT = "ADJUSTMENT_OUT", // ❌ Enum lokal
}
```

**File 2:** `prisma/schema.prisma` line 476-483
```prisma
enum MovementType {
  PURCHASE
  PRODUCTION_IN
  PRODUCTION_OUT
  SALE
  ADJUSTMENT      // ✅ Hanya satu jenis
  WASTE
}
```

**Dampak:** Tidak ada mapping yang jelas, enum lokal tidak digunakan di backend.

---

## 📊 Temuan Tambahan

### 7. **Bulk Adjustment Dialog Juga Bermasalah**

**File:** `src/features/dashboard/management/edit-stock/bulk-adjustment-dialog.tsx`

**Masalah:**
- Line 169-170: Cache invalidation di-comment out
```typescript
//     queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
//     queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
```
- Bulk adjustment juga menggunakan `useUpdateMaterial` yang sama
- Masalah yang sama: reason/notes tidak dikirim

---

### 8. **Adjustment History Dialog Menampilkan Notes Tapi Tidak Informatif**

**File:** `src/features/dashboard/management/edit-stock/adjustment-history-dialog.tsx`

**Observasi:**
- Line 283-285: Menampilkan `adj.notes` jika ada
- Line 132: Export data menggunakan `adj.notes || "-"`
- **Tapi** notes selalu hardcoded "Stock increase/decrease - Manual adjustment"
- Tidak ada field untuk reason atau referenceId

**Dampak:** History tidak informatif, semua adjustment terlihat sama.

---

## 🎯 Ringkasan Verifikasi

| # | Masalah | Status | Bukti |
|---|---------|--------|-------|
| 1 | Data form tidak dikirim | ✅ BENAR | Line 165-167 stock-adjustment-dialog.tsx |
| 2 | Notes hardcoded | ✅ BENAR | Line 208 material.service.ts |
| 3 | Tidak ada endpoint khusus | ✅ BENAR | glob search = 0 files |
| 4 | Cache key mismatch | ✅ BENAR | cache-helpers.ts vs use-stock-movements.ts |
| 5 | Schema tidak punya reason/referenceId | ✅ BENAR | schema.prisma line 282-304 |
| 6 | Enum tidak sesuai | ✅ BENAR | AdjustmentType vs MovementType |
| 7 | Bulk adjustment bermasalah | ✅ BENAR | bulk-adjustment-dialog.tsx |
| 8 | History tidak informatif | ✅ BENAR | adjustment-history-dialog.tsx |

---

## 🔄 Flow Saat Ini (Yang Bermasalah)

```
1. User mengisi form adjustment
   ├─ reason: "Count Correction"
   ├─ notes: "Found extra items"
   ├─ referenceId: "INV-2024-001"
   └─ adjustmentType: "ADJUSTMENT_IN"

2. Form submit
   └─ ❌ Hanya mengirim: { currentStock: newStock }

3. Backend (material.service.ts)
   ├─ Update material.currentStock
   └─ Create StockMovement
      ├─ type: MovementType.ADJUSTMENT ✅
      ├─ quantity: difference ✅
      └─ notes: "Stock increase - Manual adjustment" ❌ (hardcoded)

4. Cache invalidation
   ├─ materials ✅
   ├─ suppliers ✅
   ├─ alerts ✅
   └─ stockMovements ❌ (key mismatch, tidak ter-invalidate)

5. UI refresh
   ├─ Material list ✅ (refresh)
   └─ History dialog ❌ (tidak refresh, data lama)
```

---

## ✅ Flow Yang Seharusnya

```
1. User mengisi form adjustment
   ├─ reason: "Count Correction"
   ├─ notes: "Found extra items"
   ├─ referenceId: "INV-2024-001"
   └─ adjustmentType: "IN"

2. Form submit
   └─ ✅ Mengirim semua data ke: POST /api/stores/[id]/stock/adjust
      {
        materialId: "...",
        adjustmentType: "IN",
        quantity: 10,
        reason: "Count Correction",
        notes: "Found extra items",
        referenceId: "INV-2024-001"
      }

3. Backend (stock adjustment service)
   ├─ Update material.currentStock
   └─ Create StockMovement
      ├─ type: MovementType.ADJUSTMENT ✅
      ├─ quantity: quantity ✅
      ├─ notes: notes || reason ✅
      ├─ reason: reason ✅ (jika field ada)
      └─ referenceId: referenceId ✅ (jika field ada)

4. Cache invalidation
   ├─ materials ✅
   ├─ stock-movements ✅ (key yang benar)
   └─ alerts ✅

5. UI refresh
   ├─ Material list ✅
   └─ History dialog ✅ (refresh, data baru dengan reason/notes)
```

---

## 📝 Kesimpulan

**SEMUA TEMUAN TERBUKTI BENAR** setelah verifikasi menyeluruh:

1. ✅ Data form tidak lengkap dikirim
2. ✅ Notes hardcoded
3. ✅ Tidak ada endpoint khusus
4. ✅ Cache invalidation key mismatch
5. ✅ Schema tidak punya reason/referenceId
6. ✅ Enum tidak sesuai
7. ✅ Bulk adjustment juga bermasalah
8. ✅ History tidak informatif

**Prioritas Perbaikan:**
1. **HIGH:** Perbaiki cache invalidation (mempengaruhi UX langsung)
2. **HIGH:** Kirim reason/notes ke API (audit trail)
3. **MEDIUM:** Buat endpoint khusus untuk adjustment
4. **MEDIUM:** Tambahkan field reason/referenceId ke schema
5. **LOW:** Perbaiki enum mapping

---

## 🔗 Referensi File

- `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx`
- `src/lib/services/material.service.ts`
- `src/lib/utils/cache-helpers.ts`
- `src/features/dashboard/management/edit-stock/hooks/use-stock-movements.ts`
- `prisma/schema.prisma`
- `src/features/dashboard/management/edit-stock/adjustment-history-dialog.tsx`
- `src/features/dashboard/management/edit-stock/bulk-adjustment-dialog.tsx`

