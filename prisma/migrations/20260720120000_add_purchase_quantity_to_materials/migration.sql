-- Adds pack-based pricing to Materials: purchaseQuantity records how many
-- base `unit`s come in one purchase pack (e.g. 1000 if unit="g" and it's
-- bought in 1kg bags), so unitCost/price can be derived server-side as
-- purchasePrice ÷ purchaseQuantity instead of requiring manual division.
-- Existing rows default to purchaseQuantity=1, so their unitCost/price keeps
-- meaning exactly what it did before this migration (price per 1 unit).
--
-- unitCost/price precision is widened from Decimal(10,2) to Decimal(14,6)
-- since a derived per-unit cost (e.g. €0.002/g) can need more than 2 decimal
-- places; this only raises the precision ceiling, existing values (<=2dp)
-- are unaffected.

ALTER TABLE "ingredients" ALTER COLUMN "unitCost" TYPE DECIMAL(14,6);
ALTER TABLE "ingredients" ADD COLUMN "purchaseQuantity" DECIMAL(10,3) NOT NULL DEFAULT 1;

ALTER TABLE "ingredient_suppliers" ALTER COLUMN "price" TYPE DECIMAL(14,6);
ALTER TABLE "ingredient_suppliers" ADD COLUMN "purchaseQuantity" DECIMAL(10,3) NOT NULL DEFAULT 1;
