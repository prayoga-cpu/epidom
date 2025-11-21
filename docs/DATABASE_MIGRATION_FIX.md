# Database Migration Fix - Add reason and referenceId to stock_movements

## Problem

Error saat menjalankan aplikasi:
```
The column `stock_movements.reason` does not exist in the current database.
The column `stock_movements.referenceId` does not exist in the current database.
```

## Root Cause

Schema Prisma sudah diupdate dengan field `reason` dan `referenceId`, tapi migration belum dijalankan ke database.

## Solution

### 1. ✅ Created Migration File
**File:** `prisma/migrations/20251118004202_add_reason_reference_to_stock_movement/migration.sql`

```sql
-- AlterTable: Add reason and referenceId columns to stock_movements
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
```

### 2. ✅ Executed SQL Script
**File:** `scripts/add-stock-movement-columns.ts`

Script TypeScript yang menjalankan SQL langsung ke database menggunakan Prisma client.

### 3. ✅ Regenerated Prisma Client
```bash
npx prisma generate
```

## Verification

- ✅ Columns added to database
- ✅ Prisma client regenerated
- ✅ Build successful
- ✅ All `stockMovement.create()` calls should now work

## Files Modified

- `prisma/migrations/20251118004202_add_reason_reference_to_stock_movement/migration.sql` (new)
- `scripts/add-stock-movement-columns.ts` (new)
- `scripts/add-stock-movement-columns.sql` (new)

## Next Steps

1. ✅ Migration completed
2. ✅ Database updated
3. ✅ Prisma client regenerated
4. ✅ Build verified

**Status:** ✅ RESOLVED

