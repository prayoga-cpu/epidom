-- CreateEnum
CREATE TYPE "WasteReason" AS ENUM ('EXPIRED', 'DAMAGED', 'SPOILED', 'OVERPRODUCTION', 'QUALITY_CONTROL', 'OTHER');

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "wasteEntryId" TEXT;

-- CreateTable
CREATE TABLE "waste_entries" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "materialId" TEXT,
    "productId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" "WasteReason" NOT NULL,
    "customReason" TEXT,
    "notes" TEXT,
    "unitCostSnapshot" DECIMAL(14,6) NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waste_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waste_entries_storeId_idx" ON "waste_entries"("storeId");

-- CreateIndex
CREATE INDEX "waste_entries_materialId_idx" ON "waste_entries"("materialId");

-- CreateIndex
CREATE INDEX "waste_entries_productId_idx" ON "waste_entries"("productId");

-- CreateIndex
CREATE INDEX "waste_entries_reason_idx" ON "waste_entries"("reason");

-- CreateIndex
CREATE INDEX "waste_entries_createdAt_idx" ON "waste_entries"("createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_wasteEntryId_idx" ON "stock_movements"("wasteEntryId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_wasteEntryId_fkey" FOREIGN KEY ("wasteEntryId") REFERENCES "waste_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_entries" ADD CONSTRAINT "waste_entries_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_entries" ADD CONSTRAINT "waste_entries_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_entries" ADD CONSTRAINT "waste_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
