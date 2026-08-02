-- CreateEnum
CREATE TYPE "Department" AS ENUM ('KITCHEN', 'BAR');

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "department" "Department";

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "department" "Department";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "department" "Department";

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "department" "Department";

-- CreateIndex
CREATE INDEX "ingredients_department_idx" ON "ingredients"("department");

-- CreateIndex
CREATE INDEX "menu_items_department_idx" ON "menu_items"("department");

-- CreateIndex
CREATE INDEX "products_department_idx" ON "products"("department");

-- CreateIndex
CREATE INDEX "recipes_department_idx" ON "recipes"("department");
