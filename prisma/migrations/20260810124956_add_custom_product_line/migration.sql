-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('STANDARD', 'CUSTOM');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "showOnCashier" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "productLine" "ProductLine" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "customProductsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customProductsLabel" TEXT;

-- CreateIndex
CREATE INDEX "products_productLine_idx" ON "products"("productLine");
