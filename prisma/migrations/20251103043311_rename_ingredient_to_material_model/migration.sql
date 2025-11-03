/*
  Warnings:

  - You are about to drop the column `materialId` on the `ingredient_suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `materialId` on the `recipe_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `materialId` on the `stock_movements` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[materialId,supplierId]` on the table `ingredient_suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[recipeId,materialId]` on the table `recipe_ingredients` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `materialId` to the `ingredient_suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `materialId` to the `recipe_ingredients` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ingredient_suppliers" DROP CONSTRAINT "ingredient_suppliers_materialId_fkey";

-- DropForeignKey
ALTER TABLE "public"."recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_materialId_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_materialId_fkey";

-- DropIndex
DROP INDEX "public"."ingredient_suppliers_materialId_idx";

-- DropIndex
DROP INDEX "public"."ingredient_suppliers_materialId_supplierId_key";

-- DropIndex
DROP INDEX "public"."recipe_ingredients_recipeId_materialId_key";

-- DropIndex
DROP INDEX "public"."stock_movements_materialId_idx";

-- AlterTable
ALTER TABLE "ingredient_suppliers" DROP COLUMN "materialId",
ADD COLUMN     "materialId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "recipe_ingredients" DROP COLUMN "materialId",
ADD COLUMN     "materialId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "stock_movements" DROP COLUMN "materialId",
ADD COLUMN     "materialId" TEXT;

-- CreateIndex
CREATE INDEX "ingredient_suppliers_materialId_idx" ON "ingredient_suppliers"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_suppliers_materialId_supplierId_key" ON "ingredient_suppliers"("materialId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipeId_materialId_key" ON "recipe_ingredients"("recipeId", "materialId");

-- CreateIndex
CREATE INDEX "stock_movements_materialId_idx" ON "stock_movements"("materialId");

-- AddForeignKey
ALTER TABLE "ingredient_suppliers" ADD CONSTRAINT "ingredient_suppliers_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
