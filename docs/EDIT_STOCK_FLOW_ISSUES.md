# Edit Stock Flow Issues - Analisis Masalah

## 🔍 Ringkasan Masalah

Setelah menyelidiki flow edit stock di tab Management, ditemukan beberapa masalah kritis yang mempengaruhi audit trail dan data integrity.

---

## ❌ Masalah yang Ditemukan

### 1. **Data Form Tidak Lengkap Dikirim ke API**

**Lokasi:** `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx`

**Masalah:**
- Form mengumpulkan: `reason`, `notes`, `referenceId`, `adjustmentType`
- Tapi hanya mengirim `currentStock` ke API
- Data penting untuk audit trail hilang

**Kode yang bermasalah:**
```typescript
// ❌ Hanya mengirim currentStock
await updateMaterialMutation.mutateAsync({
  currentStock: newStock,
});

// ✅ Seharusnya mengirim semua data:
// - reason
// - notes
// - referenceId
// - adjustmentType
```

---

### 2. **StockMovement Notes Hardcoded**

**Lokasi:** `src/lib/services/material.service.ts`

**Masalah:**
- StockMovement dibuat dengan notes hardcoded
- Tidak menggunakan reason/notes dari form
- ReferenceId tidak disimpan

**Kode yang bermasalah:**
```typescript
// ❌ Notes hardcoded
notes: `Stock ${difference > 0 ? "increase" : "decrease"} - Manual adjustment`,

// ✅ Seharusnya menggunakan data dari form:
// - reason (dari form)
// - notes (dari form)
// - referenceId (dari form)
```

---

### 3. **Tidak Ada Endpoint Khusus untuk Stock Adjustment**

**Masalah:**
- Menggunakan endpoint update material (`PATCH /api/stores/[id]/materials/[materialId]`)
- Endpoint ini tidak dirancang untuk stock adjustment
- Tidak ada validasi khusus untuk adjustment
- Tidak ada endpoint yang menerima reason, notes, referenceId

**Solusi yang disarankan:**
- Buat endpoint khusus: `POST /api/stores/[id]/stock/adjust`
- Atau tambahkan parameter ke update material endpoint

---

### 4. **Cache Invalidation Key Mismatch**

**Lokasi:**
- `src/lib/utils/cache-helpers.ts` (invalidate)
- `src/features/dashboard/management/edit-stock/hooks/use-stock-movements.ts` (query key)

**Masalah:**
- Cache invalidation menggunakan: `["stockMovements", storeId]`
- Query key menggunakan: `["stock-movements", storeId]` (dengan dash)
- Key tidak cocok, cache tidak ter-invalidate dengan benar

**Kode yang bermasalah:**
```typescript
// ❌ Di cache-helpers.ts
queryKey: ["stockMovements", storeId]  // camelCase, no dash

// ❌ Di use-stock-movements.ts
all: (storeId: string) => ["stock-movements", storeId]  // kebab-case, with dash
```

---

### 5. **Enum AdjustmentType Tidak Sesuai dengan MovementType**

**Lokasi:** `src/features/dashboard/management/edit-stock/stock-adjustment-dialog.tsx`

**Masalah:**
- Form menggunakan enum lokal: `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`
- Tapi MovementType enum hanya punya: `ADJUSTMENT`
- Tidak ada mapping yang jelas

**Kode yang bermasalah:**
```typescript
// ❌ Enum lokal di dialog
enum AdjustmentType {
  IN = "ADJUSTMENT_IN",
  OUT = "ADJUSTMENT_OUT",
}

// ❌ MovementType enum (dari entities.ts)
enum MovementType {
  ADJUSTMENT = "adjustment",  // Hanya satu jenis
  // ...
}
```

---

## 📊 Dampak Masalah

### 1. **Audit Trail Tidak Lengkap**
- ❌ Reason adjustment tidak tersimpan
- ❌ Notes tidak tersimpan
- ❌ ReferenceId tidak tersimpan
- ❌ History dialog tidak bisa menampilkan informasi lengkap

### 2. **Data Integrity**
- ❌ Tidak ada cara untuk melacak kenapa stock di-adjust
- ❌ Tidak ada referensi ke dokumen eksternal (referenceId)
- ❌ Sulit untuk audit dan compliance

### 3. **User Experience**
- ❌ User mengisi form lengkap tapi data tidak tersimpan
- ❌ History adjustment tidak informatif
- ❌ Tidak ada feedback bahwa data tidak tersimpan

### 4. **Cache Issues**
- ❌ Stock movements mungkin tidak ter-refresh setelah adjustment
- ❌ History dialog mungkin menampilkan data lama

---

## ✅ Solusi yang Disarankan

### 1. **Buat Endpoint Khusus untuk Stock Adjustment**

```typescript
// POST /api/stores/[id]/stock/adjust
{
  materialId?: string;
  productId?: string;
  adjustmentType: "IN" | "OUT";
  quantity: number;
  reason: string;
  notes?: string;
  referenceId?: string;
}
```

### 2. **Update Material Service untuk Menerima Adjustment Data**

```typescript
async adjustStock(input: StockAdjustmentInput) {
  // Create StockMovement dengan reason, notes, referenceId
  await tx.stockMovement.create({
    data: {
      materialId: input.materialId,
      type: MovementType.ADJUSTMENT,
      quantity: input.quantity,
      unit: material.unit,
      balanceAfter: newStock,
      notes: input.notes || input.reason,  // ✅ Gunakan dari input
      // TODO: Add reason field to StockMovement schema
      // TODO: Add referenceId field to StockMovement schema
    },
  });
}
```

### 3. **Perbaiki Cache Invalidation**

```typescript
// ✅ Gunakan query key yang konsisten
queryClient.invalidateQueries({
  queryKey: ["stock-movements", storeId],  // ✅ Match dengan query key
  exact: false,
});
```

### 4. **Update Stock Adjustment Dialog**

```typescript
// ✅ Kirim semua data ke API
await adjustStockMutation.mutateAsync({
  materialId: selectedItem.id,
  adjustmentType: data.adjustmentType === AdjustmentType.IN ? "IN" : "OUT",
  quantity: data.quantity,
  reason: data.reason,
  notes: data.notes,
  referenceId: data.referenceId,
});
```

### 5. **Tambahkan Field ke StockMovement Schema**

```prisma
model StockMovement {
  // ... existing fields
  reason      String?  // ✅ Tambahkan field reason
  referenceId String?  // ✅ Tambahkan field referenceId
}
```

---

## 🔄 Flow yang Seharusnya

1. User mengisi form adjustment (reason, notes, referenceId)
2. Form mengirim semua data ke endpoint `/api/stores/[id]/stock/adjust`
3. Backend membuat StockMovement dengan semua data
4. Backend update material.currentStock
5. Cache di-invalidate dengan key yang benar
6. UI refresh dan menampilkan data terbaru

---

## 📝 Checklist Perbaikan

- [ ] Buat endpoint `/api/stores/[id]/stock/adjust`
- [ ] Update StockMovement schema untuk reason dan referenceId
- [ ] Update material service untuk menerima adjustment data
- [ ] Update stock-adjustment-dialog untuk mengirim semua data
- [ ] Perbaiki cache invalidation key mismatch
- [ ] Update adjustment-history-dialog untuk menampilkan reason/notes
- [ ] Test end-to-end flow
- [ ] Update dokumentasi API

---

## 🎯 Prioritas

1. **HIGH:** Perbaiki cache invalidation (mempengaruhi UX)
2. **HIGH:** Kirim reason/notes ke API (audit trail)
3. **MEDIUM:** Buat endpoint khusus untuk adjustment
4. **LOW:** Tambahkan field reason/referenceId ke schema (jika belum ada)

