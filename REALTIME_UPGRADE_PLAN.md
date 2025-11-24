# ⚡ REAL-TIME UPDATE UPGRADE PLAN - EPIDOM

## 🎯 OBJECTIVE
Achieve near-instant data synchronization across all tabs (Management, Tracking, Data, Alerts) when stock/materials/products are modified.

---

## 📊 CURRENT STATE vs TARGET

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Stock Update Latency** | 10-30s (polling) | 0.1-1s | **30-300x faster** |
| **Cross-Tab Sync** | 30s delay | Instant (\<1s) | **Real-time** |
| **Multi-User Sync** | Manual refresh | Real-time push | **Collaborative** |
| **Network Efficiency** | Polling overhead | Event-driven | **90% less traffic** |

---

## 🎯 TIER 1: QUICK WINS (1-2 Hours) ⚡ IMPLEMENT THIS FIRST!

### **A. Reduce Polling Interval for Critical Data**

**Impact**: Stock updates visible in 5-10s instead of 30s

**Changes Needed**:

#### 1. Update Materials Hook
```typescript
// File: src/features/dashboard/data/materials/hooks/use-materials.ts
// Line 75-82

// BEFORE:
staleTime: 20 * 1000, // 20 seconds
refetchInterval: 30 * 1000, // Poll every 30 seconds

// AFTER (for stock-critical data):
staleTime: 3 * 1000, // 3 seconds - consider data stale faster
refetchInterval: 5 * 1000, // Poll every 5 seconds - much more responsive
```

#### 2. Update Products Hook
```typescript
// File: src/features/dashboard/data/products/hooks/use-products.ts
// Line 194-201

// BEFORE:
staleTime: 20 * 1000,
refetchInterval: 30 * 1000,

// AFTER:
staleTime: 3 * 1000,
refetchInterval: 5 * 1000,
```

#### 3. Update Stock Movements Hook
```typescript
// File: src/features/dashboard/management/edit-stock/hooks/use-stock-movements.ts
// Add similar aggressive polling
staleTime: 2 * 1000,
refetchInterval: 5 * 1000,
```

**Pros**:
- ✅ Immediate improvement (edit code → done)
- ✅ No infrastructure changes
- ✅ Works with current TanStack Query setup

**Cons**:
- ⚠️ More API calls (5x increase)
- ⚠️ Higher bandwidth usage
- ⚠️ Database load increase

**When to Use**: If you need quick improvement NOW without backend changes.

---

### **B. Aggressive Cache Invalidation Strategy**

**Impact**: Force immediate refetch on mutations instead of background sync

**Changes Needed**:

```typescript
// File: src/features/dashboard/management/edit-stock/hooks/use-stock-adjustment.ts
// Line 115 - Change from `immediate: true` with smarter refetch

onSuccess: async (response, input) => {
  // Force IMMEDIATE refetch of ALL affected queries
  await Promise.all([
    queryClient.refetchQueries({
      queryKey: ["materials", storeId],
      type: "active", // Force refetch active queries NOW
    }),
    queryClient.refetchQueries({
      queryKey: ["products", storeId],
      type: "active",
    }),
    queryClient.refetchQueries({
      queryKey: ["recipes", storeId],
      type: "all", // Refetch even inactive to ensure consistency
    }),
    queryClient.refetchQueries({
      queryKey: ["stock-movements", storeId],
      type: "active",
    }),
  ]);

  // Show success toast with updated data
  toast.success(`Stock updated: ${response.movement.balanceAfter} ${input.unit}`);
}
```

**Pros**:
- ✅ Guaranteed sync within 1-2 seconds
- ✅ User sees updated data immediately after action
- ✅ No infrastructure changes

**Cons**:
- ⚠️ Slightly slower mutation (wait for refetches)
- ⚠️ More database queries on each mutation

---

## 🚀 TIER 2: WEBSOCKET EVENTS (1-2 Days) - RECOMMENDED! 🔥

### **What It Is**
Instead of polling every 5 seconds, server **pushes updates** when data changes.

```
Traditional Polling (Current):
Client → [every 5s] → Server: "Any updates?"
Server → Client: "Here's the data"
(29 wasted requests if no changes)

WebSocket Push:
[User edits stock]
Server → Client: "Stock changed! Here's new data"
Client: Updates UI instantly!
(Only 1 message when needed)
```

### **Implementation Plan**

#### **Step 1: Install Dependencies**
```bash
pnpm add pusher pusher-js
# Or use Socket.io, Supabase Realtime, Ably
```

#### **Step 2: Setup Pusher (Recommended: Easy + Free Tier)**

**Backend Setup** (`src/lib/pusher.ts`):
```typescript
import Pusher from 'pusher'

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export type StockUpdateEvent = {
  type: 'material' | 'product'
  storeId: string
  id: string
  currentStock: number
  updatedAt: string
}

// Trigger event saat stock berubah
export async function broadcastStockUpdate(event: StockUpdateEvent) {
  await pusher.trigger(
    `store-${event.storeId}`, // Channel per store
    'stock-updated', // Event name
    event
  )
}
```

**Update API Routes** (`src/app/api/stores/[id]/stock/adjust/route.ts`):
```typescript
import { broadcastStockUpdate } from '@/lib/pusher'

export async function POST(request: Request) {
  // ... existing code ...

  const result = await adjustStock(...)

  // 🔥 BROADCAST TO ALL CONNECTED CLIENTS
  await broadcastStockUpdate({
    type: result.materialId ? 'material' : 'product',
    storeId,
    id: result.materialId || result.productId,
    currentStock: result.movement.balanceAfter,
    updatedAt: new Date().toISOString(),
  })

  return NextResponse.json(...)
}
```

**Frontend Setup** (`src/hooks/use-real-time-stock.ts`):
```typescript
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Pusher from 'pusher-js'
import { materialKeys } from '@/features/dashboard/data/materials/hooks/use-materials'
import { productKeys } from '@/features/dashboard/data/products/hooks/use-products'

export function useRealTimeStock(storeId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!storeId) return

    // Connect to Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })

    // Subscribe to store channel
    const channel = pusher.subscribe(`store-${storeId}`)

    // Listen to stock updates
    channel.bind('stock-updated', (data: StockUpdateEvent) => {
      console.log('📡 Real-time stock update received:', data)

      // Immediately refetch affected queries
      if (data.type === 'material') {
        queryClient.invalidateQueries({
          queryKey: materialKeys.lists(storeId),
          refetchType: 'active', // Refetch active queries NOW
        })
      } else if (data.type === 'product') {
        queryClient.invalidateQueries({
          queryKey: productKeys.lists(storeId),
          refetchType: 'active',
        })
      }

      // Also invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['recipes', storeId],
        refetchType: 'active',
      })

      queryClient.invalidateQueries({
        queryKey: ['stock-movements', storeId],
        refetchType: 'active',
      })
    })

    // Cleanup on unmount
    return () => {
      channel.unbind_all()
      channel.unsubscribe()
      pusher.disconnect()
    }
  }, [storeId, queryClient])
}
```

**Use in Layout** (`src/app/(app)/store/[storeId]/layout.tsx`):
```typescript
'use client'

import { useRealTimeStock } from '@/hooks/use-real-time-stock'

export default function StoreLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { storeId: string }
}) {
  // 🔥 Enable real-time updates for this store
  useRealTimeStock(params.storeId)

  return <>{children}</>
}
```

**Benefits**:
- ✅ **Instant updates** (< 500ms latency)
- ✅ **Multi-user collaboration** (User A edit → User B sees instantly)
- ✅ **90% less network traffic** (no polling!)
- ✅ **Better UX** (no stale data)

**Cost**:
- Pusher Free: 200k messages/day, 100 concurrent connections (**FREE forever**)
- If exceed: $49/month (still cheaper than increased database load)

---

## 🏆 TIER 3: OPTIMISTIC UI PATTERNS (3-5 Days)

### **What It Is**
UI updates BEFORE server confirms (instant feedback).

**Example - Current vs Optimistic**:

```typescript
// CURRENT (Good, but has delay):
const { mutate: adjustStock } = useStockAdjustment(storeId)

function handleSubmit(data) {
  adjustStock(data) // ← UI waits for server response (500ms)
  // [User sees loading spinner for 500ms]
  // [Then UI updates]
}

// OPTIMISTIC (Instant):
const { mutate: adjustStock } = useStockAdjustment(storeId)

function handleSubmit(data) {
  adjustStock(data, {
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: materialKeys.lists(storeId) })

      // Snapshot current data
      const previous = queryClient.getQueryData(materialKeys.list(storeId))

      // Optimistically update UI IMMEDIATELY (before server)
      queryClient.setQueryData(materialKeys.list(storeId), (old) => ({
        ...old,
        materials: old.materials.map(m =>
          m.id === data.materialId
            ? { ...m, currentStock: m.currentStock + data.quantity }
            : m
        )
      }))

      // [UI updates INSTANTLY - 0ms!]
      toast.success('Stock updated') // ← Shows immediately

      return { previous } // For rollback if server fails
    },
    onError: (err, variables, context) => {
      // Rollback if server rejects
      queryClient.setQueryData(materialKeys.list(storeId), context.previous)
      toast.error('Failed to update stock')
    }
  })
}
```

**Implementation**: Already EXISTS in your code! (Line 137-171 in `use-materials.ts`)

**To Enhance**: Add optimistic updates to ALL mutations (products, recipes, etc.)

---

## 📋 **IMPLEMENTATION CHECKLIST**

### Phase 1 (Today - Quick Wins) ⚡
- [ ] Reduce polling interval to 5s for materials
- [ ] Reduce polling interval to 5s for products
- [ ] Reduce polling interval to 5s for stock movements
- [ ] Test cross-tab sync speed
- [ ] Monitor database load (use Neon dashboard)

### Phase 2 (This Week - WebSocket) 🚀
- [ ] Sign up Pusher (free tier)
- [ ] Add environment variables
- [ ] Create `src/lib/pusher.ts`
- [ ] Add broadcast to stock adjustment API
- [ ] Create `src/hooks/use-real-time-stock.ts`
- [ ] Add to store layout
- [ ] Test multi-user updates

### Phase 3 (Next Week - Polish) ✨
- [ ] Add optimistic updates to all mutations
- [ ] Add loading states for better UX
- [ ] Add error handling for WebSocket disconnect
- [ ] Add "Someone else updated" notification
- [ ] Performance testing with 100+ concurrent users

---

## 🎯 **RECOMMENDED PATH**

**FOR IMMEDIATE RESULTS (Today)**:
→ Implement **TIER 1** (reduce polling to 5s)

**FOR PRODUCTION-GRADE (This Week)**:
→ Implement **TIER 2** (WebSocket with Pusher)

**FOR BEST UX (Next Week)**:
→ Implement **TIER 3** (Optimistic UI everywhere)

---

## 📊 **EXPECTED RESULTS**

| Scenario | Before | After Tier 1 | After Tier 2 | After Tier 3 |
|----------|--------|--------------|--------------|--------------|
| Edit stock → See in Data tab | 30s | 5-10s | 0.5s | **0ms (instant)** |
| Edit material → See in Production | 30s | 5-10s | 0.5s | **0ms** |
| Multi-user (User A → User B) | Manual refresh | 5-10s | 0.5s | **0.5s** |
| Network requests/minute | 2 | 12 | 0-1 | 0-1 |
| User satisfaction | 😐 | 🙂 | 😄 | **🤩** |

---

## 💰 **COST ANALYSIS**

### Tier 1 (Aggressive Polling)
- Database reads: +400% (5s vs 30s)
- Neon cost: +$15-20/month
- **Total Cost**: $15-20/month

### Tier 2 (WebSocket)
- Database reads: -90% (no polling)
- Neon cost: -$30/month
- Pusher cost: $0 (free tier) to $49/month
- **Total Cost**: -$30 to +$19/month
- **NET SAVINGS with free Pusher**: $30/month! 🎉

### Tier 3 (Optimistic UI)
- No additional cost
- **Better UX + No cost = WIN**

---

## 🚨 **CRITICAL NOTES**

1. **Don't implement Tier 1 + Tier 2 together**
   - Tier 1 is temporary solution
   - Tier 2 replaces polling completely

2. **Test with multiple browsers/users**
   - Open 3-4 browser windows
   - Test simultaneous edits

3. **Monitor Pusher usage**
   - Free tier: 200k messages/day
   - 100 concurrent users = ~20k messages/day
   - You're safe for 6-12 months

4. **Graceful degradation**
   - If WebSocket fails → fall back to polling
   - User experience should never break

---

## 🎓 **LEARNING RESOURCES**

- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Pusher Getting Started](https://pusher.com/docs/channels/getting_started/javascript/)
- [Real-time Best Practices](https://web.dev/real-time/)

---

**Questions? Need help implementing? Let me know! 🚀**
