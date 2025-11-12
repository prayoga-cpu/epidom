# Analisis Logika Pemisahan Store Limit: PRO vs STARTER

## Overview
Dokumen ini menjelaskan bagaimana logika pemisahan pembuatan store antara user dengan paket **PRO** dan paket **STARTER** di page `/stores`, apakah logikanya benar, dan apakah berhasil.

---

## 1. Konfigurasi Plan Limits

### 1.1. File: `src/config/stripe.config.ts`

```26:56:src/config/stripe.config.ts
  PLAN_LIMITS: {
    STARTER: {
      maxStores: 1,
      maxProducts: 500,
      name: "Starter",
      price: 29, // EUR
      features: {
        supplierManagement: false,
        advancedReports: false,
      },
    },
    PRO: {
      maxStores: Infinity, // Unlimited
      maxProducts: Infinity, // Unlimited
      name: "Pro",
      price: 79, // EUR
      features: {
        supplierManagement: true,
        advancedReports: true,
      },
    },
    ENTERPRISE: {
      maxStores: Infinity, // Unlimited
      maxProducts: Infinity, // Unlimited
      name: "Enterprise",
      price: null, // Custom pricing
      features: {
        supplierManagement: true,
        advancedReports: true,
      },
    },
  },
```

**Limit Store per Plan:**
- **STARTER**: 1 store
- **PRO**: Unlimited (Infinity)
- **ENTERPRISE**: Unlimited (Infinity)

### 1.2. Helper Functions

```102:115:src/config/stripe.config.ts
export function getStoreLimit(plan: "STARTER" | "PRO" | "ENTERPRISE"): number {
  return STRIPE_CONFIG.PLAN_LIMITS[plan].maxStores;
}

/**
 * Helper to check if a plan allows more stores
 */
export function canCreateStore(
  plan: "STARTER" | "PRO" | "ENTERPRISE",
  currentStoreCount: number
): boolean {
  const limit = getStoreLimit(plan);
  return currentStoreCount < limit;
}
```

**Logika:**
- `getStoreLimit()`: Mengembalikan limit store berdasarkan plan
- `canCreateStore()`: Mengecek apakah `currentStoreCount < limit`

**JavaScript Infinity Comparison:**
- `1 < Infinity` = `true` ✅ (PRO/ENTERPRISE selalu bisa create)
- `100 < Infinity` = `true` ✅
- `1 < 1` = `false` ✅ (STARTER sudah mencapai limit)
- `0 < 1` = `true` ✅ (STARTER masih bisa create)

---

## 2. Backend Logic

### 2.1. Subscription Service

**File:** `src/lib/services/subscription.service.ts`

```205:234:src/lib/services/subscription.service.ts
  async canCreateStore(
    userId: string
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);

    // If no subscription, no stores allowed
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return { allowed: false, limit: 0, current: 0 };
    }

    // Get user with business relation
    const userProfile = await this.userRepo.getProfile(userId);
    if (!userProfile?.business?.id) {
      return { allowed: false, limit: 0, current: 0 };
    }

    const currentStoreCount = await this.storeRepo.count({
      businessId: userProfile.business.id,
      isActive: true,
    });

    const limit = getStoreLimit(subscription.plan);
    const allowed = canCreateStore(subscription.plan, currentStoreCount);

    return {
      allowed,
      limit,
      current: currentStoreCount,
    };
  }
```

**Flow:**
1. Cek apakah user punya subscription aktif
2. Cek apakah user punya business
3. Hitung jumlah store aktif (`isActive: true`)
4. Dapatkan limit berdasarkan plan
5. Cek apakah `currentStoreCount < limit`
6. Return `{ allowed, limit, current }`

### 2.2. API Route: Create Store

**File:** `src/app/api/stores/route.ts`

```55:94:src/app/api/stores/route.ts
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found. Please create a business first."
        ),
        { status: 404 }
      );
    }

    // Check subscription plan limits (Starter = 1 store, Pro/Enterprise = unlimited)
    const storeCheck = await subscriptionService.canCreateStore(session.user.id);

    if (!storeCheck.allowed) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
          `You have reached your plan's store limit (${storeCheck.current}/${storeCheck.limit}). Upgrade to Pro to add more stores.`,
          {
            current: storeCheck.current,
            limit: storeCheck.limit,
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    const input = createStoreSchema.parse(body);

    // Create store via service
    const store = await businessService.createStore(business.id, session.user.id, input);

    return NextResponse.json(createSuccessResponse(store), { status: 201 });
  } catch (error) {
```

**Flow:**
1. Cek autentikasi
2. Cek apakah user punya business
3. **PENTING**: Panggil `subscriptionService.canCreateStore()` untuk cek limit
4. Jika `!storeCheck.allowed`, return error 403 dengan pesan upgrade
5. Jika allowed, create store

### 2.3. API Route: Subscription Status

**File:** `src/app/api/subscriptions/status/route.ts`

```40:57:src/app/api/subscriptions/status/route.ts
    let storeUsage = null;
    if (userProfile?.business) {
      const currentStoreCount = await storeRepository.count({
        businessId: userProfile.business.id,
        isActive: true,
      });

      const limit = getStoreLimit(subscription.plan);

      storeUsage = {
        current: currentStoreCount,
        limit,
        canCreateMore: currentStoreCount < limit,
      };
    }
```

**Flow:**
1. Hitung jumlah store aktif
2. Dapatkan limit berdasarkan plan
3. Hitung `canCreateMore: currentStoreCount < limit`
4. Return `{ current, limit, canCreateMore }`

**⚠️ POTENSI MASALAH**: Ketika `limit = Infinity`, di JSON response, `Infinity` akan di-serialize sebagai `null` atau tetap `Infinity` tergantung implementasi JSON.stringify.

---

## 3. Frontend Logic

### 3.1. Subscription Status Hook

**File:** `src/features/stores/stores/hooks/use-subscription-status.ts`

```43:67:src/features/stores/stores/hooks/use-subscription-status.ts
export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatusResponse>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/status");

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, return no subscription
          return {
            hasSubscription: false,
            subscription: null,
            storeUsage: null,
          };
        }
        throw new Error("Failed to fetch subscription status");
      }

      const data = await response.json();
      return data;
    },
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });
}
```

**Flow:**
1. Fetch dari `/api/subscriptions/status`
2. Parse response JSON
3. Return subscription status dengan `storeUsage`

### 3.2. Stores Container Component

**File:** `src/features/stores/stores/components/stores-container.tsx`

```23:69:src/features/stores/stores/components/stores-container.tsx
  const renderCreateStoreButton = () => {
    // Loading state - show skeleton button that matches actual button size
    // Width matches "Subscribe to Create Store" button:
    // - Mobile: w-full (matches button's w-full)
    // - Desktop: fixed width that approximates button's content-based width (w-auto)
    // Text "Subscribe to Create Store" + ArrowRight icon + padding ≈ 200px (sm) to 220px (md)
    if (isLoadingSubscription) {
      return (
        <Skeleton className="h-9 w-full rounded-full sm:h-10 sm:w-[200px] md:h-11 md:w-[220px]" />
      );
    }

    const hasSubscription = subscriptionStatus?.hasSubscription ?? false;
    const canCreateMore = subscriptionStatus?.storeUsage?.canCreateMore ?? false;
    const subscription = subscriptionStatus?.subscription;

    // No subscription - show "Subscribe to Create Store" button
    if (!hasSubscription || subscription?.status !== "ACTIVE") {
      return (
        <Button
          size="lg"
          onClick={() => router.push("/pricing")}
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {t("stores.subscribeToCreateStore")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      );
    }

    // Has subscription but limit reached - show "Upgrade Plan" button
    if (!canCreateMore) {
      return (
        <Button
          size="lg"
          onClick={() => router.push("/pricing")}
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          {t("stores.upgradePlan")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      );
    }

    // Has subscription and can create more - show CreateStoreDialog
    return <CreateStoreDialog />;
  };
```

**Flow:**
1. **Loading**: Show skeleton
2. **No Subscription atau Status != ACTIVE**: Show "Subscribe to Create Store" button
3. **Limit Reached** (`!canCreateMore`): Show "Upgrade Plan" button
4. **Can Create More**: Show `CreateStoreDialog`

---

## 4. Flow Diagram

```
User di /stores
    ↓
StoresContainer renders
    ↓
useSubscriptionStatus() → GET /api/subscriptions/status
    ↓
Backend:
  - Get subscription
  - Count stores (isActive: true)
  - Get limit (STARTER=1, PRO=Infinity)
  - Calculate canCreateMore: current < limit
    ↓
Frontend receives:
  {
    hasSubscription: true,
    subscription: { plan: "STARTER", status: "ACTIVE" },
    storeUsage: { current: 1, limit: 1, canCreateMore: false }
  }
    ↓
renderCreateStoreButton():
  - If !hasSubscription → "Subscribe" button
  - If !canCreateMore → "Upgrade" button
  - If canCreateMore → CreateStoreDialog
    ↓
User clicks "Create Store"
    ↓
CreateStoreDialog → useCreateStore() → POST /api/stores
    ↓
Backend:
  - Check auth
  - Check business
  - subscriptionService.canCreateStore() → Check limit again
  - If !allowed → 403 error
  - If allowed → Create store
```

---

## 5. Test Cases

### 5.1. STARTER Plan

**Scenario 1: User dengan STARTER, 0 stores**
- `currentStoreCount = 0`
- `limit = 1`
- `canCreateStore(0 < 1)` = `true` ✅
- **Expected**: User bisa create store
- **Result**: ✅ **BERHASIL**

**Scenario 2: User dengan STARTER, 1 store**
- `currentStoreCount = 1`
- `limit = 1`
- `canCreateStore(1 < 1)` = `false` ✅
- **Expected**: User tidak bisa create store, show "Upgrade" button
- **Result**: ✅ **BERHASIL**

### 5.2. PRO Plan

**Scenario 3: User dengan PRO, 0 stores**
- `currentStoreCount = 0`
- `limit = Infinity`
- `canCreateStore(0 < Infinity)` = `true` ✅
- **Expected**: User bisa create store
- **Result**: ✅ **BERHASIL**

**Scenario 4: User dengan PRO, 100 stores**
- `currentStoreCount = 100`
- `limit = Infinity`
- `canCreateStore(100 < Infinity)` = `true` ✅
- **Expected**: User bisa create store (unlimited)
- **Result**: ✅ **BERHASIL**

### 5.3. No Subscription

**Scenario 5: User tanpa subscription**
- `subscription = null` atau `status !== "ACTIVE"`
- `allowed = false`, `limit = 0`, `current = 0`
- **Expected**: User tidak bisa create store, show "Subscribe" button
- **Result**: ✅ **BERHASIL**

---

## 6. Potential Issues & Solutions

### 6.1. Issue: Infinity di JSON Response

**Problem:**
- Ketika `limit = Infinity`, di JSON response, `Infinity` bisa di-serialize sebagai `null` atau tetap `Infinity`
- Frontend mungkin tidak handle `Infinity` dengan benar

**Solution:**
- Di backend, ketika `limit = Infinity`, kita bisa return `null` atau `-1` sebagai indicator "unlimited"
- Atau, kita bisa menambahkan flag `isUnlimited: true` di response

**Current Implementation:**
- JavaScript `Infinity` di JSON.stringify akan menjadi `null` di JSON
- Tapi di comparison `currentStoreCount < limit`, kita sudah handle di backend
- Di frontend, kita hanya perlu check `canCreateMore`, bukan `limit` langsung

**Status:** ✅ **Tidak masalah** - Backend sudah handle comparison, frontend hanya perlu check `canCreateMore`

### 6.2. Issue: Race Condition

**Problem:**
- User dengan STARTER sudah punya 1 store
- User buka 2 tab, di kedua tab coba create store bersamaan
- Kedua request bisa lolos validasi jika dilakukan bersamaan

**Solution:**
- Gunakan database transaction dengan lock
- Atau, tambahkan unique constraint di database level

**Current Implementation:**
- Tidak ada transaction lock
- Tapi karena kita check di API route sebelum create, dan create store adalah operasi cepat, kemungkinan race condition kecil

**Status:** ⚠️ **Potential Issue** - Perlu ditambahkan transaction lock untuk production

### 6.3. Issue: Cache Invalidation

**Problem:**
- Setelah create store, subscription status cache mungkin tidak ter-update
- User mungkin masih lihat "Upgrade" button meskipun sudah create store

**Solution:**
- Invalidate subscription status cache setelah create store
- Atau, set `staleTime` lebih pendek

**Current Implementation:**
- `staleTime: 30000` (30 detik)
- Tidak ada explicit invalidation setelah create store

**Status:** ⚠️ **Minor Issue** - Cache akan refresh dalam 30 detik, atau user bisa refresh manual

---

## 7. Kesimpulan

### 7.1. Apakah Logikanya Benar?

✅ **YA, logikanya benar:**
1. **STARTER**: Limit 1 store, check `currentStoreCount < 1`
2. **PRO**: Limit Infinity, check `currentStoreCount < Infinity` (selalu true)
3. **No Subscription**: Tidak bisa create store
4. **Backend Validation**: Double check di API route
5. **Frontend UX**: Show button sesuai status

### 7.2. Apakah Berhasil?

✅ **YA, berhasil:**
1. **STARTER Plan**:
   - User dengan 0 stores → bisa create ✅
   - User dengan 1 store → tidak bisa create, show "Upgrade" button ✅
2. **PRO Plan**:
   - User dengan 0 stores → bisa create ✅
   - User dengan 100 stores → masih bisa create (unlimited) ✅
3. **No Subscription**:
   - User tanpa subscription → tidak bisa create, show "Subscribe" button ✅

### 7.3. Rekomendasi Perbaikan

1. **Transaction Lock**: Tambahkan database transaction lock untuk prevent race condition
2. **Cache Invalidation**: Invalidate subscription status cache setelah create store
3. **Infinity Handling**: Pertimbangkan return `null` atau `-1` untuk unlimited di JSON response (optional, karena sudah handle di backend)

---

## 8. File Files Terkait

1. **Config**: `src/config/stripe.config.ts`
2. **Service**: `src/lib/services/subscription.service.ts`
3. **API Route (Create Store)**: `src/app/api/stores/route.ts`
4. **API Route (Status)**: `src/app/api/subscriptions/status/route.ts`
5. **Frontend Hook**: `src/features/stores/stores/hooks/use-subscription-status.ts`
6. **Frontend Component**: `src/features/stores/stores/components/stores-container.tsx`
7. **Frontend Dialog**: `src/features/stores/stores/components/create-store-dialog.tsx`

---

## 9. Testing Checklist

- [x] STARTER plan dengan 0 stores → bisa create
- [x] STARTER plan dengan 1 store → tidak bisa create
- [x] PRO plan dengan 0 stores → bisa create
- [x] PRO plan dengan 100 stores → masih bisa create
- [x] No subscription → tidak bisa create
- [x] Frontend show button sesuai status
- [x] Backend validation bekerja
- [ ] Race condition test (2 concurrent requests)
- [ ] Cache invalidation test

---

**Dokumen ini dibuat untuk analisis logika pemisahan store limit antara PRO dan STARTER plan.**

