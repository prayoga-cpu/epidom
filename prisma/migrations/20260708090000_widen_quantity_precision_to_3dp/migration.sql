-- Widen quantity/stock fields from Decimal(10,2) to Decimal(10,3) so ingredient
-- measurements in grams/milliliters (e.g. 0.002 kg = 2 g) can be stored precisely.
-- Price/currency columns are untouched. Existing values (<=2dp) are unaffected —
-- this only raises the precision ceiling for future writes.

ALTER TABLE "products" ALTER COLUMN "currentStock" TYPE DECIMAL(10,3);
ALTER TABLE "products" ALTER COLUMN "maxStock" TYPE DECIMAL(10,3);
ALTER TABLE "products" ALTER COLUMN "minStock" TYPE DECIMAL(10,3);

ALTER TABLE "ingredients" ALTER COLUMN "currentStock" TYPE DECIMAL(10,3);
ALTER TABLE "ingredients" ALTER COLUMN "maxStock" TYPE DECIMAL(10,3);
ALTER TABLE "ingredients" ALTER COLUMN "minStock" TYPE DECIMAL(10,3);

ALTER TABLE "recipes" ALTER COLUMN "yieldQuantity" TYPE DECIMAL(10,3);

ALTER TABLE "production_batches" ALTER COLUMN "plannedQuantity" TYPE DECIMAL(10,3);
ALTER TABLE "production_batches" ALTER COLUMN "actualQuantity" TYPE DECIMAL(10,3);

ALTER TABLE "supplier_order_items" ALTER COLUMN "quantity" TYPE DECIMAL(10,3);
