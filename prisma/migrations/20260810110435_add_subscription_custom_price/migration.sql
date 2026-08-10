-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "customPriceAmount" DECIMAL(10,2),
ADD COLUMN     "customPriceCurrency" TEXT,
ADD COLUMN     "customPriceInterval" "BillingInterval";
