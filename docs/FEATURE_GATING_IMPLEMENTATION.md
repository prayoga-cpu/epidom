# Feature Gating Implementation - Supplier Management & Advanced Reports

## ✅ Implementasi Selesai

Sistem gating untuk **Supplier Management** dan **Advanced Reports** sudah diimplementasikan berdasarkan subscription plan.

---

## 📋 Perubahan yang Dibuat

### 1. **Configuration** (`src/config/stripe.config.ts`)

- ✅ Menambahkan `features` object di setiap plan:
  - **STARTER**: `supplierManagement: false`, `advancedReports: false`
  - **PRO**: `supplierManagement: true`, `advancedReports: true`
  - **ENTERPRISE**: `supplierManagement: true`, `advancedReports: true`

- ✅ Menambahkan helper functions:
  - `hasSupplierManagementAccess(plan)` - Check access untuk supplier management
  - `hasAdvancedReportsAccess(plan)` - Check access untuk advanced reports

### 2. **Subscription Service** (`src/lib/services/subscription.service.ts`)

- ✅ Menambahkan method:
  - `hasSupplierManagementAccess(userId)` - Check apakah user punya akses
  - `hasAdvancedReportsAccess(userId)` - Check apakah user punya akses

### 3. **API Routes - Backend Gating**

#### Supplier Management APIs:
- ✅ `POST /api/stores/[id]/suppliers` - Create supplier (gated)
- ✅ `PATCH /api/stores/[id]/suppliers/[supplierId]` - Update supplier (gated)
- ✅ `DELETE /api/stores/[id]/suppliers/[supplierId]` - Delete supplier (gated)
- ✅ `GET /api/stores/[id]/suppliers/export` - Export suppliers (gated untuk advanced reports)

**Response jika tidak punya akses:**
```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_FEATURE_LOCKED",
    "message": "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
    "details": {
      "feature": "supplierManagement",
      "upgradeRequired": true
    }
  }
}
```

### 4. **Error Code** (`src/types/api/responses.ts`)

- ✅ Menambahkan `SUBSCRIPTION_FEATURE_LOCKED` ke `ApiErrorCode` enum

### 5. **Frontend Components**

#### A. Hook untuk Feature Access (`src/features/dashboard/shared/hooks/use-feature-access.ts`)
- ✅ Hook baru untuk check feature access di frontend
- ✅ Returns: `supplierManagementAccess`, `advancedReportsAccess`, `isLoading`, `plan`, `isActive`

#### B. SuppliersSection (`src/features/dashboard/data/suppliers/components/suppliers-section.tsx`)
- ✅ Menampilkan upgrade prompt jika user tidak punya akses
- ✅ Disable export button jika tidak punya akses advanced reports
- ✅ Upgrade prompt dengan Alert component dan button ke `/pricing`

#### C. Production History Chart (`src/features/dashboard/dashboard/production-history/production-history-chart.tsx`)
- ✅ Disable export button jika tidak punya akses advanced reports
- ✅ Tooltip message jika disabled

---

## 🎯 Behavior per Plan

### STARTER Plan
- ❌ **Supplier Management**: Blocked - muncul upgrade prompt
- ❌ **Advanced Reports**: Blocked - export buttons disabled
- ✅ **Basic Features**: Store (1), Products (500), Materials, Recipes

### PRO Plan
- ✅ **Supplier Management**: Full access
- ✅ **Advanced Reports**: Full access (export enabled)
- ✅ **All Features**: Unlimited stores, unlimited products

### ENTERPRISE Plan
- ✅ **Supplier Management**: Full access
- ✅ **Advanced Reports**: Full access (export enabled)
- ✅ **All Features**: Unlimited stores, unlimited products

---

## 🧪 Testing Guide

### Test Case 1: STARTER Plan - Supplier Management
1. Login dengan account STARTER
2. Navigate ke `/store/[storeId]/data` → Tab "Suppliers"
3. **Expected**:
   - Muncul Alert dengan pesan "Supplier Management Locked"
   - Button "Upgrade to Pro" yang redirect ke `/pricing`
   - Tidak bisa akses supplier list/CRUD

### Test Case 2: STARTER Plan - Advanced Reports
1. Login dengan account STARTER
2. Navigate ke `/store/[storeId]/dashboard`
3. Scroll ke "Production History" card
4. **Expected**:
   - Export button disabled
   - Tooltip muncul saat hover: "Advanced Reports is only available in Pro and Enterprise plans"

### Test Case 3: STARTER Plan - Export Suppliers
1. Login dengan account STARTER
2. Navigate ke `/store/[storeId]/data` → Tab "Suppliers"
3. **Expected**:
   - Export button disabled (karena tidak punya akses supplier management)

### Test Case 4: PRO Plan - Full Access
1. Login dengan account PRO
2. Test semua fitur:
   - ✅ Bisa akses Supplier Management
   - ✅ Bisa export data
   - ✅ Bisa export production chart
3. **Expected**: Semua fitur accessible

### Test Case 5: API Direct Call (STARTER)
1. Login dengan account STARTER
2. Call API `POST /api/stores/[id]/suppliers` dengan valid data
3. **Expected**:
   - Status: 403
   - Error code: `SUBSCRIPTION_FEATURE_LOCKED`
   - Message: "Supplier Management is only available in Pro and Enterprise plans..."

---

## 📍 Lokasi Fitur untuk Testing

Lihat dokumentasi lengkap di: `docs/FEATURE_LOCATIONS_FOR_TESTING.md`

### Quick Reference:
- **Supplier Management**: `/store/[storeId]/data` → Tab "Suppliers"
- **Advanced Reports**:
  - Production Chart Export: `/store/[storeId]/dashboard` → Production History card
  - Data Export: `/store/[storeId]/data` → Tab Suppliers/Materials/Products → Export button

---

## 🔧 Files Modified

1. `src/config/stripe.config.ts` - Feature flags per plan
2. `src/lib/services/subscription.service.ts` - Feature access methods
3. `src/types/api/responses.ts` - Error code
4. `src/app/api/stores/[id]/suppliers/route.ts` - POST gating
5. `src/app/api/stores/[id]/suppliers/[supplierId]/route.ts` - PATCH/DELETE gating
6. `src/app/api/stores/[id]/suppliers/export/route.ts` - Export gating
7. `src/features/dashboard/shared/hooks/use-feature-access.ts` - New hook
8. `src/features/dashboard/data/suppliers/components/suppliers-section.tsx` - Frontend gating
9. `src/features/dashboard/dashboard/production-history/production-history-chart.tsx` - Export gating

---

## ✅ Summary

Sistem gating sudah lengkap:
- ✅ Backend validation di API routes
- ✅ Frontend UI blocking dengan upgrade prompts
- ✅ Consistent error handling
- ✅ User-friendly upgrade prompts
- ✅ Proper feature flags configuration

**STARTER plan users** akan melihat upgrade prompts dan tidak bisa akses fitur-fitur premium.
**PRO dan ENTERPRISE plan users** punya full access ke semua fitur.

