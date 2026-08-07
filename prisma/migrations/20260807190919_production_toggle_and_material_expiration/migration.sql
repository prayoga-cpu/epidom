-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "expirationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "productionEnabled" BOOLEAN NOT NULL DEFAULT false;
