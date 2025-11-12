# Fix Race Condition: Store Creation Limit Bug

## Problem

User melaporkan bug dimana:
1. User dengan plan **STARTER** (limit 1 store) masih dapat membuat 2 store
2. Saat membuat 1 store, karena kendala jaringan atau retry, tiba-tiba terbuat 2 store
3. User bahkan masih bisa menambah store lagi (melebihi limit)

## Root Cause

**Race Condition**: Validasi limit store dan create store dilakukan dalam **dua operasi terpisah tanpa transaction lock**, sehingga:

```
Timeline Race Condition:
─────────────────────────────────────────────────────────────────
Request 1: Check limit → 0 stores → allowed ✅
Request 2: Check limit → 0 stores → allowed ✅ (masih 0 karena Request 1 belum commit)
Request 1: Create store → commit → 1 store
Request 2: Create store → commit → 2 stores ❌ (BUG!)
```

### Masalah:
1. **Tidak ada transaction lock**: Validasi limit dan create store dilakukan secara terpisah
2. **Concurrent requests**: Dua request bersamaan bisa melewati validasi sebelum store pertama dibuat
3. **Tidak ada idempotency**: Tidak ada cara untuk mencegah duplicate requests dari frontend
4. **Frontend tidak ada debounce**: User bisa klik multiple kali karena jaringan lambat

## Solution

### 1. Transaction dengan Row-Level Lock

**File**: `src/lib/services/business.service.ts`

```typescript
async createStore(businessId: string, userId: string, input: CreateStoreInput): Promise<StoreDto> {
  // Use transaction with row-level lock to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // 1. Lock business row (SELECT FOR UPDATE)
    // This ensures only one transaction can proceed at a time for this business
    const business = await tx.$queryRaw<Array<{ id: string; userId: string }>>`
      SELECT id, "userId"
      FROM "Business"
      WHERE id = ${businessId}
      FOR UPDATE
    `;

    // 2. Check subscription and store limit WITHIN transaction
    const subscription = await tx.subscription.findUnique({
      where: { userId },
    });

    const currentStoreCount = await tx.store.count({
      where: { businessId, isActive: true },
    });

    const limit = getStoreLimit(subscription.plan);
    const allowed = canCreateStore(subscription.plan, currentStoreCount);

    if (!allowed) {
      throw new Error(`You have reached your plan's store limit...`);
    }

    // 3. Check duplicate name (within transaction)
    // 4. Create store (within transaction)
    // ...
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
```

**Key Points:**
- ✅ **SELECT FOR UPDATE**: Lock business row untuk mencegah concurrent access
- ✅ **Transaction**: Semua operasi (check limit, create store) dalam satu transaction
- ✅ **SERIALIZABLE isolation**: Maximum safety, prevents phantom reads
- ✅ **Atomic**: Jika limit exceeded, transaction rollback, tidak ada store yang dibuat

### 2. Frontend Debounce

**File**: `src/features/stores/stores/components/create-store-dialog.tsx`

```typescript
const isSubmittingRef = useRef(false);

const handleSubmit = (data: CreateStoreInput) => {
  // Prevent multiple submissions
  if (isSubmittingRef.current || isPending) {
    return;
  }

  isSubmittingRef.current = true;

  createStore(data, {
    onSuccess: () => {
      isSubmittingRef.current = false;
      // ...
    },
    onError: (error) => {
      isSubmittingRef.current = false;
      // ...
    },
  });
};
```

**Key Points:**
- ✅ **useRef**: Track submitting state tanpa re-render
- ✅ **Early return**: Prevent multiple clicks
- ✅ **Reset on close**: Reset flag when dialog closes

### 3. Improved Error Handling

**File**: `src/app/api/stores/route.ts`

```typescript
try {
  const store = await businessService.createStore(business.id, session.user.id, input);
  return NextResponse.json(createSuccessResponse(store), { status: 201 });
} catch (storeError) {
  // Handle store limit exceeded error
  if (storeError instanceof Error && storeError.message.includes("store limit")) {
    const storeCheck = await subscriptionService.canCreateStore(session.user.id);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        storeError.message,
        { current: storeCheck.current, limit: storeCheck.limit, upgradeRequired: true }
      ),
      { status: 403 }
    );
  }
  // Handle other errors...
}
```

**Key Points:**
- ✅ **Proper error handling**: Handle limit exceeded error dengan detail
- ✅ **User-friendly messages**: Clear error messages dengan upgrade CTA

## How It Works

### Before Fix (Race Condition):

```
Request 1: Check limit → 0 stores → allowed ✅
           Create store → commit → 1 store

Request 2: Check limit → 0 stores → allowed ✅ (BUG: masih 0)
           Create store → commit → 2 stores ❌
```

### After Fix (Transaction Lock):

```
Request 1: Lock business row → Check limit → 0 stores → allowed ✅
           Create store → commit → 1 store → Release lock

Request 2: Wait for lock... (Request 1 sedang process)
           Get lock → Check limit → 1 store → NOT allowed ❌
           Throw error → Release lock
```

**Result**: ✅ Hanya 1 store yang dibuat, Request 2 mendapat error limit exceeded

## Benefits

1. **✅ Prevents Race Condition**: Row-level lock memastikan hanya satu transaction yang bisa proceed
2. **✅ Atomic Operation**: Check limit dan create store dalam satu transaction
3. **✅ Frontend Protection**: Debounce mencegah multiple clicks
4. **✅ Better UX**: Clear error messages dengan upgrade CTA
5. **✅ Production Ready**: SERIALIZABLE isolation level untuk maximum safety

## Testing

### Test Case 1: Concurrent Requests

```bash
# Simulate 2 concurrent requests
curl -X POST /api/stores -d '{"name":"Store 1"}' &
curl -X POST /api/stores -d '{"name":"Store 2"}' &
wait
```

**Expected**: Hanya 1 store yang dibuat (STARTER plan), request kedua mendapat error 403

### Test Case 2: Multiple Clicks

1. User dengan STARTER plan (0 stores)
2. User klik "Create Store" multiple kali dengan cepat
3. Network slow, request masih pending

**Expected**: Hanya 1 request yang dikirim, button disabled selama pending

### Test Case 3: Network Retry

1. User dengan STARTER plan (0 stores)
2. User klik "Create Store"
3. Network timeout, request retry
4. Store sudah dibuat dari request pertama

**Expected**: Request kedua mendapat error 403 (limit exceeded) atau error duplicate name

## Files Changed

1. **`src/lib/services/business.service.ts`**:
   - Added transaction with row-level lock
   - Moved limit check inside transaction
   - Added SERIALIZABLE isolation level

2. **`src/app/api/stores/route.ts`**:
   - Removed duplicate limit check (now in service)
   - Improved error handling for limit exceeded
   - Better error messages

3. **`src/features/stores/stores/components/create-store-dialog.tsx`**:
   - Added debounce with useRef
   - Prevent multiple submissions
   - Reset flag on dialog close

## Performance Considerations

### Transaction Lock Impact:

- **Lock Duration**: Lock dipegang selama transaction (biasanya < 100ms)
- **Concurrent Requests**: Request kedua akan wait untuk lock, tidak akan timeout
- **Deadlock Risk**: Minimal, karena lock hanya pada business row (tidak ada circular dependency)

### Isolation Level:

- **SERIALIZABLE**: Strictest isolation, prevents phantom reads
- **Performance**: Slightly slower than READ COMMITTED, but necessary for correctness
- **Trade-off**: Safety over performance (correct for financial/billing limits)

## Conclusion

✅ **Race condition fixed**: Transaction dengan row-level lock mencegah concurrent requests
✅ **Frontend protection**: Debounce mencegah multiple clicks
✅ **Better error handling**: Clear error messages dengan upgrade CTA
✅ **Production ready**: SERIALIZABLE isolation level untuk maximum safety

**Status**: ✅ **FIXED** - Bug sudah diperbaiki, user dengan STARTER plan tidak bisa lagi membuat lebih dari 1 store, bahkan dengan concurrent requests atau network issues.

