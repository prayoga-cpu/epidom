# Penjelasan Sistem Real-time Sync

## 📋 Overview

Sistem real-time sync memastikan **semua tab dashboard selalu up-to-date** tanpa perlu refresh manual. Ketika ada perubahan di satu tab, **otomatis terlihat di semua tab lain** dalam waktu 0-30 detik.

---

## 🔄 **Cara Kerja Sistem**

### **1. Shared Cache (TanStack Query)**

Semua tab menggunakan **satu cache yang sama**:

```
┌─────────────────────────────────────┐
│     TanStack Query Cache            │
│  (Shared untuk semua tabs)          │
│                                     │
│  - materials: {...}                 │
│  - recipes: {...}                   │
│  - products: {...}                   │
│  - alerts: {...}                     │
└─────────────────────────────────────┘
         │         │         │
         ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │ Tab 1  │ │ Tab 2  │ │ Tab 3  │
    └────────┘ └────────┘ └────────┘
```

**Keuntungan:**
- ✅ Satu request untuk semua tabs
- ✅ Data konsisten di semua tabs
- ✅ Automatic sync

---

### **2. Smart Polling Strategy**

Sistem polling otomatis berdasarkan **criticality data**:

| Data Type | Polling Interval | Kapan Poll |
|-----------|-----------------|------------|
| **Critical** (Alerts) | 15 detik | Tab aktif + Background |
| **Active** (Materials, Recipes, Products) | 30 detik | Tab aktif saja |
| **Normal** (Supplier Orders) | 60 detik | Tab aktif saja |
| **Static** (Suppliers) | No polling | On window focus |

**Smart Polling Logic:**
```typescript
// Hanya poll jika:
1. Tab aktif (document.visibilityState === 'visible')
2. Window focused
3. Network online
```

**Hasil:**
- ✅ Tidak boros bandwidth
- ✅ Tidak drain battery
- ✅ Real-time untuk data penting

---

### **3. Cache Invalidation Strategy**

Ketika ada perubahan, sistem **invalidate cache** dan **auto-refetch**:

```
User Action (Tab A)
    ↓
Mutation (create/update/delete)
    ↓
Cache Invalidation
    ├─→ Materials cache invalidated
    ├─→ Recipes cache invalidated
    ├─→ Alerts cache invalidated
    ├─→ Stock movements cache invalidated
    └─→ Suppliers cache invalidated
    ↓
Auto Refetch (semua tabs)
    ├─→ Tab A: Update instant (optimistic)
    ├─→ Tab B: Refetch dalam 0-30s
    ├─→ Tab C: Refetch dalam 0-30s
    └─→ Tab D: Refetch dalam 0-30s
```

---

## 🎯 **Contoh: User Mengubah Data**

### **Scenario 1: User Create Material di Tab "Data → Materials"**

#### **Step 1: User Action**
```
User klik "Add Material" → Isi form → Klik "Save"
```

#### **Step 2: Optimistic Update (Instant - 0ms)**
```typescript
// onMutate: Update UI immediately
1. Cancel outgoing refetches
2. Snapshot previous data
3. Add temporary material to cache
4. UI update INSTANT (user lihat material baru langsung)
```

**User Experience:**
- ✅ Material langsung muncul di list (tanpa menunggu server)
- ✅ UI responsive, tidak ada loading delay

#### **Step 3: Server Request**
```typescript
// mutationFn: Send request to server
POST /api/stores/{storeId}/materials
```

#### **Step 4: Server Response**
```typescript
// onSuccess: Replace with real data
1. Replace temporary material dengan real data dari server
2. Invalidate all related queries:
   - Materials cache
   - Recipes cache (untuk ingredients dropdown)
   - Alerts cache (jika stock low)
   - Stock movements cache
   - Suppliers cache
```

#### **Step 5: Auto Sync ke Semua Tabs**

**Tab "Data → Materials":**
- ✅ Material sudah muncul (dari optimistic update)
- ✅ Data di-replace dengan real data dari server

**Tab "Dashboard":**
- ✅ Stock levels update (via cache invalidation)
- ✅ Alerts update jika stock low (via cache invalidation)

**Tab "Tracking":**
- ✅ Stock levels update (via cache invalidation)

**Tab "Alerts":**
- ✅ Alerts update jika stock low (via cache invalidation)

**Tab "Management":**
- ✅ Material muncul di dropdown (via cache invalidation)

**Timeline:**
```
0ms:    User klik Save
0ms:    Optimistic update → UI update INSTANT
200ms:  Server response
200ms:  Replace dengan real data
200ms:  Cache invalidation
200ms:  Auto refetch semua tabs
0-30s:  Semua tabs update (tergantung polling interval)
```

---

### **Scenario 2: User Adjust Stock di Tab "Management → Edit Stock"**

#### **Step 1: User Action**
```
User adjust stock material "Flour" dari 100kg → 50kg
```

#### **Step 2: Mutation**
```typescript
// useStockAdjustment mutation
POST /api/stores/{storeId}/stock/adjust
Body: {
  materialId: "flour-123",
  adjustmentType: "OUT",
  quantity: 50,
  reason: "Production usage"
}
```

#### **Step 3: Cache Invalidation**
```typescript
// invalidateMaterialRelatedQueries()
await Promise.all([
  invalidateQueries(["materials", storeId]),      // Materials cache
  invalidateQueries(["recipes", storeId]),        // Recipes cache
  invalidateQueries(alertKeys.lists(storeId)),    // Alerts cache
  invalidateQueries(stockMovementKeys.all(...)),  // Stock movements
  invalidateQueries(["suppliers", storeId]),      // Suppliers cache
]);
```

#### **Step 4: Auto Refetch Semua Tabs**

**Tab "Management → Edit Stock":**
- ✅ Stock movement baru muncul (instant)
- ✅ Material stock update (instant)

**Tab "Data → Materials":**
- ✅ Material "Flour" stock update dari 100kg → 50kg
- ✅ Update dalam 0-30s (via polling atau cache invalidation)

**Tab "Dashboard":**
- ✅ Stock levels chart update
- ✅ Alerts card update (jika stock low)
- ✅ Tracking card update

**Tab "Tracking":**
- ✅ Stock levels update
- ✅ Stock movements update

**Tab "Alerts":**
- ✅ Alerts update jika stock low (dalam 15 detik)

**Timeline:**
```
0ms:    User adjust stock
200ms:  Server response
200ms:  Cache invalidation
200ms:  Auto refetch semua tabs
0-30s:  Semua tabs update
```

---

### **Scenario 3: User Start Production di Tab "Management → Recipe Production"**

#### **Step 1: User Action**
```
User start production batch untuk "Bread Recipe"
- Consume: 10kg Flour, 2kg Sugar, 1kg Yeast
- Produce: 50 loaves Bread
```

#### **Step 2: Mutation**
```typescript
// useStartProduction mutation
POST /api/stores/{storeId}/production-batches
Body: {
  recipeId: "bread-recipe-123",
  plannedQuantity: 50,
  scheduledDate: "2024-01-15"
}
```

#### **Step 3: Cache Invalidation**
```typescript
// Invalidate related queries
- Production batches cache
- Materials cache (stock consumed)
- Products cache (stock produced)
- Alerts cache (jika stock low setelah consume)
- Stock movements cache
```

#### **Step 4: Auto Sync ke Semua Tabs**

**Tab "Management → Recipe Production":**
- ✅ Production batch baru muncul (instant)
- ✅ Material stock decrease (instant)

**Tab "Data → Materials":**
- ✅ Flour: 50kg → 40kg (consumed 10kg)
- ✅ Sugar: 20kg → 18kg (consumed 2kg)
- ✅ Yeast: 5kg → 4kg (consumed 1kg)

**Tab "Data → Products":**
- ✅ Bread: 0 loaves → 50 loaves (produced)

**Tab "Dashboard":**
- ✅ Production history chart update
- ✅ Stock levels update
- ✅ Alerts update jika ada stock low

**Tab "Tracking":**
- ✅ Stock movements update
- ✅ Stock levels update

**Timeline:**
```
0ms:    User start production
200ms:  Server response
200ms:  Cache invalidation
200ms:  Auto refetch semua tabs
0-30s:  Semua tabs update
```

---

## 🔍 **Detail Mekanisme**

### **1. Optimistic Updates**

**Kapan digunakan:**
- Create operations (create material, create recipe, dll)
- Memberikan instant feedback ke user

**Cara kerja:**
```typescript
onMutate: async (newData) => {
  // 1. Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey });

  // 2. Snapshot previous data (untuk rollback)
  const previous = queryClient.getQueryData(queryKey);

  // 3. Optimistically update cache
  queryClient.setQueryData(queryKey, {
    ...previous,
    items: [...previous.items, newData]
  });

  // 4. Return context untuk rollback jika error
  return { previous };
}

onSuccess: (realData) => {
  // Replace optimistic data dengan real data dari server
  queryClient.setQueryData(queryKey, {
    ...previous,
    items: items.map(item =>
      item.id.startsWith('temp-') ? realData : item
    )
  });
}

onError: (error, newData, context) => {
  // Rollback jika error
  if (context?.previous) {
    queryClient.setQueryData(queryKey, context.previous);
  }
}
```

**Hasil:**
- ✅ UI update instant (0ms)
- ✅ User tidak perlu menunggu server
- ✅ Rollback otomatis jika error

---

### **2. Cache Invalidation**

**Kapan digunakan:**
- Setelah mutation (create/update/delete)
- Untuk sync data ke semua tabs

**Cara kerja:**
```typescript
// Batch invalidation (parallel untuk performance)
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ["materials", storeId] }),
  queryClient.invalidateQueries({ queryKey: ["recipes", storeId] }),
  queryClient.invalidateQueries({ queryKey: alertKeys.lists(storeId) }),
  // ... dll
]);
```

**Hasil:**
- ✅ Semua related queries invalidated
- ✅ Auto refetch untuk semua tabs
- ✅ Data konsisten di semua tabs

---

### **3. Smart Polling**

**Kapan digunakan:**
- Background sync untuk data yang sering berubah
- Memastikan data selalu fresh

**Cara kerja:**
```typescript
// Query configuration
useQuery({
  queryKey: ["materials", storeId],
  queryFn: fetchMaterials,
  staleTime: 20 * 1000,        // Data fresh selama 20 detik
  refetchInterval: 30 * 1000,   // Poll setiap 30 detik
  refetchIntervalInBackground: false, // Hanya poll jika tab aktif
  refetchOnWindowFocus: true,   // Refetch jika window focus
  meta: {
    refetchInterval: 30 * 1000, // Store untuk smart polling
  },
});
```

**Smart Polling Logic:**
```typescript
// Hanya poll jika:
function shouldPoll(): boolean {
  return (
    document.visibilityState === "visible" &&  // Tab aktif
    !document.hidden &&                        // Window visible
    navigator.onLine                           // Network online
  );
}
```

**Hasil:**
- ✅ Data selalu fresh
- ✅ Tidak boros bandwidth
- ✅ Tidak drain battery

---

## 📊 **Flow Diagram**

### **Complete Flow: User Create Material**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION (Tab: Data → Materials)                     │
│    User klik "Add Material" → Isi form → Klik "Save"      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. OPTIMISTIC UPDATE (0ms)                                  │
│    - Cancel outgoing refetches                               │
│    - Snapshot previous data                                  │
│    - Add temporary material to cache                        │
│    - UI update INSTANT                                       │
│    ✅ User lihat material baru langsung                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SERVER REQUEST (200ms)                                   │
│    POST /api/stores/{storeId}/materials                     │
│    Body: { name, sku, unitCost, ... }                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SERVER RESPONSE (200ms)                                  │
│    - Material created dengan real ID                        │
│    - Return MaterialWithSuppliers                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. REPLACE OPTIMISTIC DATA (200ms)                          │
│    - Replace temporary material dengan real data            │
│    - Update cache dengan real ID                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. CACHE INVALIDATION (200ms)                               │
│    - Materials cache invalidated                            │
│    - Recipes cache invalidated                              │
│    - Alerts cache invalidated                                │
│    - Stock movements cache invalidated                       │
│    - Suppliers cache invalidated                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. AUTO REFETCH ALL TABS (0-30s)                            │
│                                                              │
│    Tab "Data → Materials":                                  │
│    ✅ Material sudah muncul (dari optimistic)               │
│    ✅ Data di-replace dengan real data                      │
│                                                              │
│    Tab "Dashboard":                                         │
│    ✅ Stock levels update                                   │
│    ✅ Alerts update (jika stock low)                        │
│                                                              │
│    Tab "Tracking":                                          │
│    ✅ Stock levels update                                   │
│                                                              │
│    Tab "Alerts":                                            │
│    ✅ Alerts update (dalam 15 detik)                        │
│                                                              │
│    Tab "Management":                                        │
│    ✅ Material muncul di dropdown                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Key Points**

### **1. Instant Feedback (Optimistic Updates)**
- ✅ UI update **0ms** (tanpa menunggu server)
- ✅ User experience sangat baik
- ✅ Rollback otomatis jika error

### **2. Automatic Sync (Cache Invalidation)**
- ✅ Semua tabs **otomatis update** setelah mutation
- ✅ Tidak perlu refresh manual
- ✅ Data konsisten di semua tabs

### **3. Background Sync (Smart Polling)**
- ✅ Data selalu fresh (polling setiap 15-60 detik)
- ✅ Hanya poll jika tab aktif (hemat bandwidth)
- ✅ Critical data poll di background (alerts)

### **4. Performance Optimized**
- ✅ Batch invalidation (parallel, 5x faster)
- ✅ Request deduplication (satu request untuk semua tabs)
- ✅ Smart polling (tidak boros bandwidth)

---

## 🔧 **Jika Ingin Mengubah Sistem**

### **1. Ubah Polling Interval**

**File:** `src/features/dashboard/data/materials/hooks/use-materials.ts`

```typescript
// Ubah dari 30s ke 60s
refetchInterval: 60 * 1000, // Poll setiap 60 detik
meta: {
  refetchInterval: 60 * 1000,
},
```

**Impact:**
- ✅ Data update lebih lambat (60s instead of 30s)
- ✅ Lebih hemat bandwidth
- ✅ Kurang real-time

---

### **2. Tambah Cache Invalidation**

**File:** `src/lib/utils/cache-helpers.ts`

```typescript
export async function invalidateMaterialRelatedQueries(
  queryClient: QueryClient,
  storeId: string
): Promise<void> {
  await Promise.all([
    // ... existing invalidations
    queryClient.invalidateQueries({
      queryKey: ["new-feature", storeId], // Tambah ini
      exact: false,
    }),
  ]);
}
```

**Impact:**
- ✅ New feature cache juga ter-invalidate
- ✅ Data sync ke new feature tab

---

### **3. Disable Optimistic Updates**

**File:** `src/features/dashboard/data/materials/hooks/use-materials.ts`

```typescript
// Hapus onMutate untuk disable optimistic update
return useMutation({
  mutationFn: async (input) => { ... },
  // onMutate: async (newMaterial) => { ... }, // Hapus ini
  onSuccess: async (newMaterial) => { ... },
  onError: (error, newMaterial, context) => { ... },
});
```

**Impact:**
- ✅ UI tidak update instant
- ✅ User harus menunggu server response
- ✅ Kurang responsive

---

### **4. Ubah Smart Polling Logic**

**File:** `src/lib/config/realtime.config.ts`

```typescript
export function shouldPoll(): boolean {
  if (typeof window === "undefined") return false;

  // Tambah kondisi baru
  const isBusinessHours = new Date().getHours() >= 9 && new Date().getHours() < 17;

  return (
    document.visibilityState === "visible" &&
    !document.hidden &&
    navigator.onLine &&
    isBusinessHours // Hanya poll di jam kerja
  );
}
```

**Impact:**
- ✅ Polling hanya di jam kerja
- ✅ Lebih hemat bandwidth di luar jam kerja
- ✅ Data mungkin kurang fresh di luar jam kerja

---

## ✅ **Summary**

### **Cara Kerja:**
1. **Shared Cache** - Semua tabs pakai cache yang sama
2. **Smart Polling** - Poll otomatis berdasarkan criticality
3. **Cache Invalidation** - Invalidate setelah mutation
4. **Optimistic Updates** - UI update instant

### **Ketika Ada Perubahan:**
1. **Optimistic Update** (0ms) - UI update instant
2. **Server Request** (200ms) - Send ke server
3. **Cache Invalidation** (200ms) - Invalidate related queries
4. **Auto Refetch** (0-30s) - Semua tabs auto update

### **Hasil:**
- ✅ **Real-time** - Data selalu fresh
- ✅ **Performant** - Tidak boros bandwidth
- ✅ **User-friendly** - Instant feedback
- ✅ **Consistent** - Data sama di semua tabs

---

## 🎯 **Kesimpulan**

Sistem real-time sync bekerja dengan:
1. **Shared cache** untuk konsistensi
2. **Smart polling** untuk data freshness
3. **Cache invalidation** untuk auto sync
4. **Optimistic updates** untuk instant feedback

**Ketika user mengubah data:**
- ✅ UI update **instant** (optimistic)
- ✅ Semua tabs **otomatis sync** (cache invalidation)
- ✅ Data selalu **fresh** (smart polling)

**Sistem ini:**
- ✅ **Real-time** tanpa boros bandwidth
- ✅ **Performant** dengan smart polling
- ✅ **User-friendly** dengan instant feedback
- ✅ **Consistent** di semua tabs

