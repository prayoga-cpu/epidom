# 📊 EPIDOM Dashboard - Complete Analysis

> **Date**: 2025-12-22
> **Status**: Production-Ready
> **Coverage**: 100% Complete

---

## 📑 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Dashboard Structure](#dashboard-structure)
3. [Pages & Features](#pages--features)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Navigation System](#navigation-system)
7. [Performance Optimizations](#performance-optimizations)
8. [UI/UX Features](#uiux-features)

---

## 🎯 Executive Summary

**EPIDOM Dashboard** adalah aplikasi web dashboard untuk manajemen bisnis makanan (bakery, cookie bar, food manufacturer). Dashboard ini dibangun dengan arsitektur modern yang fokus pada:

- **Server Components** untuk initial data fetch (SSR)
- **Client Components** untuk interaktivitas
- **Lazy Loading** untuk optimal performance
- **Store-scoped data** - semua data terikat pada store tertentu

### URL Structure:

```
/store/[storeId]/dashboard     → Main dashboard
/store/[storeId]/data          → Materials, Recipes, Products, Suppliers
/store/[storeId]/management    → Deliveries, Production, Stock
/store/[storeId]/tracking      → Stock movements
/store/[storeId]/alerts        → Low stock alerts
/store/[storeId]/profile       → User profile
/store/[storeId]/billing       → Subscription management
```

---

## 🏗️ Dashboard Structure

### Route Structure (App Router)

```
src/app/(app)/store/[storeId]/(dashboard)/
├── layout.tsx              # Dashboard shell (Topbar + Sidebar + PageShell)
├── dashboard/
│   └── page.tsx           # Main dashboard (server component)
├── data/
│   └── page.tsx           # Data management (server component)
├── management/
│   └── page.tsx           # Operations management (server component)
├── tracking/
│   └── page.tsx           # Stock tracking (server component)
├── alerts/
│   └── page.tsx           # Alert center (server component)
├── profile/
│   └── page.tsx           # User profile (server component)
└── billing/
    └── page.tsx           # Subscription & billing (server component)
```

### Feature Structure

```
src/features/dashboard/
├── shared/                 # Shared dashboard components
│   ├── page-shell.tsx     # Main layout wrapper
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── topbar.tsx         # Top navigation bar
│   ├── store-switcher.tsx # Multi-store selector
│   ├── nav-user.tsx       # User avatar/menu
│   └── global-search-dialog.tsx # Global search (⌘K)
│
├── dashboard/             # Main dashboard feature
│   └── components/
│       ├── dashboard-client.tsx
│       └── (various cards and charts)
│
├── data/                  # Data management feature (CRUD)
│   ├── components/        # Shared data components
│   ├── materials/         # Materials CRUD
│   ├── products/          # Products CRUD
│   ├── recipes/           # Recipes CRUD
│   └── suppliers/         # Suppliers CRUD
│
├── management/            # Operations management
│   ├── delivery/          # Supplier delivery tracking
│   ├── edit-stock/        # Stock adjustment
│   ├── recipe-production/ # Production from recipes
│   └── production-history/# Production batch history
│
├── tracking/              # Stock movement tracking
│   ├── components/
│   └── hooks/
│
├── alerts/                # Alert system
│   ├── components/
│   └── hooks/
│
├── profile/               # User profile
│   └── components/
│
└── billing/               # Subscription management
    └── components/
```

---

## 📄 Pages & Features

### 1. 🏠 Dashboard Page (`/dashboard`)

**Purpose**: Overview dashboard dengan ringkasan bisnis.

**Server Component Fetches**:

```typescript
await Promise.all([
  fetchStockLevelsForPage(storeId), // Top 5 lowest stock
  fetchSuppliersForPage(storeId), // Recent suppliers
  fetchProductionBatchesForPage(storeId), // Recent productions
  fetchAlertsForPage(storeId), // Active alerts
]);
```

**Features**:

- 📊 Stock level overview (top 5 lowest)
- 🏭 Recent production batches (completed)
- 📦 Supplier overview
- 🔔 Active alerts summary

**Client Component**: `DashboardClient`

---

### 2. 📦 Data Page (`/data`)

**Purpose**: Master data management dengan 4 tabs.

**Server Component Fetches**:

```typescript
await Promise.all([
  fetchMaterialsForPage(storeId), // All materials
  fetchRecipesForPage(storeId), // All recipes
  fetchProductsForPage(storeId), // All products
  fetchSuppliersForPage(storeId), // All suppliers
]);
```

**Tabs**:

| Tab           | Description                 | CRUD Operations            |
| ------------- | --------------------------- | -------------------------- |
| **Materials** | Raw ingredients/bahan baku  | ✅ Full CRUD + Bulk Import |
| **Recipes**   | Production recipes          | ✅ Full CRUD + Duplicate   |
| **Products**  | Finished products           | ✅ Full CRUD + Bulk Import |
| **Suppliers** | Supplier contacts & pricing | ✅ Full CRUD               |

**Features per Tab**:

- 🔍 Search & filter
- ➕ Add new item (dialog)
- ✏️ Edit item (dialog)
- 🗑️ Delete item (confirmation)
- 📋 View details (dialog)
- 📤 Bulk import (CSV)
- 📥 Export (Excel/PDF)

**Client Component**: `DataViewClient` (uses lazy loading)

---

### 3. 🏭 Management Page (`/management`)

**Purpose**: Day-to-day operations management.

**Server Component Fetches**:

```typescript
await fetchSupplierOrdersForPage(storeId, {
  status: ["PLACED", "RECEIVED"],
  take: 100,
});
```

**Tabs**:

| Tab            | Description                   | Features                                              |
| -------------- | ----------------------------- | ----------------------------------------------------- |
| **Deliveries** | Supplier order tracking       | View/update delivery status, print receipts           |
| **Production** | Start production from recipes | Select recipe → check material availability → produce |
| **History**    | Production batch history      | View completed/cancelled batches                      |
| **Stock**      | Stock adjustments             | Manual adjustment, bulk adjustment, CSV import        |

**Key Components**:

- `SupplierDeliveriesTable` - Delivery tracking table
- `RecipeProductionCard` - Production wizard
- `ProductionHistoryCard` - Batch history
- `EditStockCard` - Stock adjustment interface

**Dialogs**:

- `UpdateDeliveryStatusDialog` - Change delivery status
- `PrintDeliveryDialog` - Print delivery receipt (PDF)
- `StartProductionDialog` - Production wizard
- `StockAdjustmentDialog` - Single item adjustment
- `BulkAdjustmentDialog` - Multiple items
- `CSVImportDialog` - Import from CSV

---

### 4. 📈 Tracking Page (`/tracking`)

**Purpose**: Stock movement audit trail.

**Server Component Fetches**:

```typescript
await fetchMaterialsForPage(storeId);
```

**Features**:

- 📊 Stock level visualization
- 📜 Movement history (IN/OUT)
- 🔎 Filter by type (PURCHASE, SALE, ADJUSTMENT, PRODUCTION_IN, PRODUCTION_OUT, WASTE)

**Movement Types**:

```typescript
enum MovementType {
  PURCHASE, // Stock masuk dari pembelian
  PRODUCTION_IN, // Stock produk masuk dari produksi
  PRODUCTION_OUT, // Bahan baku berkurang untuk produksi
  SALE, // Stock berkurang dari penjualan
  ADJUSTMENT, // Manual adjustment
  WASTE, // Stock waste/loss
}
```

---

### 5. 🔔 Alerts Page (`/alerts`)

**Purpose**: Alert center untuk stock warnings.

**Server Component Fetches**:

```typescript
await fetchAlertsForPage(storeId);
```

**Alert Types**:

- ⚠️ **LOW_STOCK** - Stock di bawah minimum
- 🔴 **CRITICAL_STOCK** - Stock < 25% dari minimum

**Alert Data**:

```typescript
interface Alert {
  id: string;
  type: "LOW_STOCK";
  severity: "critical" | "warning";
  materialId: string;
  materialName: string;
  currentStock: number;
  minStock: number;
  unit: string;
  stockPercentage: number;
  suppliers: Supplier[];
}
```

**Features**:

- 🔔 Badge count di sidebar navigation
- 📞 Direct contact supplier from alert
- 📦 Quick reorder action

---

### 6. 👤 Profile Page (`/profile`)

**Purpose**: User & business profile management.

**Server Component Fetches**:

```typescript
await userService.getProfile(session.user.id);
```

**Sections**:

| Section            | Components             | Features                          |
| ------------------ | ---------------------- | --------------------------------- |
| **Header**         | `ProfileHeader`        | Avatar, name, email               |
| **Personal Info**  | `PersonalInfoCard`     | Name, phone, locale, timezone     |
| **Business Info**  | `BusinessInfoCard`     | Business name, address, contact   |
| **Subscription**   | `SubscriptionInfoCard` | Plan, status, period, cancel      |
| **Stripe Connect** | `StripeConnectCard`    | Owner-only: Connect account setup |
| **Activity Log**   | `ActivityLogCard`      | Recent actions                    |

**Dialogs**:

- `EditAvatarDialog` - Upload & crop avatar
- `EditPersonalInfoDialog` - Edit personal details
- `EditBusinessInfoDialog` - Edit business details

---

### 7. 💳 Billing Page (`/billing`)

**Purpose**: Subscription & payment management.

**Features**:

- 📊 Current plan overview
- 📈 Usage statistics (stores, products)
- 🔄 Upgrade/downgrade options
- ❌ Cancel subscription
- 💳 Manage payment methods (via Stripe Portal)

---

## 🧩 Component Architecture

### Layout Hierarchy

```
Layout.tsx (Dashboard)
└── PageShell
    ├── Topbar (fixed top)
    │   ├── Logo
    │   ├── GlobalSearchDialog (⌘K)
    │   ├── StoreSwitcher
    │   ├── LangSwitcher
    │   ├── NavUser
    │   └── LogoutButton
    │
    ├── Sidebar (desktop left)
    │   ├── Navigation Links
    │   │   ├── Profile
    │   │   ├── Dashboard
    │   │   ├── Management
    │   │   ├── Tracking
    │   │   ├── Data
    │   │   └── Alerts (with badge)
    │   └── (Mobile: StoreSwitcher + LangSwitcher)
    │
    └── Main Content (scrollable)
        └── {children} → Page content
```

### Component Patterns

#### 1. Server → Client Pattern

```typescript
// page.tsx (Server Component)
export default async function Page({ params }) {
  const data = await fetchData(storeId);
  return <ClientComponent initialData={data} storeId={storeId} />;
}

// client-component.tsx (Client Component)
"use client";
export function ClientComponent({ initialData, storeId }) {
  const { data } = useQuery({
    queryKey: ["key", storeId],
    queryFn: () => fetchFromApi(storeId),
    initialData, // SSR data
  });
  return <UI data={data} />;
}
```

#### 2. Lazy Loading Pattern

```typescript
const MaterialsSection = dynamic(
  () => import("./materials-section").then((mod) => ({
    default: mod.MaterialsSection,
  })),
  {
    loading: () => <TabContentSkeleton />,
    ssr: false,
  }
);
```

#### 3. Dialog Pattern

```typescript
// Controlled dialog with form
const [open, setOpen] = useState(false);
const [editing, setEditing] = useState<Item | null>(null);

<EditDialog
  open={open && !!editing}
  onOpenChange={(isOpen) => {
    setOpen(isOpen);
    if (!isOpen) setEditing(null);
  }}
  item={editing}
/>
```

---

## 🔄 Data Flow

### Read Flow (GET)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                              │
│ ┌─────────────┐   ┌─────────────────┐   ┌──────────────────┐   │
│ │  page.tsx   │──▶│ data-fetchers.ts│──▶│   repository     │   │
│ │  (Server)   │   │  fetchFor...()  │   │   .findAll()     │   │
│ └─────────────┘   └─────────────────┘   └──────────────────┘   │
│       │                                          │              │
│       ▼                                          ▼              │
│ ┌─────────────┐                          ┌──────────────────┐   │
│ │ initialData │◀─────────────────────────│   Prisma ORM     │   │
│ └─────────────┘                          └──────────────────┘   │
└───────│─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                              │
│ ┌─────────────────┐   ┌──────────────┐   ┌────────────────┐    │
│ │ ClientComponent │──▶│ useQuery()   │──▶│ API Routes     │    │
│ │ (with initial)  │   │ TanStack     │   │ GET /api/...   │    │
│ └─────────────────┘   └──────────────┘   └────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│ ┌─────────────────┐                                            │
│ │    Render UI    │                                            │
│ └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Write Flow (POST/PATCH/DELETE)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                              │
│ ┌───────────────┐   ┌───────────────┐   ┌─────────────────┐    │
│ │  User Action  │──▶│ useMutation() │──▶│  API Routes     │    │
│ │  (Form Submit)│   │ TanStack      │   │  POST/PATCH/... │    │
│ └───────────────┘   └───────────────┘   └─────────────────┘    │
│                              │                    │             │
│                              ▼                    │             │
│                     ┌───────────────┐             │             │
│                     │ invalidate()  │◀────────────┘             │
│                     │ queries       │                           │
│                     └───────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                              │
│ ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│ │  API Route      │──▶│    Service       │──▶│  Repository  │  │
│ │  withApiHandler │   │  businessService │   │  .create()   │  │
│ └─────────────────┘   └──────────────────┘   └──────────────┘  │
│                                                      │          │
│                                                      ▼          │
│                                              ┌──────────────┐   │
│                                              │  Prisma ORM  │   │
│                                              └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧭 Navigation System

### Configuration-Driven Navigation

```typescript
// src/config/navigation.config.ts
export const dashboardNavigation: NavSection[] = [
  {
    items: [
      { href: "/profile", labelKey: "nav.profile", icon: UserRound },
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { href: "/management", labelKey: "nav.management", icon: Boxes },
      { href: "/tracking", labelKey: "nav.tracking", icon: PackageSearch },
      { href: "/data", labelKey: "nav.data", icon: Database },
      { href: "/alerts", labelKey: "nav.alerts", icon: Bell, showBadge: true, badgeKey: "alerts" },
    ],
  },
];
```

### Dynamic Route Building

```typescript
// Sidebar builds full URLs based on current store
const fullHref = storeId ? `/store/${storeId}${item.href}` : item.href;
// Result: /store/cuid123/dashboard
```

### Badge System

```typescript
function useBadgeCount(badgeKey?: string): number | null {
  const alertsCount = badgeKey === "alerts" ? useAlertsCount() : 0;
  return badgeCounts[badgeKey] ?? null;
}
```

---

## ⚡ Performance Optimizations

### 1. Server-Side Data Fetching

- All pages fetch initial data on server
- Data passed as props to client components
- No loading state on initial render

### 2. Parallel Data Fetching

```typescript
const [a, b, c, d] = await Promise.all([
  fetchA(storeId),
  fetchB(storeId),
  fetchC(storeId),
  fetchD(storeId),
]);
```

### 3. Lazy Loading (Code Splitting)

```typescript
const MaterialsSection = dynamic(() => import("./materials-section"), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### 4. Prefetching on Hover

```typescript
const handleTabHover = async (tabName: string) => {
  await prefetchMaterials(queryClient, storeId);
};
```

### 5. Conditional Rendering

```typescript
// Only render active tab to reduce memory
{activeTab === "materials" && (
  <TabsContent value="materials">
    <MaterialsSection />
  </TabsContent>
)}
```

### 6. Optimized Queries

```sql
-- Raw SQL for alert filtering at DB level
SELECT id FROM "ingredients"
WHERE "storeId" = $1 AND "currentStock" <= "minStock"
LIMIT 100
```

---

## 🎨 UI/UX Features

### 1. Responsive Design

- Desktop: Sidebar + Main content
- Tablet: Topbar + Mobile menu + Main content
- Mobile: Topbar + Sheet menu + Full-width content

### 2. Global Search (⌘K)

- Search materials, products, recipes, suppliers
- Keyboard shortcut support
- Recent searches

### 3. Store Switcher

- Quick switch between stores
- Shows current store name
- Dropdown with all available stores

### 4. Language Switcher

- English (EN)
- French (FR)
- Indonesian (ID)

### 5. Skeleton Loading

- Pixel-perfect skeletons for each component
- Prevents layout shift during loading

### 6. Toast Notifications

- Success/error feedback for all actions
- Using Sonner library

### 7. Confirmation Dialogs

- Delete confirmations
- Destructive action warnings

### 8. Form Validation

- Zod schemas for all forms
- Real-time validation feedback
- react-hook-form integration

---

## 📊 Summary Statistics

| Metric                   | Count |
| ------------------------ | ----- |
| **Dashboard Pages**      | 7     |
| **Feature Modules**      | 8     |
| **Total Components**     | 150+  |
| **API Routes**           | 53    |
| **TanStack Query Hooks** | 20+   |
| **Dialog Components**    | 25+   |

---

## 🔗 Related Documentation

- `/docs/ARCHITECTURE.md` - System architecture
- `/docs/API_SPECIFICATION.md` - API documentation
- `/docs/MATERIALS_TO_PRODUCTION_FLOW.md` - Production workflow
- `/docs/STRIPE_SETUP_FINAL.md` - Payment setup

---

_Generated: 2025-12-22_
