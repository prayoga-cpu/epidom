-- Fix: Drop old unique index on sku and create composite unique constraint
-- This allows different stores to have products with the same SKU

-- Drop the old unique index (created in initial migration as UNIQUE INDEX)
DROP INDEX IF EXISTS "products_sku_key";

-- Create composite unique constraint on (storeId, sku)
-- This ensures SKU is unique within each store, but different stores can have the same SKU
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'products_storeId_sku_key'
        AND conrelid = 'products'::regclass
    ) THEN
        ALTER TABLE "products"
        ADD CONSTRAINT "products_storeId_sku_key"
        UNIQUE ("storeId", "sku");
    END IF;
END $$;
