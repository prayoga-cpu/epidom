-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "syncFinanceWithBusiness" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "business_finance_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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

    CONSTRAINT "business_finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_finance_settings_businessId_key" ON "business_finance_settings"("businessId");

-- AddForeignKey
ALTER TABLE "business_finance_settings" ADD CONSTRAINT "business_finance_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
