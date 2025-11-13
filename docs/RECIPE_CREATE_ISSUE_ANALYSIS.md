# Analisis Masalah: Recipe Tidak Muncul Setelah Dibuat

## 🔍 Masalah yang Ditemukan

User melaporkan:
1. ✅ Toast notification mengatakan "Resep telah berhasil dibuat"
2. ❌ Tapi tidak ada recipe yang tertambah di list
3. ❌ Saat membuat produk, tidak ada resep yang terdeteksi di dropdown
4. ❌ Hot reload pun tidak menampilkan recipe baru

## 🔎 Root Cause Analysis

### Masalah Utama: Cache Invalidation Tidak Trigger Refetch

**Lokasi Masalah:** `src/lib/react-query/cache-utils.ts` - `invalidateRecipeRelatedQueries()`

**Penjelasan:**
1. Setelah recipe dibuat, `useCreateRecipe` memanggil `invalidateRecipeRelatedQueries()`
2. Fungsi ini hanya menggunakan `invalidateQueries()` yang **hanya menandai query sebagai stale**
3. **Tidak memaksa refetch** jika `staleTime` masih valid (1 menit)
4. Query di `add-product-dialog.tsx` yang menggunakan `useRecipes()` tidak otomatis refetch
5. Akibatnya, UI tidak update meskipun data sudah ada di database

### Flow yang Terjadi:

```
1. User mengisi form recipe → Submit
2. createRecipe.mutateAsync(payload) → API POST /api/stores/[id]/recipes
3. API berhasil → Return 201 dengan recipe data
4. onSuccess di useCreateRecipe → invalidateRecipeRelatedQueries()
5. invalidateQueries() → Mark queries as stale
6. ❌ Query tidak refetch karena staleTime (60 detik) masih valid
7. UI tidak update → Recipe tidak muncul di list
```

### Query Key Structure:

```typescript
// Query key di add-product-dialog.tsx
recipeKeys.list(storeId, {
  sortBy: "name",
  sortOrder: "asc",
  skip: 0,
  take: 100
})
// = ["recipes", storeId, "list", { sortBy: "name", ... }]

// Invalidation menggunakan
recipeKeys.lists(storeId)
// = ["recipes", storeId, "list"]

// Dengan exact: false, seharusnya match, tapi tidak trigger refetch
```

## ✅ Solusi yang Diterapkan

### Perubahan di `cache-utils.ts`

**Sebelum:**
```typescript
export async function invalidateRecipeRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  recipeId?: string
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: recipeKeys.lists(storeId),
      exact: false,
    }),
  ];
  // ...
  await Promise.all(invalidations);
}
```

**Sesudah:**
```typescript
export async function invalidateRecipeRelatedQueries(
  queryClient: QueryClient,
  storeId: string,
  recipeId?: string
): Promise<void> {
  // Invalidate all recipe list queries (marks them as stale)
  await queryClient.invalidateQueries({
    queryKey: recipeKeys.lists(storeId),
    exact: false,
  });

  // Force refetch all recipe list queries to ensure UI updates immediately
  // This is important because invalidateQueries only marks queries as stale,
  // but won't refetch if staleTime hasn't expired yet
  await queryClient.refetchQueries({
    queryKey: recipeKeys.lists(storeId),
    exact: false,
  });

  // If recipeId is provided, also invalidate and refetch the specific recipe
  if (recipeId) {
    await queryClient.invalidateQueries({
      queryKey: recipeKeys.detail(storeId, recipeId),
      exact: false,
    });
    await queryClient.refetchQueries({
      queryKey: recipeKeys.detail(storeId, recipeId),
      exact: false,
    });
  }
}
```

### Perubahan Utama:

1. **Menambahkan `refetchQueries()`** setelah `invalidateQueries()`
   - Memaksa semua recipe list queries untuk refetch segera
   - Tidak menunggu `staleTime` habis

2. **Menggunakan `await` secara sequential** (bukan parallel)
   - Memastikan invalidation selesai sebelum refetch
   - Lebih predictable untuk debugging

3. **Menambahkan komentar** yang menjelaskan mengapa perlu refetch

## 🧪 Testing Checklist

Setelah perbaikan, pastikan:

- [ ] ✅ Membuat recipe baru → Recipe langsung muncul di recipes list
- [ ] ✅ Membuat recipe baru → Recipe langsung muncul di dropdown produk
- [ ] ✅ Membuat recipe baru → Tidak perlu hot reload
- [ ] ✅ Update recipe → Perubahan langsung terlihat
- [ ] ✅ Delete recipe → Recipe langsung hilang dari list
- [ ] ✅ Duplicate recipe → Recipe baru langsung muncul

## 📝 Catatan Teknis

### Mengapa `invalidateQueries()` Tidak Cukup?

TanStack Query memiliki konsep `staleTime`:
- Query dianggap "fresh" selama `staleTime` belum habis
- `invalidateQueries()` hanya menandai query sebagai stale
- Query tidak akan refetch otomatis jika masih dalam `staleTime`
- Perlu `refetchQueries()` untuk memaksa refetch

### Kapan Menggunakan `refetchQueries()` vs `invalidateQueries()`?

**Gunakan `invalidateQueries()` saja jika:**
- Data tidak perlu update segera
- User akan melihat update saat query refetch secara natural (misalnya saat mount)

**Gunakan `refetchQueries()` setelah `invalidateQueries()` jika:**
- Data perlu update segera setelah mutation (seperti kasus ini)
- User experience lebih penting daripada sedikit overhead refetch

### Performance Consideration

- `refetchQueries()` akan trigger network request
- Untuk recipe list, ini biasanya cepat (< 100ms)
- Trade-off: Slight network overhead vs immediate UI update
- **Keputusan:** Immediate update lebih penting untuk UX

## 🔄 Impact Analysis

### Files Affected:
- ✅ `src/lib/react-query/cache-utils.ts` - Fixed
- ✅ Semua mutation yang menggunakan `invalidateRecipeRelatedQueries()` akan otomatis terperbaiki:
  - `useCreateRecipe()`
  - `useUpdateRecipe()`
  - `useDeleteRecipe()`
  - `useBulkDeleteRecipes()`
  - `useDuplicateRecipe()`

### Breaking Changes:
- ❌ Tidak ada breaking changes
- ✅ Backward compatible
- ✅ Hanya menambahkan refetch, tidak mengubah behavior existing

## 🎯 Rekomendasi untuk Future

1. **Pertimbangkan menggunakan pattern yang sama untuk resource lain:**
   - `invalidateMaterialRelatedQueries()`
   - `invalidateProductRelatedQueries()`
   - `invalidateProductionRelatedQueries()`

2. **Atau buat generic helper:**
   ```typescript
   export async function invalidateAndRefetch(
     queryClient: QueryClient,
     queryKey: readonly unknown[],
     exact: boolean = false
   ): Promise<void> {
     await queryClient.invalidateQueries({ queryKey, exact });
     await queryClient.refetchQueries({ queryKey, exact });
   }
   ```

3. **Monitor performance:**
   - Jika refetch terlalu sering, pertimbangkan debounce
   - Atau gunakan optimistic updates untuk instant feedback

## 📚 Referensi

- [TanStack Query - Invalidation](https://tanstack.com/query/latest/docs/react/guides/invalidations-from-mutations)
- [TanStack Query - Refetching](https://tanstack.com/query/latest/docs/react/guides/refetching)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)

