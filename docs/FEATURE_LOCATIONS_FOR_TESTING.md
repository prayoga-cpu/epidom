# Lokasi Fitur untuk Testing - Supplier Management & Advanced Reports

## 📍 Lokasi Fitur di Aplikasi

### 1. **Supplier Management**

#### Frontend Location:
- **Route**: `/store/[storeId]/data` → Tab **"Suppliers"**
- **Full Path**: Setelah login → Pilih Store → Klik menu **"Data"** di sidebar → Klik tab **"Suppliers"**
- **Component**: `src/features/dashboard/data/suppliers/components/suppliers-section.tsx`

#### Fitur yang Tersedia:
- ✅ View suppliers list
- ✅ Add new supplier
- ✅ Edit supplier
- ✅ Delete supplier
- ✅ Export suppliers (CSV/Excel)
- ✅ Bulk delete suppliers
- ✅ Search & filter suppliers

#### API Endpoints:
- `GET /api/stores/[id]/suppliers` - Get all suppliers
- `POST /api/stores/[id]/suppliers` - Create supplier
- `GET /api/stores/[id]/suppliers/[supplierId]` - Get supplier details
- `PATCH /api/stores/[id]/suppliers/[supplierId]` - Update supplier
- `DELETE /api/stores/[id]/suppliers/[supplierId]` - Delete supplier
- `POST /api/stores/[id]/suppliers/export` - Export suppliers
- `POST /api/stores/[id]/suppliers/bulk` - Bulk operations

#### Cara Testing:
1. Login dengan user yang punya subscription STARTER
2. Pilih store
3. Klik menu **"Data"** di sidebar
4. Klik tab **"Suppliers"**
5. **Expected (setelah gating)**: Harus muncul pesan "Upgrade to Pro to access Supplier Management"
6. Coba klik tombol "Add Supplier"
7. **Expected**: Harus muncul error atau dialog upgrade

---

### 2. **Advanced Reports**

#### Frontend Locations:

##### A. Production History Chart (Dashboard)
- **Route**: `/store/[storeId]/dashboard`
- **Component**: `src/features/dashboard/dashboard/production-history/production-history-chart.tsx`
- **Fitur**: Export button untuk production history chart
- **Location**: Di dashboard page, card "Production History" dengan tombol export di kanan atas

##### B. Export Functionality (Various)
- **Suppliers Export**: `/store/[storeId]/data` → Tab Suppliers → Tombol "Export"
- **Materials Export**: `/store/[storeId]/data` → Tab Materials → Tombol "Export"
- **Products Export**: `/store/[storeId]/data` → Tab Products → Tombol "Export"

#### Fitur yang Tersedia:
- ✅ Export production history chart (CSV/Excel/PDF)
- ✅ Export suppliers data
- ✅ Export materials data
- ✅ Export products data
- ✅ Advanced filtering untuk reports
- ✅ Date range filtering

#### API Endpoints:
- `POST /api/stores/[id]/suppliers/export` - Export suppliers
- `POST /api/stores/[id]/materials/export` - Export materials
- (Export functionality biasanya di-handle di frontend)

#### Cara Testing:
1. Login dengan user yang punya subscription STARTER
2. Pilih store
3. **Test 1 - Production Chart Export**:
   - Klik menu **"Dashboard"** di sidebar
   - Scroll ke card **"Production History"**
   - Cari tombol **"Export"** di kanan atas card
   - **Expected (setelah gating)**: Tombol export disabled atau muncul upgrade prompt
4. **Test 2 - Data Export**:
   - Klik menu **"Data"** di sidebar
   - Klik tab **"Suppliers"** (atau Materials/Products)
   - Cari tombol **"Export"** atau **"Download"**
   - **Expected (setelah gating)**: Tombol export disabled atau muncul upgrade prompt

---

## 🎯 Testing Scenarios

### Scenario 1: STARTER Plan User
1. Login dengan account STARTER
2. Coba akses Supplier Management
   - **Expected**: Blocked dengan upgrade prompt
3. Coba export data
   - **Expected**: Blocked dengan upgrade prompt
4. Coba export production chart
   - **Expected**: Blocked dengan upgrade prompt

### Scenario 2: PRO Plan User
1. Login dengan account PRO
2. Akses Supplier Management
   - **Expected**: ✅ Full access
3. Export data
   - **Expected**: ✅ Full access
4. Export production chart
   - **Expected**: ✅ Full access

### Scenario 3: ENTERPRISE Plan User
1. Login dengan account ENTERPRISE
2. Akses semua fitur
   - **Expected**: ✅ Full access (sama seperti PRO)

---

## 📝 Notes

- **Supplier Management** = Fitur lengkap untuk manage suppliers (CRUD + Export)
- **Advanced Reports** = Export functionality untuk berbagai data (chart, suppliers, materials, products)
- Setelah implementasi gating, STARTER plan akan di-block dari fitur-fitur ini
- PRO dan ENTERPRISE akan punya full access

