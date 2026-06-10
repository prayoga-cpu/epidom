# Laporan Audit Kesehatan Kode: EPIDOM

> **Auditor**: Principal Software Engineer & Adversarial Code Health Auditor
> **Target Repository**: `d:\Projects\epidom`
> **Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma ORM v6.17, Better Auth, Stripe, TanStack Query v5
> **Domain Bisnis**: Platform SaaS ERP multi-tenant untuk bisnis makanan (restoran/manufaktur)
> **Tanggal Audit**: 20 Mei 2026
> **Versi Dokumen**: 1.0

---

## Daftar Isi

1. [Ringkasan Eksekutif](#ringkasan-eksekutif)
2. [Metodologi Audit](#metodologi-audit)
3. [Step 1: Pemetaan Struktural & Dependensi](#step-1-pemetaan-struktural--dependensi)
4. [Step 2: Arsitektur & Best Practices](#step-2-arsitektur--best-practices)
5. [Step 3: Konsistensi Pola](#step-3-konsistensi-pola)
6. [Step 4: Anti-Patterns & Code Smells](#step-4-anti-patterns--code-smells)
7. [Matriks Prioritas](#matriks-prioritas)
8. [Rencana Aksi Remediasi](#rencana-aksi-remediasi)
9. [Lampiran: Referensi File](#lampiran-referensi-file)

---

## Ringkasan Eksekutif

### Skor Keseluruhan

| Dimensi | Skor | Keterangan |
|---------|------|------------|
| Arsitektur | 7.5 / 10 | Fondasi solid (Repository-Service-Controller), tapi ada bypass |
| Type Safety | 5.5 / 10 | Banyak `as any` dan `as unknown as` yang melemahkan TypeScript |
| Keamanan | 6.0 / 10 | Auth baik, tapi ada SQL injection vector dan signature fallback |
| Konsistensi | 6.0 / 10 | Pattern ada tapi tidak diterapkan merata |
| Testability | 4.0 / 10 | Hanya 4/13 service ditest, coverage sangat rendah |
| DRY | 5.5 / 10 | Duplikasi enum, types, dan utility functions |
| **Rata-rata** | **5.8 / 10** | **Perlu perbaikan signifikan** |

### Distribusi Temuan

| Prioritas | Jumlah | Keterangan |
|-----------|--------|------------|
| **P0 (Kritis)** | 3 | Harus diperbaiki segera, risiko keamanan/arsitektur |
| **P1 (Major)** | 7 | Menghambat maintainability dan skalabilitas |
| **P2 (Minor)** | 8 | Inconsistensi dan code smell |
| **P3 (Saran)** | 5 | Optimisasi dan best practice |
| **Total** | **23** | |

### Kekuatan Codebase

Sebelum membahas temuan negatif, berikut aspek-aspek yang sudah **baik**:

1. **Feature-Driven Architecture** - Organisasi folder `src/features/` dengan pemisahan yang jelas
2. **Repository Pattern** - Abstraksi database melalui `BaseRepository` dan repository spesifik
3. **Custom Error Hierarchy** - `AppError` dengan subclass spesifik (`NotFoundError`, `StoreLimitExceededError`, dll)
4. **API Handler HOF** - `withApiHandler` yang menangani auth, rate limiting, dan error handling secara terpusat
5. **Structured Logger** - Logger dengan request ID tracking dan format JSON untuk production
6. **Zod Validation Schemas** - Validasi input terstruktur di `src/lib/validation/`
7. **Prisma Transaction Safety** - Penggunaan transaction dengan timeout dan isolation level yang tepat
8. **Centralized Config** - Konfigurasi terpusat di `src/config/`

---

## Metodologi Audit

Audit dilakukan dalam 4 pass berurutan:

1. **Pass 1 - Structural Mapping**: Pemetaan direktori, identifikasi God objects, analisis dependensi
2. **Pass 2 - Architecture Evaluation**: Evaluasi SOLID, DRY, KISS, design patterns
3. **Pass 3 - Pattern Consistency**: Konvensi penamaan, error handling, state management
4. **Pass 4 - Anti-Pattern Scan**: Code smells, hardcoded values, unchecked promises, type safety

**Tools yang digunakan**: Manual code review, grep pattern matching, file size analysis

---

## Step 1: Pemetaan Struktural & Dependensi

### 1.1 Peta Arsitektur Aplikasi

```
src/
  app/                          # Next.js App Router (3 route groups)
    (app)/                      # Protected routes
      (auth)/                   # Login/Register
      (stores)/                 # Store selection
      (dashboard)/              # Main application
    (marketing)/                # Public pages (Landing, Pricing)
    api/                        # 13 API route groups
      ai/, analytics/, auth/, billing/, connect/,
      exchange-rates/, health/, session/, stores/,
      subscriptions/, upload/, user/, webhooks/
  components/                   # Shared UI (7 sub-dirs, Shadcn/UI)
  features/                     # Feature-Driven Architecture (8 features)
    auth/, checkout/, dashboard/, loading/,
    marketing/, mvp/, onboarding/, stores/
  hooks/                        # 5 global hooks
  lib/                          # Core logic (14 sub-dirs, 15 files)
    services/     (13 files)    # Business logic layer
    repositories/ (11 files)    # Data access layer
    validation/   (8 files)     # Zod schemas
    errors/       (1 file)      # Error hierarchy
    utils/        (25 files)    # Utilities
    server/, storage/, ai/, monitoring/, middleware/, config/, hooks/
  types/                        # Type definitions (7 files)
  locales/                      # i18n (en, fr, id)
  config/                       # 7 config files
```

### 1.2 Aliran Dependensi

```
               ┌─────────────────┐
               │   App Router    │
               │  (pages/api)    │
               └────────┬────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   ┌────────────┐ ┌──────────┐ ┌────────────┐
   │  Features  │ │  Server  │ │ API Routes │
   │ (hooks,    │ │ Actions  │ │ (withApi   │
   │  components)│ │          │ │  Handler)  │
   └─────┬──────┘ └────┬─────┘ └─────┬──────┘
         │              │             │
         ▼              ▼             ▼
   ┌────────────────────────────────────────┐
   │          Service Layer                 │
   │  (business logic, validation)          │
   └───────────────────┬────────────────────┘
                       │
   ┌───────────────────▼────────────────────┐
   │         Repository Layer               │
   │  (data access, BaseRepository)         │
   └───────────────────┬────────────────────┘
                       │
   ┌───────────────────▼────────────────────┐
   │          Prisma ORM                    │
   │  (PostgreSQL)                          │
   └────────────────────────────────────────┘
```

**Temuan**: Aliran dependensi secara umum **unidirectional** dan bersih. Tidak ditemukan dependensi sirkular. Namun ada **bypass** di beberapa tempat (lihat P0-2 dan P1-2).

### 1.3 Analisis God Objects

File-file terbesar yang perlu diperhatikan:

| # | File | Ukuran | Baris | Status |
|---|------|--------|-------|--------|
| 1 | `src/features/dashboard/data/actions.ts` | 33 KB | 944 | **GOD OBJECT** |
| 2 | `src/lib/services/production-batch.service.ts` | 22 KB | 644 | Borderline |
| 3 | `src/lib/services/material.service.ts` | 19 KB | 590 | Borderline |
| 4 | `prisma/schema.prisma` | 19 KB | 588 | Wajar (single schema) |
| 5 | `src/lib/services/subscription.service.ts` | 16 KB | 485 | Acceptable |
| 6 | `src/lib/services/business.service.ts` | 16 KB | 504 | Acceptable |
| 7 | `src/types/entities.ts` | 14 KB | 641 | **Perlu dipisah** |
| 8 | `src/lib/repositories/recipe.repository.ts` | 16 KB | ~400 | Acceptable |
| 9 | `src/lib/utils/cache-helpers.ts` | 14 KB | ~350 | Acceptable |
| 10 | `src/lib/utils/formatting.ts` | 12 KB | ~300 | Acceptable |

**Catatan**: File locale (`en.ts` = 121KB, `fr.ts` = 137KB, `id.ts` = 125KB) sengaja tidak dihitung karena merupakan file data.

---

## Step 2: Arsitektur & Best Practices

### Temuan P0 (Kritis)

---

### P0-1: Vektor SQL Injection via `$executeRawUnsafe` di BaseRepository

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/repositories/base.repository.ts` |
| **Baris** | 42-51 |
| **Kategori** | Keamanan |
| **Dampak** | Semua 11 repository mewarisi method ini |

**Deskripsi**:

`BaseRepository` mengekspos dua method yang memanggil `$executeRawUnsafe` dan `$queryRawUnsafe` dari Prisma. Method ini menerima string query mentah dan meneruskannya tanpa parameterisasi yang dijamin. Meskipun parameter array diteruskan, pemanggil bisa saja membangun query string secara manual tanpa menggunakan parameterized placeholder.

**Kode Bermasalah**:

```typescript
// src/lib/repositories/base.repository.ts, Baris 42-51
async executeRaw(query: string, params?: unknown[]): Promise<unknown> {
  return this.db.$executeRawUnsafe(query, ...(params ?? []));
}

async queryRaw<T = unknown>(query: string, params?: unknown[]): Promise<T> {
  return this.db.$queryRawUnsafe(query, ...(params ?? [])) as Promise<T>;
}
```

**Mengapa ini Kritis**: Setiap subclass repository (`MaterialRepository`, `ProductRepository`, dll) mewarisi akses penuh ke method ini. Satu kesalahan penggunaan di masa depan bisa membuka celah SQL injection.

**Solusi yang Direkomendasikan**:

```typescript
import { Prisma } from '@prisma/client';

/**
 * Execute parameterized raw SQL query
 * Uses Prisma's tagged template for automatic parameterization
 *
 * @example
 * await this.executeRaw(Prisma.sql`UPDATE "users" SET "name" = ${name} WHERE "id" = ${id}`);
 */
async executeRaw(query: Prisma.Sql): Promise<number> {
  return this.db.$executeRaw(query);
}

/**
 * Query parameterized raw SQL and return results
 * Uses Prisma's tagged template for automatic parameterization
 *
 * @example
 * const users = await this.queryRaw<User[]>(Prisma.sql`SELECT * FROM "users" WHERE "id" = ${id}`);
 */
async queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> {
  return this.db.$queryRaw<T>(query);
}
```

Perubahan ini memaksa pemanggil untuk menggunakan tagged template literal Prisma, yang secara otomatis melakukan parameterisasi dan mencegah SQL injection.

---

### P0-2: God Object `actions.ts` Melewati Service/Repository Layer

| Atribut | Detail |
|---------|--------|
| **File** | `src/features/dashboard/data/actions.ts` |
| **Baris** | 1-944 (seluruh file) |
| **Kategori** | Arsitektur, Keamanan |
| **Dampak** | Business rules terlewati, data tidak tervalidasi |

**Deskripsi**:

File `actions.ts` adalah Server Action monolitik (944 baris) yang menangani import untuk 4 jenis entitas (material, product, supplier, recipe) **plus** multi-entity import. File ini melakukan query Prisma **langsung**, sepenuhnya melewati service dan repository layer yang didokumentasikan sebagai arsitektur standar.

**Bukti Layer Bypassing**:

```typescript
// Baris 120-126 - Prisma langsung di Server Action (seharusnya via service)
const store = await prisma.store.findFirst({
  where: {
    id: storeId,
    business: { userId: session.user.id },
  },
  select: { id: true },
});

// Baris 250 - Create supplier langsung tanpa melalui SupplierService
const created = await prisma.supplier.create({
  data: {
    name: newName.trim(),
    storeId,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  select: { id: true }
});

// Baris 288-307 - Create material langsung tanpa MaterialService
await prisma.material.create({
  data: {
    storeId: item.storeId,
    sku: item.sku || `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: String(item.name).trim(),
    // ... 15+ fields langsung
  },
});
```

**Dampak Konkret**:
1. Business rules di `MaterialService.createMaterial()` (validasi SKU unik, stock movement tracking) **dilewati**
2. Business rules di `SupplierService` **dilewati**
3. Subscription limits dan product limits **tidak dicek**
4. Logika `parseGlobalNumber()` diduplikasi dari `number-parser.ts` (58 baris vs 184 baris yang lebih robust)
5. Tidak bisa ditest secara unit karena akses DB langsung

**Solusi yang Direkomendasikan**:

Buat `ImportService` baru di service layer:

```
src/lib/services/
  import.service.ts           # BARU - logika import
  import.service.test.ts      # BARU - unit test
```

```typescript
// src/lib/services/import.service.ts
import { parseNumber } from '@/lib/utils/number-parser';
import { materialService } from './material.service';
import { productService } from './product.service';
import { supplierService } from './supplier.service';
import { recipeService } from './recipe.service';

export class ImportService {
  async importMaterials(storeId: string, data: Record<string, unknown>[]): Promise<ImportResult> {
    // Delegasi ke MaterialService yang sudah memiliki validasi
    for (const item of data) {
      await materialService.createMaterial({
        storeId,
        sku: item.sku || generateSku('MAT'),
        name: String(item.name).trim(),
        unitCost: parseNumber(item.unitCost, { defaultValue: 0 }),
        // ...
      });
    }
  }
  // ... importProducts, importSuppliers, importRecipes
}

// src/features/dashboard/data/actions.ts - menjadi thin wrapper
"use server";
import { importService } from '@/lib/services/import.service';

export async function bulkImportData(input: BulkImportInput): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };
  
  // Semua logika ada di ImportService
  return importService.bulkImport(input.storeId, input.type, input.data);
}
```

---

### P0-3: Error Handling Terfragmentasi - Dual System yang Inkonsisten

| Atribut | Detail |
|---------|--------|
| **File** | Tersebar di 38+ file di `src/lib/services/` |
| **Kategori** | Konsistensi, Maintainability |
| **Dampak** | Error mapping brittle, sulit di-debug |

**Deskripsi**:

Codebase memiliki error hierarchy yang **bagus** di `src/lib/errors/index.ts`:

```
AppError (base)
  ├── UnauthorizedError (401)
  ├── ForbiddenError (403)
  ├── NotFoundError (404)
  │   ├── BusinessNotFoundError (404)
  │   └── StoreNotFoundError (404)
  ├── ConflictError (409)
  ├── DuplicateError (409)
  ├── ValidationError (400)
  ├── StoreLimitExceededError (403)
  ├── ProductLimitExceededError (403)
  ├── InsufficientStockError (400)
  ├── SubscriptionRequiredError (403)
  ├── SubscriptionInactiveError (403)
  ├── DatabaseError (503)
  ├── DatabaseTimeoutError (503)
  └── RateLimitExceededError (429)
```

Namun **mayoritas service masih menggunakan `throw new Error("...")`** secara raw. Ini menyebabkan `handleApiError()` di `api-error-handler.ts` harus melakukan **string pattern-matching** yang brittle:

```typescript
// src/lib/utils/api-error-handler.ts, Baris 83-163
// Pattern matching yang brittle - rawan false positive/negative
if (error instanceof Error) {
  const message = error.message.toLowerCase();
  
  if (message.includes("not found") || message.includes("does not exist")) {
    // Setiap error dengan kata "not found" diubah jadi 404
    return NextResponse.json(..., { status: 404 });
  }
  
  if (message.includes("already exists") || message.includes("duplicate")) {
    return NextResponse.json(..., { status: 409 });
  }
  
  if (message.includes("unauthorized") || message.includes("does not belong")) {
    return NextResponse.json(..., { status: 403 });
  }
  // ... 5 pattern lagi
}
```

**Bukti Kuantitatif**:

| Service File | `throw new Error()` | Typed Error | Rasio |
|-------------|---------------------|-------------|-------|
| `business.service.ts` | 8 | 4 | 33% typed |
| `material.service.ts` | 9 | 0 | 0% typed |
| `production-batch.service.ts` | 12 | 0 | 0% typed |
| `subscription.service.ts` | 4 | 0 | 0% typed |
| `product.service.ts` | ~6 | 0 | 0% typed |
| `recipe.service.ts` | ~6 | 0 | 0% typed |
| `supplier.service.ts` | ~4 | 0 | 0% typed |
| **Total** | **~49** | **4** | **~8% typed** |

**Risiko Konkret dari Pattern-Matching**:

1. Error message "Material not found in this store" akan tertangkap oleh `"not found"` dan menghasilkan 404, padahal seharusnya 403 (forbidden)
2. Error message "Stock cannot be negative" mengandung kata "stock" dan akan tertangkap oleh `"insufficient"` check, menghasilkan response yang salah
3. Jika developer mengubah error message, HTTP status code berubah tanpa disadari

**Solusi yang Direkomendasikan**:

Migrasi bertahap dari `throw new Error()` ke typed errors. Contoh untuk `material.service.ts`:

```typescript
// SEBELUM
async getMaterialById(materialId: string): Promise<MaterialWithSuppliers> {
  const material = await this.materialRepo.findById(materialId);
  if (!material) {
    throw new Error("Material not found");  // Generic
  }
  return material;
}

async createMaterial(input: CreateMaterialInput): Promise<MaterialWithSuppliers> {
  const skuExists = await this.materialRepo.existsBySku(storeId, sku);
  if (skuExists) {
    throw new Error("A material with this SKU already exists in your store");  // Generic
  }
  // ...
}

// SESUDAH
import { NotFoundError, DuplicateError, ForbiddenError } from '@/lib/errors';

async getMaterialById(materialId: string): Promise<MaterialWithSuppliers> {
  const material = await this.materialRepo.findById(materialId);
  if (!material) {
    throw new NotFoundError("Material", materialId);  // -> 404, auto-mapped
  }
  return material;
}

async createMaterial(input: CreateMaterialInput): Promise<MaterialWithSuppliers> {
  const skuExists = await this.materialRepo.existsBySku(storeId, sku);
  if (skuExists) {
    throw new DuplicateError("Material", "SKU", sku);  // -> 409, auto-mapped
  }
  // ...
}
```

---

### Temuan P1 (Major)

---

### P1-1: Penyalahgunaan `as any` Secara Masif di Serialization Layer

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/server/serialize.ts` |
| **Baris** | Hampir setiap baris konversi (45+ kali) |
| **Kategori** | Type Safety |

**Deskripsi**:

File `serialize.ts` bertanggung jawab mengkonversi Prisma `Decimal` ke `number` agar bisa di-serialize ke Client Components. Namun implementasinya menghancurkan type safety dengan `as any` pada **setiap field**:

```typescript
// SAAT INI - 45+ penggunaan `as any`
export function serializeMaterial(material: MaterialWithSuppliers): MaterialWithSuppliers {
  return {
    ...material,
    unitCost: decimalToNumber(material.unitCost) as any,       // as any
    currentStock: decimalToNumber(material.currentStock) as any, // as any
    minStock: decimalToNumber(material.minStock) as any,         // as any
    maxStock: decimalToNumber(material.maxStock) as any,         // as any
    materialSuppliers: material.materialSuppliers.map((ms) => ({
      ...ms,
      price: decimalToNumber(ms.price) as any,                   // as any
    })),
  };
}
```

Return type-nya masih `MaterialWithSuppliers` (yang berisi `Decimal`) padahal runtime value-nya sudah `number`. Ini berarti TypeScript tidak bisa mendeteksi bug saat seseorang memanggil `.toFixed()` pada field yang seharusnya sudah jadi `number`.

**Solusi yang Direkomendasikan**:

Buat generic utility type `SerializeDecimal<T>`:

```typescript
// src/types/serialized.ts
import type { Decimal } from '@prisma/client/runtime/library';

/** Recursively replaces Prisma Decimal fields with number */
type SerializeDecimal<T> = {
  [K in keyof T]: T[K] extends Decimal
    ? number
    : T[K] extends Decimal | null
      ? number | null
      : T[K] extends Array<infer U>
        ? Array<SerializeDecimal<U>>
        : T[K] extends object | null
          ? SerializeDecimal<NonNullable<T[K]>> | Extract<T[K], null>
          : T[K];
};

// Tipe-tipe serialized yang aman
export type SerializedMaterial = SerializeDecimal<MaterialWithSuppliers>;
export type SerializedProduct = SerializeDecimal<ProductWithRelations>;
export type SerializedProductionBatch = SerializeDecimal<ProductionBatchWithRelations>;

// Penggunaan di serialize.ts - TANPA `as any`
export function serializeMaterial(material: MaterialWithSuppliers): SerializedMaterial {
  return {
    ...material,
    unitCost: decimalToNumber(material.unitCost),
    currentStock: decimalToNumber(material.currentStock),
    // TypeScript sekarang tahu return type-nya number, bukan Decimal
  };
}
```

---

### P1-2: Service Layer Mengakses Prisma Langsung (Bypassing Repository)

| Atribut | Detail |
|---------|--------|
| **File** | Beberapa service files |
| **Kategori** | Arsitektur - Repository Pattern Violation |

**Deskripsi**:

Arsitektur yang didokumentasikan: `API Route -> Service -> Repository -> Database`. Namun beberapa service mengakses `prisma` langsung:

| File | Baris | Akses Langsung | Seharusnya |
|------|-------|----------------|------------|
| `production-batch.service.ts` | 140 | `prisma.recipeProduct.findFirst(...)` | `recipeRepository.isProductLinked()` |
| `material.service.ts` | 418 | `prisma.supplier.findUnique(...)` | `supplierRepository.findById()` |
| `exchange-rate.service.ts` | 123 | `prisma.exchangeRate.findUnique(...)` | `exchangeRateRepository.findByPair()` |
| `exchange-rate.service.ts` | 182 | `prisma.exchangeRate.deleteMany(...)` | `exchangeRateRepository.deleteExpired()` |

**Solusi**: Tambahkan method ke repository yang sesuai:

```typescript
// src/lib/repositories/recipe.repository.ts
async isProductLinked(productId: string, recipeId: string): Promise<boolean> {
  const link = await this.db.recipeProduct.findFirst({
    where: { productId, recipeId },
  });
  return !!link;
}

// Penggunaan di production-batch.service.ts:
const isLinked = await this.recipeRepo.isProductLinked(data.productId, data.recipeId);
```

---

### P1-3: Enum Divergen antara Prisma Schema dan Frontend Types

| Atribut | Detail |
|---------|--------|
| **File** | `src/types/entities.ts` vs `prisma/schema.prisma` |
| **Kategori** | DRY, Runtime Safety |

**Deskripsi**:

Enum didefinisikan di dua tempat berbeda dengan **nilai yang berbeda**:

| Enum | Prisma Schema (Source of Truth) | `entities.ts` (Frontend) | Masalah |
|------|-------------------------------|-------------------------|---------|
| `MovementType` | `PURCHASE, PRODUCTION_IN, PRODUCTION_OUT, SALE, ADJUSTMENT, WASTE` | `IN, OUT, ADJUSTMENT, PRODUCTION, WASTE, RETURN` | **Nilai total berbeda** |
| `OrderStatus` | `PENDING, CONFIRMED, IN_PRODUCTION, READY, DELIVERED, CANCELLED` | `pending, processing, in_stock, delivered, cancelled` | **Nilai & casing berbeda** |
| `AlertType` | `LOW_STOCK, CRITICAL_STOCK, ORDER_DUE, PRODUCTION_DUE, SYSTEM` | `low_stock, expiry_warning, quality_issue, supplier_delay, overstock` | **Nilai total berbeda** |
| `ProductionStatus` | `PLANNED, IN_PROGRESS, COMPLETED, CANCELLED` | `PLANNED, IN_PROGRESS, COMPLETED, CANCELLED` | Sama (kebetulan) |

**Dampak**: Jika frontend mengirim `MovementType.IN` ke backend yang mengharapkan `MovementType.PURCHASE`, Prisma akan menolak karena value bukan anggota enum. Bug ini bisa **diam-diam** menyebabkan data loss.

**Solusi**:

```typescript
// src/types/entities.ts
// HAPUS definisi enum lokal:
// export enum MovementType { ... }      <- HAPUS
// export enum OrderStatus { ... }       <- HAPUS
// export enum AlertType { ... }         <- HAPUS
// export enum ProductionStatus { ... }  <- HAPUS

// GANTI dengan re-export dari Prisma:
export {
  MovementType,
  OrderStatus,
  ProductionStatus,
  AlertType,
  AlertSeverity,
  SubscriptionPlan,
  SubscriptionStatus,
  SupplierOrderStatus,
} from '@prisma/client';
```

---

### P1-4: `console.log` Debug Statements di Kode Produksi

| Atribut | Detail |
|---------|--------|
| **File** | 7+ file |
| **Kategori** | Kebersihan Kode |

**Deskripsi**:

Ditemukan 17+ penggunaan `console.log` di production code yang bukan melalui structured `logger`:

| File | Baris | Statement | Masalah |
|------|-------|-----------|---------|
| `features/dashboard/data/actions.ts` | 446 | `console.log("[importSuppliers] Raw data received:", ...)` | Bisa log data sensitif |
| `features/dashboard/data/actions.ts` | 474 | `console.log("[importSuppliers] Cleaned supplier:", ...)` | Debug logging |
| `features/dashboard/data/actions.ts` | 885 | `console.log("[Smart Import] Entity grouping:", ...)` | Debug logging |
| `features/dashboard/data/import/smart-import-dialog.tsx` | 139 | `console.log("[SmartImport] Sending data to backend:", ...)` | Client-side debug |
| `lib/services/email.service.ts` | 52-55 | 4x `console.log(...)` (email, URL) | **Bisa log data sensitif** |
| `lib/prisma.ts` | 72 | `console.log(query)` | Query logging |
| `lib/web-vitals.ts` | 54 | `console.log(...)` | Performance logging |

**Solusi**:

```typescript
// SEBELUM
console.log("[importSuppliers] Raw data received:", JSON.stringify(data, null, 2));

// SESUDAH
import { logger } from '@/lib/logger';
logger.debug("[importSuppliers] Raw data received", { recordCount: data.length });
```

Untuk `email.service.ts`, pastikan hanya log di development:

```typescript
// SEBELUM - bisa log email di production
console.log("To:", email);
console.log("URL:", verificationUrl);

// SESUDAH - sudah ada guard tapi gunakan logger
if (process.env.NODE_ENV === 'development') {
  logger.debug("Verification email sent", { to: email, urlPreview: verificationUrl.slice(0, 50) });
}
```

---

### P1-5: Duplikasi Fungsi `parseGlobalNumber` vs `parseNumber`

| Atribut | Detail |
|---------|--------|
| **File** | `src/features/dashboard/data/actions.ts` (baris 31-88) vs `src/lib/utils/number-parser.ts` |
| **Kategori** | DRY |

**Deskripsi**:

File `actions.ts` mendefinisikan `parseGlobalNumber()` (58 baris) yang secara fungsional **identik** dengan `parseNumber()` di `number-parser.ts` (184 baris). Versi di `number-parser.ts` lebih lengkap: mendukung persentase, negatif dalam kurung, opsi konfigurasi.

**Perbandingan**:

| Fitur | `parseGlobalNumber` (actions.ts) | `parseNumber` (number-parser.ts) |
|-------|--------------------------------|--------------------------------|
| European format (1.000,50) | Ya | Ya |
| US format (1,000.50) | Ya | Ya |
| Currency removal | Partial (`[^0-9.,-]`) | Full (Rp, $, IDR, dll) |
| Negative in parentheses | Tidak | Ya |
| Percentage handling | Tidak | Ya |
| Configurable defaults | Tidak (hardcoded 0) | Ya |
| Type-safe input | `any` | `string \| number \| null \| undefined` |

**Solusi**: Hapus `parseGlobalNumber`, ganti dengan `parseNumber`:

```typescript
// Hapus function parseGlobalNumber (58 baris)

// Import dari utility
import { parseNumber } from '@/lib/utils/number-parser';

// Ganti penggunaan:
// SEBELUM: parseGlobalNumber(item.unitCost) || 0
// SESUDAH: parseNumber(item.unitCost, { defaultValue: 0 })
```

---

### P1-6: Input Type Interface Didefinisikan di 3 Tempat Berbeda

| Atribut | Detail |
|---------|--------|
| **File** | `material.service.ts`, `entities.ts`, `inventory.schemas.ts` |
| **Kategori** | DRY |

**Deskripsi**:

Input types untuk Material (sebagai contoh) didefinisikan di **3 tempat** yang tidak sinkron:

1. **`material.service.ts`** (baris 24-57): Local interfaces `CreateMaterialInput` dan `UpdateMaterialInput`
2. **`entities.ts`** (baris 404-421): `CreateMaterialDto` dan `UpdateMaterialDto`
3. **`inventory.schemas.ts`**: Zod schemas yang menghasilkan tipe berbeda lagi

Jika ada field baru ditambahkan, developer harus update **3 tempat** atau menghadapi runtime error.

**Solusi**: Single source of truth menggunakan Zod + `z.infer`:

```typescript
// src/lib/validation/inventory.schemas.ts - SATU-SATUNYA definisi
export const createMaterialSchema = z.object({
  storeId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  // ...
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

// material.service.ts - IMPORT saja
import type { CreateMaterialInput } from '@/lib/validation/inventory.schemas';
```

---

### P1-7: Repository Barrel Export Tidak Lengkap

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/repositories/index.ts` |
| **Baris** | 14-18 |
| **Kategori** | Konsistensi |

**Deskripsi**:

Barrel export hanya mengekspor **5 dari 11 repository**:

```typescript
// src/lib/repositories/index.ts - SAAT INI
export * from "./base.repository";
export * from "./user.repository";
export * from "./business.repository";
export * from "./store.repository";
export * from "./subscription.repository";
// HILANG: material, product, production-batch, recipe, supplier
```

Yang hilang:
- `material.repository.ts`
- `product.repository.ts`
- `production-batch.repository.ts`
- `recipe.repository.ts`
- `supplier.repository.ts`

**Solusi**:

```typescript
// src/lib/repositories/index.ts - LENGKAP
export * from "./base.repository";
export * from "./user.repository";
export * from "./business.repository";
export * from "./store.repository";
export * from "./subscription.repository";
export * from "./material.repository";
export * from "./product.repository";
export * from "./production-batch.repository";
export * from "./recipe.repository";
export * from "./supplier.repository";
```

---

## Step 3: Konsistensi Pola

### Temuan P2 (Minor)

---

### P2-1: Transaction Timeout Magic Numbers

| Atribut | Detail |
|---------|--------|
| **File** | Beberapa service files |
| **Kategori** | Konsistensi, Magic Numbers |

**Deskripsi**:

Transaction timeout dikonfigurasi secara ad-hoc:

| Service | maxWait | timeout | Konteks |
|---------|---------|---------|---------|
| `business.service.ts` | 5000 | 10000 | Store CRUD |
| `material.service.ts` | 5000 | 10000 | Material CRUD |
| `production-batch.service.ts` | 10000 | 20000 | Production (kompleks) |

**Solusi**:

```typescript
// src/config/db.config.ts (BARU atau di src/lib/utils/db-config.ts yang sudah ada)
export const TRANSACTION_TIMEOUTS = {
  /** Simple CRUD: single-table insert/update */
  SIMPLE: { maxWait: 5000, timeout: 10000 },
  /** Complex: multi-table with stock movements */
  COMPLEX: { maxWait: 10000, timeout: 20000 },
} as const;

// Penggunaan:
import { TRANSACTION_TIMEOUTS } from '@/config/db.config';

return prisma.$transaction(async (tx) => { ... }, TRANSACTION_TIMEOUTS.COMPLEX);
```

---

### P2-2: Import Path Inkonsisten (Alias vs Relative)

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/production-batch.service.ts` |
| **Baris** | 6-11 |
| **Kategori** | Konsistensi |

**Deskripsi**:

Mayoritas file menggunakan alias `@/` untuk imports, tetapi `production-batch.service.ts` menggunakan relative paths:

```typescript
// production-batch.service.ts - INKONSISTEN
import { productionBatchRepository } from "../repositories/production-batch.repository";
import { recipeRepository } from "../repositories/recipe.repository";
import { prisma } from "../prisma";

// business.service.ts - KONSISTEN (alias)
import { businessRepository } from "@/lib/repositories/business.repository";
import { prisma } from "@/lib/prisma";
```

**Solusi**: Ganti semua relative import ke alias `@/`.

---

### P2-3: Dead Code - Blok `if` Kosong

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/business.service.ts` |
| **Baris** | 355-356 |
| **Kategori** | Code Smell |

**Kode Bermasalah**:

```typescript
if (totalRelatedRecords > 0) {
  // Blok ini KOSONG - tidak ada logging atau warning
}
```

**Solusi**:

```typescript
if (totalRelatedRecords > 0) {
  logger.warn(`Cascade deleting store with ${totalRelatedRecords} related records`, {
    storeId,
    counts: store._count,
  });
}
```

---

### P2-4: Silent Error Swallowing

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/business.service.ts` |
| **Baris** | 371-373 |
| **Kategori** | Error Handling |

**Kode Bermasalah**:

```typescript
try {
  const storage = getStorageAdapter();
  await storage.delete(store.image);
} catch (error) {
  // Continue even if image deletion fails - DIAM TOTAL
}
```

**Solusi**:

```typescript
} catch (error) {
  logger.warn("Failed to delete store image from blob storage", {
    storeId,
    imageUrl: store.image,
    error: error instanceof Error ? error.message : String(error),
  });
}
```

---

### P2-5: Unsafe `as any` di `upsertBusiness` dengan TODO

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/business.service.ts` |
| **Baris** | 122 |
| **Kategori** | Type Safety |

**Kode Bermasalah**:

```typescript
/**
 * TODO: Create proper type guard or overload repository method
 */
return this.businessRepo.upsert(userId, input as any);
```

**Solusi**: Implementasi logika eksplisit:

```typescript
async upsertBusiness(userId: string, input: CreateBusinessInput | UpdateBusinessInput) {
  const existing = await this.businessRepo.findByUserId(userId);
  if (existing) {
    return this.businessRepo.update(existing.id, input as UpdateBusinessInput);
  }
  return this.businessRepo.create({ userId, ...(input as CreateBusinessInput) });
}
```

---

### P2-6: DI Pattern Inkonsisten di `ProductionBatchService`

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/production-batch.service.ts` |
| **Baris** | 19 |
| **Kategori** | Konsistensi, Testability |

**Deskripsi**:

Service lain menggunakan constructor injection:

```typescript
// BusinessService, MaterialService, SubscriptionService - POLA BENAR
export class BusinessService {
  constructor(
    private readonly businessRepo: BusinessRepository = businessRepository,
    private readonly storeRepo: StoreRepository = storeRepository
  ) {}
}
```

`ProductionBatchService` mengakses singleton langsung tanpa injection:

```typescript
// ProductionBatchService - TANPA DI
export class ProductionBatchService {
  async getProductionBatches(...) {
    return productionBatchRepository.findAll(...); // singleton langsung
  }
}
```

**Solusi**: Tambahkan constructor DI yang konsisten.

---

### P2-7: `exchange-rate.service.ts` Menggunakan Free Functions, Bukan Class

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/exchange-rate.service.ts` |
| **Kategori** | Konsistensi |

**Deskripsi**: Semua 12 service lain menggunakan class pattern (`export class XService { ... }`). `exchange-rate.service.ts` menggunakan exported free functions (`export async function getExchangeRate(...)`).

**Solusi**: Refactor ke class pattern yang konsisten.

---

### P2-8: Test Coverage Sangat Rendah

| Atribut | Detail |
|---------|--------|
| **File** | `src/lib/services/__tests__/` |
| **Kategori** | Quality Assurance |

**Status Test per Service**:

| Service | Punya Test? | Kritis? |
|---------|-------------|---------|
| `material.service.ts` | Ya | - |
| `product.service.ts` | Ya | - |
| `recipe.service.ts` | Ya | - |
| `subscription.service.ts` | Ya | - |
| `business.service.ts` | **Tidak** | Ya (store management) |
| `production-batch.service.ts` | **Tidak** | Ya (stock deduction) |
| `auth.service.ts` | **Tidak** | Ya (authentication) |
| `stripe-connect.service.ts` | **Tidak** | Ya (payment) |
| `email.service.ts` | **Tidak** | Minor |
| `exchange-rate.service.ts` | **Tidak** | Minor |
| `supplier.service.ts` | **Tidak** | Minor |
| `user.service.ts` | **Tidak** | Minor |

**Rekomendasi**: Prioritaskan test untuk `business.service.ts` dan `production-batch.service.ts` karena mengandung logika finansial dan stock.

---

## Step 4: Anti-Patterns & Code Smells

### Temuan P3 (Saran)

---

### P3-1: `entities.ts` (641 baris) Perlu Dipisah

**File**: `src/types/entities.ts`

File ini menggabungkan: enums (14), entity interfaces (15), DTOs (20+), filter types (7), response types (5).

**Saran**: Pisahkan menjadi:
```
src/types/
  enums.ts          # Re-export dari @prisma/client
  entities/
    material.ts     # Material, MaterialSupplier
    product.ts      # Product
    recipe.ts       # Recipe, RecipeIngredient
    order.ts        # Order, OrderItem
    ...
  dto/              # Request/Response DTOs (sudah ada, pindahkan)
  api/              # API response types (sudah ada)
```

---

### P3-2: Locale Files Monolitik (~125KB per file)

**File**: `src/locales/en.ts` (121KB), `fr.ts` (137KB), `id.ts` (125KB)

**Saran**: File locale monolitik akan dimuat seluruhnya di initial bundle. Pertimbangkan code-splitting per feature/route:

```
src/locales/
  en/
    common.ts
    dashboard.ts
    marketing.ts
    auth.ts
  id/
    common.ts
    dashboard.ts
    ...
```

---

### P3-3: Auth Signature Fallback Melemahkan Keamanan

**File**: `src/lib/auth.ts`, Baris 99-107

```typescript
// Jika verifikasi signature GAGAL, token tetap digunakan
if (!sessionToken) {
  const parts = sessionTokenCookie.split(".");
  if (parts.length >= 1 && parts[0]) {
    sessionToken = parts[0]; // TOKEN TANPA VERIFIKASI
  }
}
```

**Saran**: Fallback ini memungkinkan session token yang signature-nya gagal diverifikasi tetap dianggap valid (selama ada di database). Ini melemahkan tujuan signature verification. Pertimbangkan:
1. Log sebagai security warning di semua environment
2. Set deadline untuk menghapus fallback ini
3. Atau minimal tambahkan rate limiting untuk fallback path

---

### P3-4: `ApiContext.params` bertipe `any`

**File**: `src/lib/api-handler.ts`, Baris 22

```typescript
export type ApiContext = {
  params: any; // Kehilangan type safety
  session: NonNullable<Session>;
  userId: string;
  storeId?: string;
};
```

**Saran**: Gunakan generic untuk type safety:

```typescript
export type ApiContext<TParams = Record<string, string>> = {
  params: TParams;
  session: NonNullable<Session>;
  userId: string;
  storeId?: string;
};
```

---

### P3-5: File Junk di Root Repository

File berikut tidak seharusnya ada di root repository dan sebaiknya di-`.gitignore` atau dihapus:

| File | Tipe | Aksi |
|------|------|------|
| `mixed_data_test.csv` | Test data | Pindah ke `src/test/fixtures/` atau hapus |
| `sample_products.csv` | Sample data | Pindah ke `src/test/fixtures/` atau hapus |
| `test_bahan_baku_messy.csv` | Test data | Pindah ke `src/test/fixtures/` atau hapus |
| `conflicts.txt` | Git merge artifact | Hapus |
| `extract.js` | One-off script | Pindah ke `scripts/` atau hapus |
| `resolve.js` | One-off script | Pindah ke `scripts/` atau hapus |

---

## Matriks Prioritas

### Peta Prioritas (Dampak vs Usaha)

```
                        DAMPAK TINGGI
                             |
           ┌─────────────────┼──────────────────┐
           │   KERJAKAN      │                   │
           │   PERTAMA       │   PERENCANAAN     │
           │                 │                   │
           │  P0-1 SQL Inj.  │  P0-2 God Object  │
           │  P1-3 Enum Div. │  P0-3 Error Cons. │
           │  P1-7 Barrel    │  P1-1 as any      │
           │  P1-5 DRY Parse │  P1-6 Triple Def  │
           │                 │  P1-2 Layer Bypass │
  USAHA ───┼─────────────────┼──────────────────┼─── USAHA
  RENDAH   │                 │                   │   TINGGI
           │  QUICK WINS     │   PERTIMBANGKAN   │
           │                 │                   │
           │  P1-4 console   │  P2-8 Test Cover  │
           │  P2-2 Imports   │  P3-1 Split types │
           │  P2-3 Dead code │  P3-2 Locale split│
           │  P2-4 Silent err│  P2-6 DI Consist  │
           │  P2-5 as any    │  P2-7 Free funcs  │
           │  P3-5 Junk files│  P3-3 Auth fallbk │
           │  P2-1 Timeouts  │  P3-4 ApiContext  │
           │                 │                   │
           └─────────────────┼──────────────────┘
                             |
                        DAMPAK RENDAH
```

---

## Rencana Aksi Remediasi

### Sprint 1: Quick Wins & Keamanan (1 minggu)

| # | Item | Usaha | File |
|---|------|-------|------|
| 1 | **P0-1**: Ganti `$executeRawUnsafe` ke `Prisma.Sql` | 30 menit | `base.repository.ts` |
| 2 | **P1-3**: Re-export enum dari `@prisma/client` | 1 jam | `entities.ts` |
| 3 | **P1-4**: Ganti `console.log` dengan `logger` | 1 jam | 7 files |
| 4 | **P1-7**: Lengkapi barrel export | 10 menit | `repositories/index.ts` |
| 5 | **P1-5**: Hapus `parseGlobalNumber`, gunakan `parseNumber` | 1 jam | `actions.ts` |
| 6 | **P2-3**: Tambahkan logging di dead code block | 10 menit | `business.service.ts` |
| 7 | **P2-4**: Log error di silent catch | 10 menit | `business.service.ts` |
| 8 | **P3-5**: Pindahkan/hapus junk files | 15 menit | Root directory |

### Sprint 2: Konsistensi Error Handling (2 minggu)

| # | Item | Usaha | File |
|---|------|-------|------|
| 1 | **P0-3**: Migrasi `business.service.ts` ke typed errors | 2 jam | `business.service.ts` |
| 2 | **P0-3**: Migrasi `material.service.ts` ke typed errors | 2 jam | `material.service.ts` |
| 3 | **P0-3**: Migrasi `production-batch.service.ts` ke typed errors | 3 jam | `production-batch.service.ts` |
| 4 | **P0-3**: Migrasi remaining services | 4 jam | 4 files |
| 5 | **P1-2**: Pindahkan direct Prisma ke repository | 2 jam | 3 files |
| 6 | **P1-6**: Konsolidasi input types ke Zod `z.infer` | 3 jam | 3 files |
| 7 | **P2-5**: Fix `as any` di `upsertBusiness` | 30 menit | `business.service.ts` |
| 8 | **P2-2**: Standardisasi import paths | 30 menit | `production-batch.service.ts` |

### Sprint 3: Refactor Besar (2 minggu)

| # | Item | Usaha | File |
|---|------|-------|------|
| 1 | **P0-2**: Ekstrak `actions.ts` menjadi `ImportService` | 1 hari | Baru + refactor |
| 2 | **P1-1**: Buat `SerializeDecimal<T>`, hapus `as any` di serialize | 1 hari | `serialize.ts`, `types/` |
| 3 | **P2-6**: DI konsisten di `ProductionBatchService` | 1 jam | `production-batch.service.ts` |
| 4 | **P2-7**: Refactor `exchange-rate.service.ts` ke class | 1 jam | `exchange-rate.service.ts` |
| 5 | **P2-1**: Centralize transaction timeouts | 30 menit | Config + services |

### Ongoing

| # | Item | Frekuensi |
|---|------|-----------|
| 1 | **P2-8**: Unit test untuk untested services | Per sprint |
| 2 | **P3-1**: Pisah `entities.ts` saat ada perubahan | Opportunistic |
| 3 | **P3-3**: Evaluasi dan hapus auth fallback | Sebelum production |
| 4 | **P3-2**: Code-split locale files | Saat performance issue |
| 5 | **P3-4**: Generic `ApiContext<T>` | Saat refactor API layer |

---

## Lampiran: Referensi File

### File-File Kunci yang Diaudit

| File | Path | Peran |
|------|------|-------|
| Base Repository | `src/lib/repositories/base.repository.ts` | Abstraksi database |
| Business Service | `src/lib/services/business.service.ts` | Logika bisnis/store |
| Material Service | `src/lib/services/material.service.ts` | Manajemen bahan baku |
| Production Batch Service | `src/lib/services/production-batch.service.ts` | Produksi & stock |
| Subscription Service | `src/lib/services/subscription.service.ts` | Stripe subscriptions |
| API Handler | `src/lib/api-handler.ts` | HOF untuk API routes |
| API Error Handler | `src/lib/utils/api-error-handler.ts` | Error-to-HTTP mapping |
| Error Hierarchy | `src/lib/errors/index.ts` | Custom error classes |
| Serialize Utility | `src/lib/server/serialize.ts` | Decimal-to-number |
| Entity Types | `src/types/entities.ts` | Frontend type definitions |
| Data Actions | `src/features/dashboard/data/actions.ts` | Import server actions |
| Auth Config | `src/lib/auth.ts` | Better Auth setup |
| Logger | `src/lib/logger.ts` | Structured logging |
| Number Parser | `src/lib/utils/number-parser.ts` | Multi-format parser |
| Prisma Schema | `prisma/schema.prisma` | Database schema |

### Konvensi Prioritas

| Label | Arti | SLA |
|-------|------|-----|
| **P0** | Kritis - Risiko keamanan, arsitektur rusak, data loss | Sprint berikutnya |
| **P1** | Major - Menghambat maintainability, DRY violation besar | 2-4 minggu |
| **P2** | Minor - Inkonsistensi, code smell, dead code | Opportunistic |
| **P3** | Saran - Optimisasi, nice-to-have | Backlog |

---

*Dokumen ini dihasilkan melalui analisis manual kode oleh AI. Semua temuan telah diverifikasi terhadap source code aktual. Untuk pertanyaan atau klarifikasi, rujuk ke file yang disebutkan di setiap temuan.*
