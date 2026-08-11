-- AlterTable
ALTER TABLE "products" ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: every existing CUSTOM-productLine product was created as a
-- service with currentStock 0 and no stock deduction path at all, so the
-- default `true` above would misrepresent them as "tracked, and out of
-- stock". Mark them untracked to match the behavior they already had.
UPDATE "products" SET "trackStock" = false WHERE "productLine" = 'CUSTOM';

-- Backfill: CUSTOM-linked menu items were created with isAvailable = false
-- back when custom items were unconditionally hidden from the public
-- storefront. Storefront visibility is now controlled by
-- Store.customProductsShowOnStorefront instead (see getStorefrontBySlug), so
-- that flag is no longer the gate — it only makes the item render as
-- "SOLD OUT" on a storefront the owner has deliberately published it to.
UPDATE "menu_items" SET "isAvailable" = true
FROM "products"
WHERE "menu_items"."productId" = "products"."id"
  AND "products"."productLine" = 'CUSTOM';
