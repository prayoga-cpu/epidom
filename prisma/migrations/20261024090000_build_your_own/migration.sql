-- AlterTable
ALTER TABLE "products" ADD COLUMN     "buildYourOwn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "buildYourOwn" BOOLEAN NOT NULL DEFAULT false;

-- Items the Build Your Own import created (it files them under a category
-- named "Build Your Own") keep the builder they already had. Every other item
-- starts with Build Your Own off.
UPDATE "menu_items" AS mi
SET "buildYourOwn" = true
FROM "menu_categories" AS mc
WHERE mi."categoryId" = mc."id"
  AND mc."name" = 'Build Your Own';
