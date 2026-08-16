-- Retire the two columns the two-tier stock model superseded.
--
-- NEITHER DROP LOSES INFORMATION, which is what makes this safe to do as a
-- plain forward migration:
--
--   products."trackStock"        == ("stockMode" <> 'UNTRACKED')
--   recipe_products."isDefault"  was false on every row (the only writer
--                                hardcoded it), and the real answer now lives
--                                in products."primaryRecipeId"
--
-- Both are therefore fully reconstructible from data that remains — see the
-- down-SQL at the bottom, which restores them exactly rather than approximately.
--
-- Gate satisfied before running this: scripts/report-stock-mode-integrity.ts
-- returns zero rows for BOTH "trackStock desynced from stockMode" and
-- "cross-store primaryRecipeId", and no code path reads either column.

-- Guard: refuse to drop if anything desynced while the columns coexisted.
-- A desync would mean some write path bypassed productService, and silently
-- dropping the evidence would strand those products in the wrong mode.
DO $$
DECLARE desynced integer;
BEGIN
  SELECT count(*) INTO desynced
    FROM "products"
   WHERE "trackStock" <> ("stockMode" <> 'UNTRACKED');
  IF desynced > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop trackStock: % product(s) have trackStock desynced from stockMode. Run scripts/report-stock-mode-integrity.ts and reconcile first.',
      desynced;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "trackStock";

-- AlterTable
ALTER TABLE "recipe_products" DROP COLUMN "isDefault";

-- ---------------------------------------------------------------------------
-- Manual down-SQL (Prisma migrations are forward-only). Both columns are
-- reconstructed EXACTLY, not approximately:
--
--   ALTER TABLE "products" ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true;
--   UPDATE "products" SET "trackStock" = ("stockMode" <> 'UNTRACKED');
--
--   ALTER TABLE "recipe_products" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
--   -- Optional: re-point the legacy flag at whatever primaryRecipeId now says,
--   -- so reverted code deducts for the same recipe rather than nothing at all.
--   UPDATE "recipe_products" rp SET "isDefault" = true
--     FROM "products" p
--    WHERE p."id" = rp."productId" AND p."primaryRecipeId" = rp."recipeId";
-- ---------------------------------------------------------------------------
