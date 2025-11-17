-- CreateTable: recipe_products junction table for Many-to-Many relationship
-- This allows one product to be produced by multiple recipes (e.g., 10 baguettes recipe, 50 baguettes recipe)

CREATE TABLE "recipe_products" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_products_recipeId_productId_key" ON "recipe_products"("recipeId", "productId");
CREATE INDEX "recipe_products_recipeId_idx" ON "recipe_products"("recipeId");
CREATE INDEX "recipe_products_productId_idx" ON "recipe_products"("productId");

-- AddForeignKey
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: Copy recipeId from products to recipe_products
-- This preserves existing relationships when migrating from 1:1 to Many-to-Many
INSERT INTO "recipe_products" ("id", "recipeId", "productId", "isDefault", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text as "id",
    p."recipeId",
    p."id" as "productId",
    true as "isDefault", -- Mark existing relationships as default
    p."createdAt",
    p."updatedAt"
FROM "products" p
WHERE p."recipeId" IS NOT NULL;

-- DropForeignKey: Remove old 1:1 relationship foreign key
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_recipeId_fkey";

-- DropIndex: Remove old recipeId index
DROP INDEX IF EXISTS "products_recipeId_idx";

-- AlterTable: Remove recipeId column from products
ALTER TABLE "products" DROP COLUMN IF EXISTS "recipeId";

