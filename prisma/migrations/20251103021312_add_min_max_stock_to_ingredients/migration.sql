/*
  Warnings:

  - You are about to drop the column `businessId` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `criticalLevel` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `minStockLevel` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `production_batches` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `suppliers` table. All the data in the column will be lost.
  - Added the required column `storeId` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `production_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ingredients" DROP CONSTRAINT "ingredients_businessId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ingredients" DROP CONSTRAINT "ingredients_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_businessId_fkey";

-- DropForeignKey
ALTER TABLE "public"."production_batches" DROP CONSTRAINT "production_batches_businessId_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_businessId_fkey";

-- DropForeignKey
ALTER TABLE "public"."recipes" DROP CONSTRAINT "recipes_businessId_fkey";

-- DropForeignKey
ALTER TABLE "public"."suppliers" DROP CONSTRAINT "suppliers_businessId_fkey";

-- DropIndex
DROP INDEX "public"."ingredients_businessId_idx";

-- DropIndex
DROP INDEX "public"."ingredients_supplierId_idx";

-- DropIndex
DROP INDEX "public"."orders_businessId_idx";

-- DropIndex
DROP INDEX "public"."production_batches_businessId_idx";

-- DropIndex
DROP INDEX "public"."products_businessId_idx";

-- DropIndex
DROP INDEX "public"."recipes_businessId_idx";

-- DropIndex
DROP INDEX "public"."suppliers_businessId_idx";

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "businessId",
DROP COLUMN "criticalLevel",
DROP COLUMN "image",
DROP COLUMN "minStockLevel",
DROP COLUMN "supplierId",
ADD COLUMN     "maxStock" DECIMAL(10,2) NOT NULL DEFAULT 1000,
ADD COLUMN     "minStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "businessId",
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "production_batches" DROP COLUMN "businessId",
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "businessId",
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "businessId",
ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "businessId",
ADD COLUMN     "storeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_suppliers" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stores_businessId_idx" ON "stores"("businessId");

-- CreateIndex
CREATE INDEX "stores_isActive_idx" ON "stores"("isActive");

-- CreateIndex
CREATE INDEX "ingredient_suppliers_materialId_idx" ON "ingredient_suppliers"("materialId");

-- CreateIndex
CREATE INDEX "ingredient_suppliers_supplierId_idx" ON "ingredient_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_suppliers_materialId_supplierId_key" ON "ingredient_suppliers"("materialId", "supplierId");

-- CreateIndex
CREATE INDEX "ingredients_storeId_idx" ON "ingredients"("storeId");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");

-- CreateIndex
CREATE INDEX "production_batches_storeId_idx" ON "production_batches"("storeId");

-- CreateIndex
CREATE INDEX "products_storeId_idx" ON "products"("storeId");

-- CreateIndex
CREATE INDEX "recipes_storeId_idx" ON "recipes"("storeId");

-- CreateIndex
CREATE INDEX "suppliers_storeId_idx" ON "suppliers"("storeId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_suppliers" ADD CONSTRAINT "ingredient_suppliers_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_suppliers" ADD CONSTRAINT "ingredient_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
