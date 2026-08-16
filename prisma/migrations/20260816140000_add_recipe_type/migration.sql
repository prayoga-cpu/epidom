-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('KITCHEN', 'BATCH');

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "type" "RecipeType" NOT NULL DEFAULT 'KITCHEN';

-- No backfill statement needed, and that is the point of the default.
--
-- `Recipe.type` answers "how is this recipe PRODUCED", which is a different
-- question from `Product.stockMode` ("what does a SALE consume"). Every recipe
-- in this operator's data is a kitchen recipe — cooked fresh to order — which
-- is exactly what the column default already says, and it matches the
-- MADE_TO_ORDER classification applied to their recipe-linked products in
-- 20260816120000_recipes_are_cooked_to_order.
--
-- KITCHEN is also the SAFE default for anything created later, including by
-- the CSV/AI importer, which writes prisma.recipe.create directly and bypasses
-- Zod. A recipe wrongly marked BATCH would start rounding its ingredient draw
-- UP to a whole batch — a run for 3 units of a yield-5 recipe would take a full
-- batch of flour instead of three fifths. Wrongly marked KITCHEN merely keeps
-- today's behaviour.

-- ---------------------------------------------------------------------------
-- Manual down-SQL (Prisma migrations are forward-only).
--   ALTER TABLE "recipes" DROP COLUMN "type";
--   DROP TYPE "RecipeType";
-- Nothing else depends on the column, so this is a clean reverse.
-- ---------------------------------------------------------------------------
