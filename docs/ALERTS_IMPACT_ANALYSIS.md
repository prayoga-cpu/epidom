# Dampak Edit Stock ke Tab Alerts - Analisis Lengkap

## 🔍 Ringkasan

Setelah menyelidiki bagaimana tab Alerts bekerja dan hubungannya dengan stock adjustment, ditemukan **ADA DAMPAK**, tapi **TIDAK KRITIS** karena ada mekanisme auto-refetch.

---

## ✅ Bagaimana Alerts Bekerja

### 1. **Alerts Data Source**

**File:** `src/app/api/stores/[id]/alerts/route.ts`

Alerts dihitung dari materials dengan kondisi:
```typescript
// Line 54-59
const lowStockMaterials = allMaterials
  .filter((material) => {
    const currentStock = Number(material.currentStock);
    const minStock = Number(material.minStock);
    return currentStock <= minStock;  // ✅ Kondisi untuk alert
  })
```

**Kesimpulan:** Alerts bergantung pada `material.currentStock` dan `material.minStock`.

---

### 2. **Alerts Query Key**

**File:** `src/features/dashboard/tracking/hooks/use-alerts.ts`

```typescript
// Line 30-33
export const alertKeys = {
  all: ["alerts"] as const,
  lists: (storeId: string) => [...alertKeys.all, "list", storeId] as const,
  // Result: ["alerts", "list", storeId]
};

// Line 40
queryKey: alertKeys.lists(storeId),  // ["alerts", "list", storeId]
```

**Query Key:** `["alerts", "list", storeId]`

---

### 3. **Cache Invalidation untuk Alerts**

**File:** `src/lib/utils/cache-helpers.ts`

```typescript
// Line 52-55
queryClient.invalidateQueries({
  queryKey: ["alerts", storeId],  // ❌ Key berbeda!
  exact: false,
});
```

**Invalidation Key:** `["alerts", storeId]`
**Query Key:** `["alerts", "list", storeId]`

---

## ⚠️ Masalah yang Ditemukan

### 1. **Cache Invalidation Key Mismatch (SEDIKIT)**

**Masalah:**
- Invalidation menggunakan: `["alerts", storeId]`
- Query key menggunakan: `["alerts", "list", storeId]`
- Dengan `exact: false`, prefix matching **SEHARUSNYA** bekerja
- TAPI, struktur key berbeda bisa menyebabkan masalah

**Analisis:**
```typescript
// Invalidation
["alerts", storeId]  // e.g., ["alerts", "store-123"]

// Query Key
["alerts", "list", storeId]  // e.g., ["alerts", "list", "store-123"]

// Prefix matching dengan exact: false
// ✅ Seharusnya match karena ["alerts"] adalah prefix dari ["alerts", "list", storeId]
```

**Kesimpulan:** Secara teori **SEHARUSNYA BEKERJA**, tapi tidak optimal.

---

### 2. **Auto-Refetch Menutupi Masalah**

**File:** `src/features/dashboard/tracking/hooks/use-alerts.ts`

```typescript
// Line 48-51
staleTime: 30000,        // Data fresh untuk 30 detik
refetchInterval: 60000,  // Auto-refetch setiap 60 detik
```

**Dampak:**
- Alerts **auto-refetch setiap 60 detik**
- Jadi meskipun cache invalidation tidak bekerja sempurna, data akan refresh otomatis
- User mungkin melihat data lama maksimal 60 detik

---

## 📊 Dampak ke Alerts

### ✅ **Dampak Positif (Yang Bekerja)**

1. **Material Update Memicu Cache Invalidation**
   - `useUpdateMaterial` memanggil `invalidateMaterialRelatedQueries`
   - Alerts di-invalidate (meskipun key tidak sempurna)
   - Auto-refetch akan mengambil data baru

2. **Stock Adjustment Update Material**
   - Stock adjustment menggunakan `useUpdateMaterial`
   - Material `currentStock` di-update
   - Alerts API akan menghitung ulang berdasarkan `currentStock` baru

3. **Auto-Refetch sebagai Safety Net**
   - Alerts auto-refetch setiap 60 detik
   - Memastikan data selalu up-to-date

---

### ⚠️ **Dampak Negatif (Masalah)**

1. **Cache Invalidation Tidak Optimal**
   - Key mismatch bisa menyebabkan invalidation tidak langsung bekerja
   - User mungkin melihat data lama sampai auto-refetch (maksimal 60 detik)

2. **Delay Update Alerts**
   - Setelah stock adjustment, alerts mungkin tidak langsung update
   - Perlu menunggu auto-refetch atau manual refresh

3. **Inconsistent dengan Hook Lain**
   - Hook lain menggunakan `alertKeys.lists(storeId)` untuk invalidation
   - `cache-helpers.ts` menggunakan key yang berbeda

---

## 🔍 Perbandingan dengan Hook Lain

### ✅ **Hook yang Benar**

**File:** `src/features/dashboard/data/products/hooks/use-products.ts`
```typescript
// Line 193, 212, 230, 246
queryClient.invalidateQueries({
  queryKey: alertKeys.lists(storeId)  // ✅ Menggunakan alertKeys
});
```

**File:** `src/features/dashboard/management/recipe-production/hooks/use-production-batches.ts`
```typescript
// Line 238, 273, 293
queryClient.invalidateQueries({
  queryKey: alertKeys.lists(storeId)  // ✅ Menggunakan alertKeys
});
```

**File:** `src/features/dashboard/tracking/hooks/use-supplier-orders.ts`
```typescript
// Line 196
queryClient.invalidateQueries({
  queryKey: alertKeys.lists(storeId)  // ✅ Menggunakan alertKeys
});
```

### ❌ **Hook yang Salah**

**File:** `src/lib/utils/cache-helpers.ts`
```typescript
// Line 53
queryClient.invalidateQueries({
  queryKey: ["alerts", storeId],  // ❌ Tidak menggunakan alertKeys
  exact: false,
});
```

---

## 📈 Skenario Dampak

### Skenario 1: Stock Adjustment Meningkatkan Stock di Atas MinStock

**Flow:**
1. Material A: `currentStock = 5`, `minStock = 10` → **ADA ALERT**
2. User adjust stock: `+10` → `currentStock = 15`
3. Material A: `currentStock = 15`, `minStock = 10` → **TIDAK ADA ALERT**

**Dampak:**
- ✅ Material di-update
- ⚠️ Alerts cache mungkin tidak langsung invalidate
- ✅ Auto-refetch akan menghapus alert dalam 60 detik maksimal
- ⚠️ User mungkin masih melihat alert untuk beberapa detik

---

### Skenario 2: Stock Adjustment Menurunkan Stock di Bawah MinStock

**Flow:**
1. Material B: `currentStock = 15`, `minStock = 10` → **TIDAK ADA ALERT**
2. User adjust stock: `-10` → `currentStock = 5`
3. Material B: `currentStock = 5`, `minStock = 10` → **ADA ALERT**

**Dampak:**
- ✅ Material di-update
- ⚠️ Alerts cache mungkin tidak langsung invalidate
- ✅ Auto-refetch akan menampilkan alert baru dalam 60 detik maksimal
- ⚠️ User mungkin tidak langsung melihat alert baru

---

## ✅ Kesimpulan

### **ADA DAMPAK, TAPI TIDAK KRITIS**

**Alasan:**
1. ✅ Alerts bergantung pada `material.currentStock` yang **DI-UPDATE** oleh stock adjustment
2. ⚠️ Cache invalidation **TIDAK OPTIMAL** (key mismatch)
3. ✅ Auto-refetch **MENUTUPI MASALAH** (refresh setiap 60 detik)
4. ⚠️ User mungkin melihat data **LAMA MAKSIMAL 60 DETIK**

**Severity:** **MEDIUM** (bukan HIGH karena ada auto-refetch)

---

## 🔧 Rekomendasi Perbaikan

### 1. **Perbaiki Cache Invalidation Key**

**File:** `src/lib/utils/cache-helpers.ts`

```typescript
// ❌ Sebelum
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";

queryClient.invalidateQueries({
  queryKey: ["alerts", storeId],  // ❌ Key tidak konsisten
  exact: false,
});

// ✅ Sesudah
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";

queryClient.invalidateQueries({
  queryKey: alertKeys.lists(storeId),  // ✅ Menggunakan alertKeys
  exact: false,
});
```

**Dampak:** Alerts akan langsung refresh setelah stock adjustment.

---

### 2. **Optimasi Auto-Refetch (Opsional)**

Jika cache invalidation sudah diperbaiki, bisa mengurangi interval:

```typescript
// Opsional: Kurangi interval jika invalidation sudah optimal
refetchInterval: 120000,  // 2 menit (dari 60 detik)
```

---

## 📝 Checklist Perbaikan

- [ ] Perbaiki cache invalidation key di `cache-helpers.ts`
- [ ] Test stock adjustment → alerts update langsung
- [ ] Verifikasi alerts count di sidebar update
- [ ] Verifikasi alerts table update
- [ ] (Opsional) Optimasi auto-refetch interval

---

## 🎯 Prioritas

**MEDIUM** - Masalah tidak kritis karena ada auto-refetch, tapi sebaiknya diperbaiki untuk UX yang lebih baik (update langsung tanpa delay).

