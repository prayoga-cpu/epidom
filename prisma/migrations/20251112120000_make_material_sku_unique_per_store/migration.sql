-- Make material (ingredient) SKU unique per store instead of globally unique
-- This allows different stores to have materials with the same SKU
-- This matches the Product SKU constraint pattern

-- Drop the old unique constraint on sku (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ingredients_sku_key'
        AND conrelid = 'ingredients'::regclass
    ) THEN
        ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_sku_key";
    END IF;
END $$;

-- Drop the old unique index on sku (if it exists)
-- This ensures we remove both constraint and index
DROP INDEX IF EXISTS "ingredients_sku_key";

-- Create composite unique constraint on (storeId, sku)
-- This ensures SKU is unique within each store, but different stores can have the same SKU
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ingredients_storeId_sku_key'
        AND conrelid = 'ingredients'::regclass
    ) THEN
        ALTER TABLE "ingredients"
        ADD CONSTRAINT "ingredients_storeId_sku_key"
        UNIQUE ("storeId", "sku");
    END IF;
END $$;

