/*
  Warnings:

  - Made the column `department` on table `ingredients` required. This step will fail if there are existing NULL values in that column.
  - Made the column `department` on table `recipes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "Department" ADD VALUE 'BOTH';

-- Backfill: unrecognized/unset department data. Materials default to Both
-- (a raw ingredient with no assigned station is safest treated as shared,
-- so it still surfaces under both Kitchen- and Bar-filtered views). Recipes
-- default to Kitchen, matching Product/MenuItem.
UPDATE "ingredients" SET "department" = 'BOTH' WHERE "department" IS NULL;
UPDATE "recipes" SET "department" = 'KITCHEN' WHERE "department" IS NULL;

-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "department" SET DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "recipes" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "department" SET DEFAULT 'KITCHEN';
