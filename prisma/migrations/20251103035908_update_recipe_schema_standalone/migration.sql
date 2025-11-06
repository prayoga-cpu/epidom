/*
  Warnings:

  - You are about to drop the column `batchSize` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `batchUnit` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `recipes` table. All the data in the column will be lost.
  - Added the required column `name` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productionTimeMinutes` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yieldQuantity` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yieldUnit` to the `recipes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."recipes" DROP CONSTRAINT "recipes_productId_fkey";

-- DropIndex
DROP INDEX "public"."recipes_productId_key";

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "batchSize",
DROP COLUMN "batchUnit",
DROP COLUMN "productId",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "costPerBatch" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "productionTimeMinutes" INTEGER NOT NULL,
ADD COLUMN     "yieldQuantity" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "yieldUnit" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "recipes_category_idx" ON "recipes"("category");
