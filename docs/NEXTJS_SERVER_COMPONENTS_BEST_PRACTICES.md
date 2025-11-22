# Next.js Server Components Best Practices - Analisis Project Ini

## 📋 Overview

User bertanya: **"Best practices di Next.js itu adalah semua yang berkaitan dengan data atau pengambilan data itu dilakukan di server component, apakah benar?"**

**JAWABAN: ✅ BENAR!** Ini adalah best practice untuk Next.js 15 dengan App Router.

---

## ✅ Best Practices Next.js 15 App Router

### 1. **Server Components adalah Default**

**Aturan Utama:**
- ✅ **Server Components** (default) - untuk data fetching
- ⚠️ **Client Components** (`"use client"`) - hanya untuk interactivity

### 2. **Data Fetching Pattern**

**Best Practice:**
```typescript
// ✅ BENAR: Server Component (default)
// src/app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { materialRepository } from "@/lib/repositories/material.repository";

export default async function DashboardPage({ params }: { params: { storeId: string } }) {
  // ✅ Fetch data langsung di Server Component
  const session = await getServerSession(authOptions);
  const materials = await materialRepository.findByStoreId(params.storeId);

  // ✅ Pass data sebagai props ke Client Component
  return <DashboardClient materials={materials} storeId={params.storeId} />;
}
```

**Current Implementation (Bukan Best Practice):**
```typescript
// ⚠️ CURRENT: Client Component dengan TanStack Query
// src/app/dashboard/page.tsx
"use client";

export default function DashboardPage() {
  // ⚠️ Fetch data di Client Component (client-side network call)
  const { data } = useMaterials(storeId);

  return <DashboardView data={data} />;
}
```

---

## 📊 Analisis Implementasi Saat Ini

### ❌ **Current Pattern (Client Components untuk Data Fetching)**

**Pattern yang Digunakan:**
```
Page (Client)
  → Client Component
    → Custom Hook (useQuery)
      → API Route
        → Service
          → Repository
            → Database
```

**Contoh Real:**
```typescript
// ❌ CURRENT: src/app/(app)/store/[storeId]/(dashboard)/data/page.tsx
"use client";  // ❌ Client Component

export default function DataPage() {
  return <DataView />;  // ❌ Component ini menggunakan useQuery
}

// ❌ CURRENT: src/features/dashboard/data/materials/components/materials-section.tsx
"use client";

export function MaterialsSection() {
  const { data, isLoading } = useMaterials(storeId);  // ❌ Client-side fetch

  // ... UI rendering
}
```

**Masalah dengan Pattern Ini:**
1. ❌ **Client-side network calls** - Data di-fetch dari browser
2. ❌ **Waterfall requests** - Multiple round-trips
3. ❌ **Larger bundle size** - TanStack Query di-include di client
4. ❌ **Slower initial load** - Perlu wait untuk data fetching
5. ❌ **No SEO** - Data tidak di-render di server
6. ❌ **Extra API route layer** - Tidak perlu untuk internal data

---

### ✅ **Best Practice Pattern (Server Components untuk Data Fetching)**

**Pattern yang Seharusnya:**
```
Page (Server - Default)
  → Direct Database Access (Server)
    → Pass Data as Props
      → Client Component (Hanya untuk interactivity)
```

**Contoh Best Practice:**
```typescript
// ✅ BEST PRACTICE: Server Component (default, no "use client")
// src/app/(app)/store/[storeId]/(dashboard)/data/page.tsx
import { getServerSession } from "next-auth";
import { materialRepository } from "@/lib/repositories/material.repository";
import { MaterialsSectionClient } from "@/features/dashboard/data/materials/components/materials-section-client";

export default async function DataPage({ params }: { params: { storeId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ✅ Fetch data langsung di Server Component
  const materials = await materialRepository.findByStoreId(params.storeId);

  // ✅ Pass data sebagai props ke Client Component
  return <MaterialsSectionClient initialMaterials={materials} storeId={params.storeId} />;
}
```

**Keuntungan:**
1. ✅ **Server-side rendering** - Data di-render di server
2. ✅ **Direct database access** - Tidak perlu API route
3. ✅ **Smaller bundle size** - Repository code tidak di-include di client
4. ✅ **Faster initial load** - Data sudah tersedia saat render
5. ✅ **SEO-friendly** - Data di-render di HTML
6. ✅ **Better security** - Database credentials di server

---

## 🔍 Perbandingan: Current vs Best Practice

| Aspek | Current (Client Components) | Best Practice (Server Components) |
|-------|----------------------------|----------------------------------|
| **Data Fetching** | Client-side (browser) | Server-side (build/render time) |
| **Network Calls** | HTTP request dari browser | Direct database access |
| **Initial Load** | Perlu wait untuk data | Data sudah di-render |
| **Bundle Size** | TanStack Query di client | Repository code tidak di-client |
| **SEO** | ❌ Tidak SEO-friendly | ✅ SEO-friendly |
| **Security** | ⚠️ API routes layer | ✅ Direct server access |
| **Performance** | ⚠️ Slower (waterfall) | ✅ Faster (parallel) |

---

## 📋 Kapan Gunakan Server vs Client Components

### ✅ **Server Components (Default) - Gunakan Untuk:**

1. **Data Fetching** ✅
   ```typescript
   // ✅ Fetch data dari database
   const materials = await materialRepository.findByStoreId(storeId);
   ```

2. **Access Backend Resources** ✅
   ```typescript
   // ✅ Access database, file system, API keys
   const data = await fetchData();
   ```

3. **Keep Sensitive Information** ✅
   ```typescript
   // ✅ API keys, database credentials (tidak expose ke client)
   const config = process.env.SECRET_KEY;
   ```

4. **Large Dependencies** ✅
   ```typescript
   // ✅ Dependencies yang besar (tidak di-include di client bundle)
   import { heavyLibrary } from "heavy-library";
   ```

5. **Reduced Client-Side JavaScript** ✅
   ```typescript
   // ✅ Mengurangi JavaScript yang di-send ke client
   ```

### ⚠️ **Client Components (`"use client"`) - Hanya Untuk:**

1. **Interactivity** ⚠️
   ```typescript
   "use client";

   // ✅ Event handlers (onClick, onChange, dll)
   export function Button() {
     const handleClick = () => { /* ... */ };
     return <button onClick={handleClick}>Click</button>;
   }
   ```

2. **Browser APIs** ⚠️
   ```typescript
   "use client";

   // ✅ window, localStorage, dll
   useEffect(() => {
     localStorage.setItem("key", "value");
   }, []);
   ```

3. **React Hooks** ⚠️
   ```typescript
   "use client";

   // ✅ useState, useEffect, useContext, dll
   const [count, setCount] = useState(0);
   ```

4. **Real-time Updates** ⚠️
   ```typescript
   "use client";

   // ✅ WebSocket, polling, dll
   useEffect(() => {
     const ws = new WebSocket("ws://...");
   }, []);
   ```

---

## 🔄 Pattern Migrasi: Current → Best Practice

### **Phase 1: Server Components untuk Initial Data**

```typescript
// ✅ BEFORE: Client Component
"use client";

export default function DashboardPage() {
  const { data } = useMaterials(storeId);  // ❌ Client-side fetch
  return <DashboardView data={data} />;
}

// ✅ AFTER: Server Component
export default async function DashboardPage({ params }: { params: { storeId: string } }) {
  const materials = await materialRepository.findByStoreId(params.storeId);  // ✅ Server-side fetch
  return <DashboardViewClient initialMaterials={materials} storeId={params.storeId} />;
}
```

### **Phase 2: Hybrid Approach (Server + Client)**

```typescript
// ✅ Server Component: Initial data
export default async function DashboardPage({ params }: { params: { storeId: string } }) {
  // ✅ Fetch initial data di server
  const materials = await materialRepository.findByStoreId(params.storeId);

  return (
    <DashboardClient
      initialMaterials={materials}  // ✅ Pass initial data
      storeId={params.storeId}
    />
  );
}

// ✅ Client Component: Interactivity + Real-time updates
"use client";

export function DashboardClient({ initialMaterials, storeId }) {
  // ✅ Use initial data dari server
  const { data = initialMaterials } = useMaterials(storeId, {
    initialData: initialMaterials,  // ✅ Hydrate dengan server data
  });

  // ✅ Real-time updates (polling, mutations, dll)
  // ... interactivity code
}
```

---

## 📊 Analisis Project Ini

### ✅ **Yang Sudah Benar:**

1. **API Routes untuk Mutations** ✅
   - POST, PUT, DELETE operations
   - Form submissions
   - Real-time updates

2. **Service & Repository Layer** ✅
   - Clean architecture
   - Separation of concerns
   - Reusable logic

### ❌ **Yang Perlu Diubah (Tidak Best Practice):**

1. **GET Data Fetching** ❌
   - Saat ini: Client Components dengan TanStack Query
   - Seharusnya: Server Components dengan direct database access

2. **Pages dengan "use client"** ❌
   - Saat ini: Pages adalah Client Components
   - Seharusnya: Pages adalah Server Components (default)

3. **Initial Data Loading** ❌
   - Saat ini: Client-side fetch dengan loading states
   - Seharusnya: Server-side fetch dengan data ready

---

## 🎯 Rekomendasi untuk Project Ini

### **Option 1: Migrate ke Server Components (Recommended)**

**Keuntungan:**
- ✅ Better performance (server-side rendering)
- ✅ Smaller bundle size
- ✅ SEO-friendly
- ✅ Faster initial load
- ✅ Better security

**Yang Perlu Diubah:**
1. Remove `"use client"` dari pages
2. Fetch data di Server Components
3. Pass data sebagai props ke Client Components
4. Keep Client Components hanya untuk interactivity

**Effort:** Medium (butuh refactoring)

### **Option 2: Hybrid Approach (Pragmatic)**

**Keuntungan:**
- ✅ Tetap bisa pakai TanStack Query untuk real-time updates
- ✅ Initial data dari Server Components
- ✅ Mutations tetap dari Client Components

**Yang Perlu Diubah:**
1. Fetch initial data di Server Components
2. Pass sebagai `initialData` ke TanStack Query
3. Real-time updates tetap di Client Components

**Effort:** Low-Medium (gradual migration)

### **Option 3: Keep Current (Tidak Recommended)**

**Masalah:**
- ❌ Tidak sesuai best practices Next.js 15
- ❌ Slower initial load
- ❌ Larger bundle size
- ❌ Tidak SEO-friendly

**Effort:** None (keep as is)

---

## 📝 Contoh Refactoring

### **Example 1: Dashboard Page**

**BEFORE (Current - Client Component):**
```typescript
// ❌ src/app/(app)/store/[storeId]/(dashboard)/dashboard/page.tsx
"use client";

import { DashboardView } from "@/features/dashboard/dashboard/components/dashboard-view";

export default function DashboardPage() {
  return <DashboardView />;  // ❌ Component ini fetch data di client
}
```

**AFTER (Best Practice - Server Component):**
```typescript
// ✅ src/app/(app)/store/[storeId]/(dashboard)/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { materialRepository } from "@/lib/repositories/material.repository";
import { supplierRepository } from "@/lib/repositories/supplier.repository";
import { productionBatchRepository } from "@/lib/repositories/production-batch.repository";
import { alertRepository } from "@/lib/repositories/alert.repository";
import { DashboardClient } from "@/features/dashboard/dashboard/components/dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ✅ Fetch data di Server Component (parallel)
  const [materials, suppliers, productionBatches, alerts] = await Promise.all([
    materialRepository.findByStoreId(storeId),
    supplierRepository.findByStoreId(storeId),
    productionBatchRepository.findByStoreId(storeId, { status: "COMPLETED" }),
    alertRepository.findByStoreId(storeId),
  ]);

  // ✅ Pass data sebagai props ke Client Component
  return (
    <DashboardClient
      initialMaterials={materials}
      initialSuppliers={suppliers}
      initialProductionBatches={productionBatches}
      initialAlerts={alerts}
      storeId={storeId}
    />
  );
}
```

### **Example 2: Materials Section**

**BEFORE (Current - Client Component):**
```typescript
// ❌ src/features/dashboard/data/materials/components/materials-section.tsx
"use client";

export function MaterialsSection() {
  const { storeId } = useCurrentStore();
  const { data, isLoading } = useMaterials(storeId);  // ❌ Client-side fetch

  if (isLoading) return <Loading />;
  if (!data) return <Error />;

  return <MaterialsList materials={data.materials} />;
}
```

**AFTER (Best Practice - Server Component + Client Component):**
```typescript
// ✅ src/app/(app)/store/[storeId]/(dashboard)/data/page.tsx (Server Component)
import { getServerSession } from "next-auth";
import { materialRepository } from "@/lib/repositories/material.repository";
import { MaterialsSectionClient } from "@/features/dashboard/data/materials/components/materials-section-client";

export default async function DataPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ✅ Fetch data di Server Component
  const materials = await materialRepository.findByStoreId(storeId);

  return <MaterialsSectionClient initialMaterials={materials} storeId={storeId} />;
}

// ✅ src/features/dashboard/data/materials/components/materials-section-client.tsx (Client Component)
"use client";

interface MaterialsSectionClientProps {
  initialMaterials: MaterialWithSuppliers[];
  storeId: string;
}

export function MaterialsSectionClient({ initialMaterials, storeId }: MaterialsSectionClientProps) {
  // ✅ Use initial data dari server, dengan real-time updates
  const { data = { materials: initialMaterials } } = useMaterials(storeId, {
    initialData: { materials: initialMaterials },  // ✅ Hydrate dengan server data
  });

  // ✅ Interactivity (filtering, sorting, mutations) tetap di client
  const [filters, setFilters] = useState({});
  // ... interactivity code

  return <MaterialsList materials={data.materials} />;
}
```

---

## ✅ Kesimpulan

### **Benar!** ✅

Best practices Next.js 15 App Router adalah:
1. ✅ **Server Components (default)** untuk data fetching
2. ✅ **Direct database access** di Server Components
3. ✅ **Client Components** hanya untuk interactivity
4. ✅ **Pass data sebagai props** dari Server ke Client Components

### **Current Implementation vs Best Practice:**

| Aspect | Current | Best Practice |
|--------|---------|---------------|
| **Data Fetching** | ❌ Client Components | ✅ Server Components |
| **Network Calls** | ❌ HTTP dari browser | ✅ Direct DB access |
| **Initial Load** | ❌ Slower (waterfall) | ✅ Faster (parallel) |
| **Bundle Size** | ❌ Larger (TanStack Query) | ✅ Smaller (no query lib) |
| **SEO** | ❌ Not SEO-friendly | ✅ SEO-friendly |

---

## 💡 Rekomendasi

**Saya sarankan migrasi ke Server Components pattern** karena:

1. ✅ **Better Performance** - Server-side rendering
2. ✅ **Smaller Bundle** - TanStack Query hanya untuk mutations
3. ✅ **SEO-Friendly** - Data di-render di HTML
4. ✅ **Best Practice** - Sesuai Next.js 15 recommendations

**Apakah Anda ingin saya bantu refactor project ini ke Server Components pattern?**

**Effort Estimasi:**
- Small refactor (hybrid approach): 2-3 hours
- Full refactor (pure server components): 1-2 days

**Last Updated:** 2025-01-XX

