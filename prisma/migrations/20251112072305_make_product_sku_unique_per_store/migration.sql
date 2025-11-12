-- Make product SKU unique per store instead of globally unique
-- This allows different stores to have products with the same SKU
-- Note: This migration was incomplete - it only dropped CONSTRAINT, not INDEX
-- The fix migration (20251112080000) handles the INDEX drop properly

-- Drop the existing unique constraint on sku (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_sku_key'
        AND conrelid = 'products'::regclass
    ) THEN
        ALTER TABLE "products" DROP CONSTRAINT "products_sku_key";
    END IF;
END $$;

-- Create a composite unique constraint on (storeId, sku)
-- This ensures SKU is unique within each store, but different stores can have the same SKU
ALTER TABLE "products"
ADD CONSTRAINT "products_storeId_sku_key"
UNIQUE ("storeId", "sku");

