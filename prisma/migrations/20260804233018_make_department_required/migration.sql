/*
  Warnings:

  - Made the column `department` on table `menu_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `department` on table `products` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill: unrecognized/unset department data defaults to Kitchen
UPDATE "menu_items" SET "department" = 'KITCHEN' WHERE "department" IS NULL;
UPDATE "products" SET "department" = 'KITCHEN' WHERE "department" IS NULL;

-- AlterTable
ALTER TABLE "menu_items" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "department" SET DEFAULT 'KITCHEN';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "department" SET DEFAULT 'KITCHEN';
