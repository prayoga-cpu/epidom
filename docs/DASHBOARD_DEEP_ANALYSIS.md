# Analisis Mendalam Dashboard EPIDOM

## 📋 Daftar Isi
1. [Struktur Dashboard](#struktur-dashboard)
2. [Navigasi & Layout](#navigasi--layout)
3. [Halaman Dashboard](#halaman-dashboard)
4. [Halaman Management](#halaman-management)
5. [Halaman Alerts](#halaman-alerts)
6. [Halaman Tracking](#halaman-tracking)
7. [Halaman Data](#halaman-data)
8. [Halaman Profile](#halaman-profile)
9. [Button & Actions](#button--actions)
10. [Data Flow & State Management](#data-flow--state-management)

---

## 🏗️ Struktur Dashboard

### Layout Hierarchy
```
PageShell (Topbar + Sidebar + Content)
  ├── Topbar (Header dengan logo, search, store switcher, language, profile, logout)
  ├── Sidebar (Navigasi menu)
  └── Content Area (Halaman yang aktif)
```

### Route Structure
- `/store/[storeId]/dashboard` - Dashboard utama
- `/store/[storeId]/management` - Management (4 tabs)
- `/store/[storeId]/alerts` - Alerts & Orders
- `/store/[storeId]/tracking` - Stock tracking
- `/store/[storeId]/data` - Data management (4 tabs)
- `/store/[storeId]/profile` - User profile

---

## 🧭 Navigasi & Layout

### Topbar Components

#### 1. **Logo** (EPIDOM)
- **Location**: Kiri atas
- **Function**: Navigasi ke dashboard
- **Responsive**: Menyesuaikan ukuran di mobile/tablet

#### 2. **Global Search** (Desktop)
- **Button**: Search bar dengan placeholder "Search..."
- **Keyboard Shortcut**: ⌘K (Mac) / Ctrl+K (Windows)
- **Function**: Mencari materials, products, recipes, suppliers
- **Dialog**: `GlobalSearchDialog` - menampilkan hasil pencarian

#### 3. **Store Switcher**
- **Location**: Kanan atas (desktop), di sidebar (mobile)
- **Function**: Switch antar store (multi-store support)
- **Component**: `StoreSwitcher` - dropdown dengan daftar stores

#### 4. **Language Switcher**
- **Location**: Kanan atas
- **Options**: English (en), French (fr), Indonesian (id)
- **Component**: `LangSwitcher` - dropdown dengan flag icons

#### 5. **User Profile**
- **Location**: Kanan atas
- **Component**: `NavUser` - avatar + dropdown menu
- **Menu Items**:
  - View Profile
  - Settings
  - Logout

#### 6. **Logout Button**
- **Location**: Kanan atas
- **Function**: Sign out dan redirect ke `/login`
- **Icon**: LogOut (lucide-react)

#### 7. **Mobile Menu Button**
- **Location**: Kiri atas (mobile/tablet)
- **Function**: Toggle sidebar mobile
- **Component**: Sheet (shadcn/ui)

### Sidebar Navigation

#### Menu Items (dari `navigation.config.ts`):

1. **Profile** (`/profile`)
   - Icon: UserRound
   - Badge: Tidak ada

2. **Dashboard** (`/dashboard`)
   - Icon: LayoutDashboard
   - Badge: Tidak ada

3. **Management** (`/management`)
   - Icon: Boxes
   - Badge: Tidak ada
   - **Tabs**: Delivery, Recipe Production, Production History, Edit Stock

4. **Tracking** (`/tracking`)
   - Icon: PackageSearch
   - Badge: Tidak ada

5. **Data** (`/data`)
   - Icon: Database
   - Badge: Tidak ada
   - **Tabs**: Materials, Recipes, Products, Suppliers

6. **Alerts** (`/alerts`)
   - Icon: Bell
   - Badge: **Ya** - Menampilkan jumlah alerts aktif
   - **Badge Count**: Diambil dari `useAlertsCount()` hook

---

## 📊 Halaman Dashboard (`/dashboard`)

### Komponen Utama

#### 1. **Production History Chart**
- **Component**: `ProductionHistoryChart` (lazy loaded)
- **Location**: Kiri atas (4 kolom dari 7)
- **Function**:
  - Menampilkan grafik produksi historis
  - Chart dengan data production batches
  - Export functionality
- **Loading**: `ChartSkeleton`

#### 2. **Alerts Card**
- **Component**: `AlertsCard`
- **Location**: Kanan atas (3 kolom dari 7)
- **Function**:
  - Menampilkan 5 material dengan stock terendah
  - List dengan progress bar
  - Link ke halaman Alerts
- **Data**: `lowStockMaterials` (diproses dari materials)

#### 3. **Tracking Card**
- **Component**: `TrackingCard`
- **Location**: Kiri bawah (1 kolom dari 2)
- **Function**:
  - Menampilkan 5 material dengan stock level terendah
  - Progress bar per material
  - Link ke halaman Tracking
- **Data**: `stockLevels` (diproses dari materials)

#### 4. **Supplier Card**
- **Component**: `SupplierCard` (lazy loaded)
- **Location**: Kanan bawah (1 kolom dari 2)
- **Function**:
  - Menampilkan informasi supplier
  - List supplier dengan status
- **Loading**: `CardSkeleton`

### Data Processing
- **Materials Query**: Di-fetch sekali di parent (`DashboardView`)
- **Processing**: `useMemo` untuk menghitung:
  - `lowStockMaterials`: Filter `currentStock <= minStock`, sort by stock percentage
  - `stockLevels`: Sort by stock percentage
- **Optimization**: Data diproses sekali, digunakan oleh multiple child components

---

## 🛠️ Halaman Management (`/management`)

### Tab Structure (4 Tabs)

#### Tab 1: **Supplier Deliveries** (`delivery`)

**Components:**
- `SupplierDeliveriesTable` - Tabel daftar deliveries
- `SupplierDeliveryDetails` - Detail delivery yang dipilih

**Buttons & Actions:**

1. **Edit Delivery** (di tabel)
   - **Icon**: Edit
   - **Function**: Buka dialog edit delivery
   - **Dialog**: `AddEditDeliveryDialog` (mode: edit)

2. **Update Status** (di tabel & details)
   - **Icon**: Update
   - **Function**: Update status delivery (PENDING → IN_TRANSIT → RECEIVED)
   - **Dialog**: `UpdateDeliveryStatusDialog`

3. **Print Delivery** (di tabel & details)
   - **Icon**: Printer
   - **Function**: Print delivery note
   - **Dialog**: `PrintDeliveryDialog`

4. **Delete Delivery** (di tabel)
   - **Icon**: Trash
   - **Function**: Hapus delivery (TODO: belum diimplementasi)

5. **Select Delivery** (di tabel)
   - **Function**: Pilih delivery untuk melihat detail
   - **Action**: Update `selectedDelivery` state

**Data Flow:**
- Fetch supplier orders dengan status `PLACED` atau `RECEIVED`
- Convert `SupplierOrder` → `SupplierDelivery` format
- Display di tabel dengan detail panel

---

#### Tab 2: **Recipe Production** (`recipe`)

**Component**: `RecipeProductionCard`

**Layout:**
- **Left Column**: Recipe list dengan search
- **Right Column**: Recipe details + material availability + active batches

**Buttons & Actions:**

1. **Search Recipes** (input field)
   - **Function**: Filter recipes by name, description, category
   - **Icon**: Search

2. **Select Recipe** (di recipe list)
   - **Function**: Pilih recipe untuk melihat detail
   - **Action**: Update `selectedRecipe` state

3. **Start Production** (di recipe details)
   - **Icon**: PlayCircle
   - **Function**: Buka dialog start production
   - **Disabled**: Jika materials tidak cukup atau recipe tidak punya linked products
   - **Dialog**: `StartProductionDialog`
   - **Validation**:
     - Semua materials harus `available >= required`
     - Recipe harus punya linked products

**Components:**

1. **Recipe List**
   - Search input
   - List recipes dengan:
     - Name, description
     - Yield quantity & unit
     - Production time
     - Category badge

2. **Recipe Details Card**
   - Recipe name, description, category
   - Stats: Yield, Production Time, Cost Per Batch, Cost Per Unit
   - Start Production button

3. **Material Availability Check**
   - **Component**: `MaterialAvailabilityCheck`
   - **Function**: Tampilkan status availability per ingredient
   - **Status**:
     - ✅ Sufficient (green)
     - ⚠️ Low (yellow) - available >= 50% required
     - ❌ Insufficient (red) - available < 50% required

4. **Active Batches**
   - **Component**: `ProductionBatchCard`
   - **Function**: Tampilkan batches yang sedang IN_PROGRESS atau PLANNED
   - **Info**: Batch ID, status, scheduled date, quantity

**Data Flow:**
- Fetch recipes dari API
- Filter by search query
- Fetch active batches untuk selected recipe
- Calculate material availability dari recipe ingredients

---

#### Tab 3: **Production History** (`history`)

**Component**: `ProductionHistoryCard`

**Features:**
- Tabel production batches dengan filter
- Metrics cards (total batches, success rate, etc.)
- Batch details dialog
- Filter by status, date range, recipe

**Buttons & Actions:**

1. **View Batch Details**
   - **Function**: Buka dialog detail batch
   - **Dialog**: `BatchDetailsDialog`

2. **Filter Batches**
   - **Options**: Status, Date Range, Recipe
   - **Function**: Filter tabel batches

3. **Export History**
   - **Function**: Export production history ke CSV/Excel

**Components:**

1. **Production Metrics Cards**
   - **Component**: `ProductionMetricsCards`
   - **Metrics**:
     - Total Batches
     - Success Rate
     - Total Quantity Produced
     - Average Production Time

2. **Production History Table**
   - Columns: Batch ID, Recipe, Status, Quantity, Date, Actions
   - Sortable columns
   - Pagination

---

#### Tab 4: **Edit Stock** (`stock`)

**Component**: `EditStockCard`

**Layout:**
- **Left Column**: Stock items list dengan search
- **Right Column**: Item details + quick actions

**Buttons & Actions:**

1. **Search Items** (input field)
   - **Function**: Filter items by name atau SKU
   - **Icon**: Search

2. **Import CSV** (header)
   - **Icon**: Upload
   - **Function**: Import stock adjustment dari CSV
   - **Dialog**: `CSVImportDialog`
   - **Access**: Advanced Reports only (subscription check)

3. **Export Stock** (header)
   - **Icon**: Download
   - **Function**: Export stock inventory ke CSV/Excel
   - **Access**: Advanced Reports only

4. **Select All / Deselect All** (di item list)
   - **Function**: Toggle select semua items untuk bulk adjustment

5. **Select Item** (di item list)
   - **Function**: Pilih item untuk melihat detail dan adjust

6. **Adjust Stock** (di item details)
   - **Icon**: Edit3
   - **Function**: Buka dialog stock adjustment
   - **Dialog**: `StockAdjustmentDialog`
   - **Fields**:
     - Adjustment Type: IN / OUT
     - Quantity
     - Reason (required)
     - Notes (optional)
     - Reference ID (optional)

7. **View History** (di item details)
   - **Icon**: History
   - **Function**: Buka dialog adjustment history
   - **Dialog**: `AdjustmentHistoryDialog`
   - **Data**: Stock movements untuk item tersebut

8. **Bulk Adjustment** (jika items selected)
   - **Function**: Adjust multiple items sekaligus
   - **Dialog**: `BulkAdjustmentDialog`
   - **Access**: Advanced Reports only

**Stock Status Badges:**
- 🟢 **In Stock**: `currentStock > minStock && currentStock <= maxStock`
- 🟡 **Low Stock**: `currentStock <= minStock`
- 🔴 **Overstock**: `currentStock > maxStock`

**Item Details Display:**
- Current Stock (dengan unit)
- Stock Value (currentStock × costPerUnit)
- Min Stock
- Max Stock
- Stock percentage bar

**Data Flow:**
- Fetch materials dari API
- Combine materials + products (TODO: products belum diimplementasi)
- Filter by search query
- Calculate stock status per item
- Stock adjustment → API → Update cache → UI refresh

---

## 🔔 Halaman Alerts (`/alerts`)

### View Toggle

**Toggle Button**: "Orders to Place" / "Back to Alerts"
- **Function**: Switch antara Alerts view dan Orders view
- **State**: URL query param `?view=orders`

### Tab 1: **Alerts View** (default)

**Component**: `AlertsTable`

**Function**: Menampilkan alerts untuk materials dengan stock rendah

**Buttons & Actions:**

1. **Create Order** (di alert row)
   - **Icon**: ShoppingCart
   - **Function**: Buka dialog place order
   - **Dialog**: `PlaceOrderDialog`
   - **Data**: Alert details (material, supplier, quantity needed)

2. **View Details** (di alert row)
   - **Function**: Tampilkan detail alert (deprecated, sekarang inline)

**Table Columns:**
- Material Name
- Current Stock
- Min Stock
- Supplier
- Status
- Actions

**Data Flow:**
- Fetch alerts dari API (`useAlerts` hook)
- Filter alerts dengan status aktif
- Display di tabel dengan actions

---

### Tab 2: **Orders to Place** (`?view=orders`)

**Component**: `OrdersView`

**Function**: Menampilkan supplier orders dengan status PENDING

**Buttons & Actions:**

1. **Mark as Placed** (di order row)
   - **Icon**: CheckCircle
   - **Function**: Update order status dari PENDING → PLACED
   - **API**: `PATCH /api/stores/[id]/supplier-orders/[orderId]`
   - **Cache Invalidation**:
     - `supplierOrderKeys`
     - `alertKeys`
     - `materialKeys`
     - `stockMovementKeys`

2. **View Order Details** (di order row)
   - **Function**: Tampilkan detail order (inline atau dialog)

3. **Bulk Order** (header)
   - **Icon**: ShoppingCart
   - **Function**: Create multiple orders sekaligus
   - **Dialog**: `BulkOrderDialog`

**Table Columns:**
- Order Number
- Supplier
- Items Count
- Total Amount
- Order Date
- Status
- Actions

**Data Flow:**
- Fetch supplier orders dengan status PENDING
- Display di tabel
- Mark as placed → Update status → Invalidate cache → UI refresh

---

## 📦 Halaman Tracking (`/tracking`)

**Component**: `TrackingView`

### Tab: **Stock Levels**

**Component**: `StockLevelsTab`

**Function**: Menampilkan stock levels untuk semua materials

**Features:**
- List materials dengan stock level
- Progress bar per material
- Filter by stock status (Low, In Stock, Overstock)
- Sort by stock percentage

**Data Flow:**
- Fetch materials dari API
- Calculate stock percentage
- Filter & sort
- Display dengan progress bars

---

## 💾 Halaman Data (`/data`)

### Tab Structure (4 Tabs)

#### Tab 1: **Materials** (`materials`)

**Component**: `MaterialsSection`

**Buttons & Actions:**

1. **Export Materials** (header)
   - **Icon**: Download
   - **Function**: Export materials ke CSV/Excel
   - **Access**: Advanced Reports only

2. **Add Material** (header)
   - **Icon**: Plus
   - **Function**: Buka dialog add material
   - **Dialog**: `AddMaterialDialog`
   - **Fields**:
     - Name, SKU, Unit
     - Current Stock, Min Stock, Max Stock
     - Unit Cost
     - Supplier (optional)

3. **Bulk Select** (header)
   - **Icon**: CheckSquare
   - **Function**: Toggle bulk select mode
   - **Action**: Enable checkbox di setiap row

4. **Delete Selected** (header, jika bulk mode aktif)
   - **Icon**: Trash2
   - **Function**: Hapus materials yang dipilih
   - **Confirmation**: Dialog konfirmasi

5. **Edit Material** (di row)
   - **Icon**: Edit
   - **Function**: Buka dialog edit material
   - **Dialog**: `EditMaterialDialog`

6. **View Details** (di row)
   - **Function**: Buka dialog material details
   - **Dialog**: `MaterialDetailsDialog`

**Table Features:**
- Search by name/SKU
- Filter by stock status
- Sort by columns
- Pagination
- Bulk selection

---

#### Tab 2: **Recipes** (`recipes`)

**Component**: `RecipesSection`

**Buttons & Actions:**

1. **Export Recipes** (header)
   - **Icon**: Download
   - **Function**: Export recipes ke CSV/Excel

2. **Add Recipe** (header)
   - **Icon**: Plus
   - **Function**: Buka dialog add recipe
   - **Dialog**: `AddRecipeDialog`
   - **Multi-step Form**:
     - Step 1: Basic info (name, description, category)
     - Step 2: Ingredients (add materials dengan quantity)
     - Step 3: Products (link products ke recipe)
     - Step 4: Production details (yield, time, cost)

3. **Duplicate Recipe** (di row)
   - **Icon**: Copy
   - **Function**: Duplicate recipe dengan semua ingredients
   - **Dialog**: `DuplicateRecipeDialog`

4. **Edit Recipe** (di row)
   - **Icon**: Edit
   - **Function**: Buka dialog edit recipe
   - **Dialog**: `EditRecipeDialog`

5. **View Details** (di row)
   - **Function**: Buka dialog recipe details
   - **Dialog**: `RecipeDetailsDialog`

**Table Features:**
- Search by name/description/category
- Filter by category
- Sort by columns
- Pagination

---

#### Tab 3: **Products** (`products`)

**Component**: `ProductsSection`

**Buttons & Actions:**

1. **Export Products** (header)
   - **Icon**: Download
   - **Function**: Export products ke CSV/Excel

2. **Add Product** (header)
   - **Icon**: Plus
   - **Function**: Buka dialog add product
   - **Dialog**: `AddProductDialog`
   - **Fields**:
     - Name, SKU, Description
     - Recipe (link ke recipe)
     - Selling Price
     - Unit

3. **Edit Product** (di row)
   - **Icon**: Edit
   - **Function**: Buka dialog edit product
   - **Dialog**: `EditProductDialog`

4. **View Details** (di row)
   - **Function**: Buka dialog product details
   - **Dialog**: `ProductDetailsDialog`

5. **View Usage** (di row)
   - **Icon**: BarChart
   - **Function**: Tampilkan product usage statistics
   - **Dialog**: Product usage chart

**Table Features:**
- Search by name/SKU
- Filter by stock status
- Filter by recipe
- Sort by columns
- Pagination

---

#### Tab 4: **Suppliers** (`suppliers`)

**Component**: `SuppliersSection`

**Buttons & Actions:**

1. **Export Suppliers** (header)
   - **Icon**: Download
   - **Function**: Export suppliers ke CSV/Excel

2. **Add Supplier** (header)
   - **Icon**: Plus
   - **Function**: Buka dialog add supplier
   - **Dialog**: `AddSupplierDialog`
   - **Fields**:
     - Name, Contact Person
     - Email, Phone
     - Address, City, Country
     - Notes
     - Is Active

3. **Edit Supplier** (di row)
   - **Icon**: Edit
   - **Function**: Buka dialog edit supplier
   - **Dialog**: `EditSupplierDialog`

4. **View Details** (di row)
   - **Function**: Buka dialog supplier details
   - **Dialog**: `SupplierDetailsDialog`

**Table Features:**
- Search by name/email/phone
- Filter by active status
- Sort by columns
- Pagination

---

## 👤 Halaman Profile (`/profile`)

**Component**: `ProfileView`

### Sections:

#### 1. **Profile Header**
- Avatar
- User name, email
- Edit avatar button

#### 2. **Personal Info Card**
- **Component**: `PersonalInfoCard`
- **Fields**: Name, Email, Phone, Locale, Timezone, Currency
- **Button**: Edit Personal Info
- **Dialog**: `EditPersonalInfoDialog`

#### 3. **Business Info Card**
- **Component**: `BusinessInfoCard`
- **Fields**: Business Name, Address, City, Country, Tax ID
- **Button**: Edit Business Info
- **Dialog**: `EditBusinessInfoDialog`

#### 4. **Subscription Info Card**
- **Component**: `SubscriptionInfoCard`
- **Display**: Plan name, status, renewal date
- **Button**: Manage Subscription (link ke billing)

#### 5. **Stripe Connect Card**
- **Component**: `StripeConnectCard`
- **Function**: Connect Stripe account untuk receive payments
- **Button**: Connect Stripe / View Dashboard

#### 6. **Activity Log Card**
- **Component**: `ActivityLogCard`
- **Function**: Tampilkan recent activities

---

## 🔘 Button & Actions Summary

### Global Actions (Topbar)
- 🔍 **Search**: Global search (⌘K)
- 🏪 **Store Switcher**: Switch store
- 🌐 **Language Switcher**: Change language
- 👤 **Profile Menu**: View profile, settings, logout
- 🚪 **Logout**: Sign out

### Dashboard Actions
- 📊 **View Chart**: Production history chart
- 🔔 **View Alerts**: Link ke alerts page
- 📦 **View Tracking**: Link ke tracking page

### Management Actions
- ✏️ **Edit Delivery**: Edit supplier delivery
- 📝 **Update Status**: Update delivery status
- 🖨️ **Print Delivery**: Print delivery note
- 🗑️ **Delete Delivery**: Delete delivery (TODO)
- ▶️ **Start Production**: Start recipe production
- 📊 **View Batch Details**: View production batch details
- 📥 **Import CSV**: Import stock adjustments
- 📤 **Export Stock**: Export stock inventory
- ✏️ **Adjust Stock**: Adjust single item stock
- 📜 **View History**: View adjustment history
- 📦 **Bulk Adjustment**: Adjust multiple items

### Alerts Actions
- 🛒 **Create Order**: Create order from alert
- ✅ **Mark as Placed**: Mark order as placed
- 📦 **Bulk Order**: Create multiple orders

### Data Actions
- ➕ **Add**: Add new item (material/recipe/product/supplier)
- ✏️ **Edit**: Edit existing item
- 👁️ **View Details**: View item details
- 📤 **Export**: Export data to CSV/Excel
- 🗑️ **Delete**: Delete item(s)
- 📋 **Bulk Select**: Enable bulk selection
- 📋 **Duplicate**: Duplicate recipe

### Profile Actions
- ✏️ **Edit Personal Info**: Edit user info
- ✏️ **Edit Business Info**: Edit business info
- 🖼️ **Edit Avatar**: Change profile picture
- 💳 **Manage Subscription**: Manage subscription
- 🔗 **Connect Stripe**: Connect Stripe account

---

## 🔄 Data Flow & State Management

### Data Fetching Strategy

1. **TanStack Query (React Query)**
   - Semua data fetching menggunakan TanStack Query
   - Query keys terorganisir per feature:
     - `materialKeys`
     - `productKeys`
     - `recipeKeys`
     - `supplierOrderKeys`
     - `alertKeys`
     - `stockMovementKeys`

2. **Cache Invalidation**
   - Setelah mutation (create/update/delete), cache di-invalidate
   - Multiple query keys di-invalidate untuk consistency
   - Example: Stock adjustment invalidates:
     - `materialKeys`
     - `stockMovementKeys`
     - `alertKeys`

3. **Optimistic Updates**
   - Beberapa mutations menggunakan optimistic updates
   - UI update immediately, rollback jika error

### State Management Pattern

1. **Local State** (`useState`)
   - UI state (dialog open/close, selected items)
   - Form state (search queries, filters)

2. **Server State** (TanStack Query)
   - Data dari API
   - Caching & synchronization

3. **URL State** (`useSearchParams`)
   - View toggle (alerts vs orders)
   - Filters & pagination (future)

4. **Context Providers**
   - `I18nProvider`: Language & translations
   - `CurrencyProvider`: Currency formatting
   - `SessionProvider`: Authentication

### Performance Optimizations

1. **Lazy Loading**
   - Heavy components di-lazy load:
     - `ProductionHistoryChart`
     - `SupplierCard`
     - Tab contents di Data page

2. **Code Splitting**
   - Setiap tab menjadi chunk terpisah
   - Mengurangi initial bundle size

3. **Memoization**
   - `useMemo` untuk expensive calculations
   - `useCallback` untuk event handlers

4. **Conditional Rendering**
   - Hanya render tab yang aktif
   - Mencegah mounting semua komponen sekaligus

---

## 📝 Notes & TODOs

### Known Limitations
1. Products belum fully integrated di Edit Stock
2. Delete Delivery belum diimplementasi
3. Beberapa features memerlukan Advanced Reports subscription
4. Email verification belum diimplementasi
5. Password reset flow belum fully implemented

### Future Enhancements
1. Real-time updates dengan WebSocket
2. Advanced filtering & sorting
3. Bulk operations untuk semua sections
4. Export dengan custom formats
5. Activity log tracking
6. Notifications system

---

## 🎯 Key Features Summary

✅ **Multi-store Support**: Switch antar stores
✅ **Multi-language**: English, French, Indonesian
✅ **Stock Management**: Adjust, track, history
✅ **Production Management**: Recipe-based production
✅ **Supplier Orders**: Order placement & tracking
✅ **Alerts System**: Low stock alerts
✅ **Data Management**: CRUD untuk materials, recipes, products, suppliers
✅ **Export/Import**: CSV import/export
✅ **Responsive Design**: Mobile, tablet, desktop
✅ **Performance Optimized**: Lazy loading, code splitting, memoization

---

**Last Updated**: 2025-01-17
**Version**: 1.0.0

