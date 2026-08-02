-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "processingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "processingFeeRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceChargeRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "store_finance_settings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "taxLabel" TEXT,
    "taxInclusive" BOOLEAN NOT NULL DEFAULT true,
    "serviceChargeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargeRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "processingFeeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "processingFeeOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_finance_settings_storeId_key" ON "store_finance_settings"("storeId");

-- AddForeignKey
ALTER TABLE "store_finance_settings" ADD CONSTRAINT "store_finance_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
