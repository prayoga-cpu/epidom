# Cache Invalidation Fix - Alerts & Stock Movements

## ✅ Perbaikan yang Dilakukan

### Masalah
1. **Alerts cache invalidation key mismatch**
   - Menggunakan: `["alerts", storeId]`
   - Query key sebenarnya: `["alerts", "list", storeId]`
   - Alerts tidak langsung update setelah stock adjustment

2. **Stock movements cache invalidation key mismatch**
   - Menggunakan: `["stockMovements", storeId]` (camelCase)
   - Query key sebenarnya: `["stock-movements", storeId]` (kebab-case)
   - History dialog tidak langsung refresh

---

## 🔧 Perbaikan

**File:** `src/lib/utils/cache-helpers.ts`

### Sebelum:
```typescript
queryClient.invalidateQueries({
  queryKey: ["alerts", storeId],  // ❌ Key tidak cocok
  exact: false,
});
queryClient.invalidateQueries({
  queryKey: ["stockMovements", storeId],  // ❌ Key tidak cocok
  exact: false,
});
```

### Sesudah:
```typescript
import { alertKeys } from "@/features/dashboard/tracking/hooks/use-alerts";
import { stockMovementKeys } from "@/features/dashboard/management/edit-stock/hooks/use-stock-movements";

// ✅ Menggunakan alertKeys yang benar
queryClient.invalidateQueries({
  queryKey: alertKeys.lists(storeId),  // ["alerts", "list", storeId]
  exact: false,
});

// ✅ Menggunakan stockMovementKeys yang benar
queryClient.invalidateQueries({
  queryKey: stockMovementKeys.all(storeId),  // ["stock-movements", storeId]
  exact: false,
});
```

---

## 📊 Dampak Perbaikan

### ✅ Alerts
- **Sebelum:** Alerts update maksimal 60 detik (menunggu auto-refetch)
- **Sesudah:** Alerts **LANGSUNG UPDATE** setelah stock adjustment
- **Dampak:** User langsung melihat perubahan (alert muncul/hilang)

### ✅ Stock Movements History
- **Sebelum:** History dialog tidak refresh setelah adjustment
- **Sesudah:** History dialog **LANGSUNG REFRESH** setelah adjustment
- **Dampak:** User langsung melihat adjustment baru di history

---

## 🎯 Flow Setelah Perbaikan

1. User adjust stock di Management tab
2. Material `currentStock` di-update
3. Cache invalidation dipanggil:
   - ✅ Materials cache → refresh
   - ✅ Alerts cache → **LANGSUNG REFRESH** (tidak perlu menunggu)
   - ✅ Stock movements cache → **LANGSUNG REFRESH**
   - ✅ Suppliers cache → refresh
   - ✅ Recipes cache → refresh
4. UI langsung update:
   - ✅ Alerts tab langsung menampilkan/hilangkan alert
   - ✅ Alerts count di sidebar langsung update
   - ✅ History dialog langsung menampilkan adjustment baru

---

## ✅ Testing Checklist

- [ ] Adjust stock yang membuat material keluar dari alert → Alert langsung hilang
- [ ] Adjust stock yang membuat material masuk ke alert → Alert langsung muncul
- [ ] Alerts count di sidebar langsung update
- [ ] History dialog langsung menampilkan adjustment baru
- [ ] Dashboard alerts card langsung update

---

## 📝 Catatan

- Auto-refetch di `useAlerts` masih aktif (60 detik) sebagai safety net
- Tapi sekarang tidak perlu menunggu, karena cache langsung di-invalidate
- Perbaikan ini konsisten dengan hook lain yang sudah menggunakan `alertKeys` dan `stockMovementKeys`

