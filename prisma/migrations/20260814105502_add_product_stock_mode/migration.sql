-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('BATCH_PRODUCED', 'MADE_TO_ORDER', 'UNTRACKED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "optionCostSnapshot" DECIMAL(14,6);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stockDeductedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN     "materialsDrawnAt" TIMESTAMP(3),
ADD COLUMN     "settledQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "primaryRecipeId" TEXT,
ADD COLUMN     "stockMode" "StockMode" NOT NULL DEFAULT 'BATCH_PRODUCED';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "reversesMovementId" TEXT;

-- Backfill: stockMode. Deliberately ONE pass with a CASE rather than one
-- UPDATE per value — each pass is a full rewrite of "products", and this runs
-- inside `prisma migrate deploy`, which package.json executes as the FIRST
-- step of `pnpm build` while the PREVIOUS deployment is still serving live POS
-- traffic.
--
-- trackStock = false was introduced by 20260811033102_add_product_track_stock
-- to mark services and always-available items (a haircut, a cover charge) —
-- exactly UNTRACKED's meaning. Carried across verbatim so the Custom Products
-- tab's behavior is untouched.
--
-- trackStock = true products already carry a real "currentStock" that
-- decrements on sale; that IS counted finished-goods behavior, and flipping
-- them to MADE_TO_ORDER would strand those counts. Note this is NOT
-- behavior-neutral for the subset that has no recipe: those can now go
-- negative instead of clamping at 0. That is intended, and is surfaced as a
-- distinct "Oversold" state rather than hidden.
UPDATE "products"
   SET "stockMode" = CASE WHEN "trackStock" THEN 'BATCH_PRODUCED'::"StockMode"
                          ELSE 'UNTRACKED'::"StockMode" END;

-- Backfill: primaryRecipeId supersedes RecipeProduct.isDefault, which has been
-- false on every app-written row since product.repository.ts began writing
-- `isDefault: false, // No default recipes anymore` — silently disabling
-- sale-time ingredient deduction and ORDER_SHORTFALL drafting for every link
-- the dashboard has ever created. Elect exactly one link per product: any
-- surviving legacy default first, then the oldest link (the same choice
-- start-production-dialog.tsx already makes by array position). Products with
-- several links are alternative batch sizes ("10 baguettes" / "50 baguettes");
-- the oldest is the safest default and the owner can change it in the product
-- form.
--
-- isDefault itself is left untouched on purpose, so that a code-only revert of
-- this release restores the previous query behavior exactly.
--
-- Cross-store rows cannot arise through the app (recipe_products is only ever
-- written by a store-scoped product form) and the NEW write path validates
-- store ownership explicitly; scripts/report-stock-mode-integrity.ts reports
-- any pre-existing cross-store row rather than silently trusting it.
UPDATE "products" p SET "primaryRecipeId" = pick."recipeId"
  FROM (
    SELECT DISTINCT ON ("productId") "productId", "recipeId"
      FROM "recipe_products"
     ORDER BY "productId", "isDefault" DESC, "createdAt" ASC, "id" ASC
  ) pick
 WHERE pick."productId" = p."id";

-- CreateIndex
CREATE INDEX "production_batches_productId_materialsDrawnAt_idx" ON "production_batches"("productId", "materialsDrawnAt");

-- CreateIndex
CREATE INDEX "products_stockMode_idx" ON "products"("stockMode");

-- CreateIndex
CREATE INDEX "products_primaryRecipeId_idx" ON "products"("primaryRecipeId");

-- CreateIndex
CREATE INDEX "stock_movements_orderId_type_createdAt_idx" ON "stock_movements"("orderId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_reversesMovementId_idx" ON "stock_movements"("reversesMovementId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_primaryRecipeId_fkey" FOREIGN KEY ("primaryRecipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Manual down-SQL. Prisma migrations are forward-only; this is documented here
-- rather than in a folder README because no migration folder in this repo uses
-- one. Note this reverses SCHEMA only — negative currentStock values written
-- while the clamps were off, and ADJUSTMENT self-heal rows, are permanent.
--
--   ALTER TABLE "products" DROP CONSTRAINT "products_primaryRecipeId_fkey";
--   DROP INDEX "products_primaryRecipeId_idx", "products_stockMode_idx",
--              "stock_movements_orderId_type_createdAt_idx",
--              "stock_movements_reversesMovementId_idx",
--              "production_batches_productId_materialsDrawnAt_idx";
--   ALTER TABLE "products" DROP COLUMN "primaryRecipeId", DROP COLUMN "stockMode";
--   ALTER TABLE "order_items" DROP COLUMN "optionCostSnapshot";
--   ALTER TABLE "orders" DROP COLUMN "stockDeductedAt";
--   ALTER TABLE "stock_movements" DROP COLUMN "reversesMovementId";
--   ALTER TABLE "production_batches" DROP COLUMN "materialsDrawnAt",
--                                    DROP COLUMN "settledQuantity";
--   DROP TYPE "StockMode";
-- ---------------------------------------------------------------------------
