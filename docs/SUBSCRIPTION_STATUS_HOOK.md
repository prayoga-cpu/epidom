# Hook untuk Cek Subscription Status User

## 📋 Overview

Hook `useSubscriptionStatus` digunakan untuk mengetahui:
- ✅ Apakah user sudah memiliki subscription plan
- 📦 Plan apa yang dipilih user (STARTER, PRO, ENTERPRISE)
- 🟢 Status subscription (ACTIVE, CANCELED, PAST_DUE, INCOMPLETE)
- 📊 Store usage (berapa store yang sudah dibuat vs limit)
- 💳 Billing period (tanggal mulai dan berakhir)
- ❌ Apakah subscription akan di-cancel

## 🔧 Lokasi File

```
src/features/stores/stores/hooks/use-subscription-status.ts
```

## 📦 Data Structure

### Response Type

```typescript
interface SubscriptionStatusResponse {
  hasSubscription: boolean;  // Apakah user punya subscription?
  subscription: {
    id: string;                                    // ID subscription
    plan: "STARTER" | "PRO" | "ENTERPRISE";       // Plan yang dipilih
    status: "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";  // Status
    currentPeriodStart: string;                    // Tanggal mulai billing period (ISO string)
    currentPeriodEnd: string;                      // Tanggal akhir billing period (ISO string)
    cancelAtPeriodEnd: boolean;                    // Apakah akan di-cancel?
  } | null;
  storeUsage: {
    current: number;        // Jumlah store yang sudah dibuat
    limit: number;          // Limit store berdasarkan plan (Infinity untuk PRO/ENTERPRISE)
    canCreateMore: boolean; // Apakah bisa buat store lagi?
  } | null;
}
```

## 🚀 Cara Penggunaan

### 1. Import Hook

```typescript
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
```

### 2. Gunakan di Component

```typescript
"use client";

export function MyComponent() {
  const { data, isLoading, error } = useSubscriptionStatus();

  // Loading state
  if (isLoading) {
    return <div>Loading subscription status...</div>;
  }

  // Error state
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // Check subscription
  const hasSubscription = data?.hasSubscription ?? false;
  const subscription = data?.subscription;
  const storeUsage = data?.storeUsage;

  // Cek apakah user punya subscription
  if (!hasSubscription) {
    return <div>No subscription found</div>;
  }

  // Ambil info plan
  const plan = subscription?.plan; // "STARTER" | "PRO" | "ENTERPRISE"
  const status = subscription?.status; // "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE"

  return (
    <div>
      <p>Plan: {plan}</p>
      <p>Status: {status}</p>
      <p>Stores: {storeUsage?.current} / {storeUsage?.limit === Infinity ? "Unlimited" : storeUsage?.limit}</p>
      <p>Can create more: {storeUsage?.canCreateMore ? "Yes" : "No"}</p>
    </div>
  );
}
```

## 📝 Contoh Penggunaan di StoresContainer

```typescript
export function StoresContainer() {
  const { data: subscriptionStatus, isLoading: isLoadingSubscription } = useSubscriptionStatus();

  const renderCreateStoreButton = () => {
    // Loading state
    if (isLoadingSubscription) {
      return <Skeleton className="h-10 w-40" />;
    }

    const hasSubscription = subscriptionStatus?.hasSubscription ?? false;
    const canCreateMore = subscriptionStatus?.storeUsage?.canCreateMore ?? false;
    const subscription = subscriptionStatus?.subscription;

    // No subscription atau status tidak ACTIVE
    if (!hasSubscription || subscription?.status !== "ACTIVE") {
      return (
        <Button onClick={() => router.push("/pricing")}>
          Subscribe to Create Store
        </Button>
      );
    }

    // Limit reached
    if (!canCreateMore) {
      return (
        <Button onClick={() => router.push("/pricing")}>
          Upgrade Plan
        </Button>
      );
    }

    // Bisa create store
    return <CreateStoreDialog />;
  };

  return (
    <div>
      {renderCreateStoreButton()}
    </div>
  );
}
```

## 🔍 Contoh Check Plan Specific

```typescript
export function MyComponent() {
  const { data } = useSubscriptionStatus();
  const subscription = data?.subscription;

  // Cek apakah user pakai plan PRO
  const isProPlan = subscription?.plan === "PRO";

  // Cek apakah user pakai plan STARTER
  const isStarterPlan = subscription?.plan === "STARTER";

  // Cek apakah user pakai plan ENTERPRISE
  const isEnterprisePlan = subscription?.plan === "ENTERPRISE";

  // Cek apakah subscription aktif
  const isActive = subscription?.status === "ACTIVE";

  // Cek apakah subscription akan di-cancel
  const willCancel = subscription?.cancelAtPeriodEnd;

  return (
    <div>
      {isProPlan && <div>You are on Pro plan</div>}
      {isStarterPlan && <div>You are on Starter plan</div>}
      {isEnterprisePlan && <div>You are on Enterprise plan</div>}
      {isActive && <div>Your subscription is active</div>}
      {willCancel && <div>Your subscription will be canceled</div>}
    </div>
  );
}
```

## 📊 Contoh Check Store Usage

```typescript
export function StoreUsageComponent() {
  const { data } = useSubscriptionStatus();
  const storeUsage = data?.storeUsage;

  if (!storeUsage) {
    return <div>No store usage data</div>;
  }

  const { current, limit, canCreateMore } = storeUsage;

  return (
    <div>
      <p>Current stores: {current}</p>
      <p>Limit: {limit === Infinity ? "Unlimited" : limit}</p>
      <p>Can create more: {canCreateMore ? "Yes" : "No"}</p>

      {/* Progress bar */}
      {limit !== Infinity && (
        <div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${(current / limit) * 100}%` }}
            />
          </div>
          <p>{current} / {limit} stores used</p>
        </div>
      )}
    </div>
  );
}
```

## 🎯 Return Value dari Hook

Hook mengembalikan object dengan properties dari TanStack Query:

```typescript
{
  data: SubscriptionStatusResponse | undefined;  // Data subscription
  isLoading: boolean;                            // Apakah sedang loading?
  isError: boolean;                              // Apakah ada error?
  error: Error | null;                           // Error object jika ada
  refetch: () => void;                           // Function untuk refresh data
  isFetching: boolean;                           // Apakah sedang fetch?
  isSuccess: boolean;                            // Apakah fetch berhasil?
}
```

## 🔄 Auto-refresh & Caching

- **Cache Time**: 30 detik (data dianggap fresh selama 30 detik)
- **Auto-refetch**: Otomatis refresh saat window focus
- **Retry**: Tidak ada retry (jika error, langsung return error)

## 🔌 API Endpoint

Hook menggunakan API endpoint:
```
GET /api/subscriptions/status
```

### API Response

**Jika user punya subscription:**
```json
{
  "hasSubscription": true,
  "subscription": {
    "id": "sub_123",
    "plan": "PRO",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  },
  "storeUsage": {
    "current": 2,
    "limit": 999999,
    "canCreateMore": true
  }
}
```

**Jika user tidak punya subscription:**
```json
{
  "hasSubscription": false,
  "subscription": null,
  "storeUsage": null
}
```

## ✅ Best Practices

### 1. Selalu Check Loading State

```typescript
const { data, isLoading } = useSubscriptionStatus();

if (isLoading) {
  return <Skeleton />;
}
```

### 2. Gunakan Optional Chaining

```typescript
// ✅ Good
const plan = data?.subscription?.plan;
const status = data?.subscription?.status;

// ❌ Bad
const plan = data.subscription.plan; // Bisa error jika data undefined
```

### 3. Gunakan Nullish Coalescing

```typescript
// ✅ Good
const hasSubscription = data?.hasSubscription ?? false;
const canCreateMore = data?.storeUsage?.canCreateMore ?? false;

// ❌ Bad
const hasSubscription = data?.hasSubscription || false; // Bisa salah jika hasSubscription adalah false
```

### 4. Check Status ACTIVE

```typescript
// ✅ Good - Check hasSubscription DAN status ACTIVE
if (!hasSubscription || subscription?.status !== "ACTIVE") {
  return <SubscribeButton />;
}

// ❌ Bad - Hanya check hasSubscription
if (!hasSubscription) {
  return <SubscribeButton />;
}
```

### 5. Handle Error State

```typescript
const { data, isLoading, error } = useSubscriptionStatus();

if (error) {
  return <ErrorMessage error={error} />;
}
```

## 🎨 Contoh Lengkap dengan UI

```typescript
"use client";

import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function SubscriptionStatusCard() {
  const { data, isLoading, error } = useSubscriptionStatus();

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load subscription status</p>
        </div>
      </div>
    );
  }

  const hasSubscription = data?.hasSubscription ?? false;
  const subscription = data?.subscription;
  const storeUsage = data?.storeUsage;

  // No subscription
  if (!hasSubscription) {
    return (
      <div className="p-4 border rounded-lg">
        <p className="font-semibold mb-2">No Active Subscription</p>
        <Button onClick={() => router.push("/pricing")}>
          Subscribe Now
        </Button>
      </div>
    );
  }

  // Has subscription
  const isActive = subscription?.status === "ACTIVE";
  const plan = subscription?.plan;
  const status = subscription?.status;

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">{plan} Plan</h3>
        <Badge variant={isActive ? "default" : "destructive"}>
          {status}
        </Badge>
      </div>

      {storeUsage && (
        <div className="mt-2">
          <p className="text-sm text-gray-600">
            Stores: {storeUsage.current} / {storeUsage.limit === Infinity ? "Unlimited" : storeUsage.limit}
          </p>
          {!storeUsage.canCreateMore && (
            <p className="text-sm text-orange-600 mt-1">
              Store limit reached. Upgrade to create more stores.
            </p>
          )}
        </div>
      )}

      {subscription?.cancelAtPeriodEnd && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Your subscription will be canceled on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
```

## 🔗 Related Files

- **Hook**: `src/features/stores/stores/hooks/use-subscription-status.ts`
- **API Route**: `src/app/api/subscriptions/status/route.ts`
- **Helpers**: `src/lib/utils/subscription-helpers.ts`
- **Usage Examples**:
  - `src/features/stores/stores/components/stores-container.tsx`
  - `src/features/dashboard/billing/components/billing-container.tsx`

## 📚 Summary

Hook `useSubscriptionStatus` adalah cara terbaik untuk:
- ✅ Cek apakah user punya subscription
- ✅ Tahu plan apa yang dipilih user
- ✅ Tahu status subscription (ACTIVE, CANCELED, dll)
- ✅ Tahu store usage (berapa store vs limit)
- ✅ Tahu apakah bisa create store lagi
- ✅ Auto-caching dan refresh dengan TanStack Query

**Gunakan hook ini di semua component yang perlu cek subscription status!**

