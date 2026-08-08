-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'MONTHLY', 'NONE');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unitCostSnapshot" DECIMAL(14,6);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "refundAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "payRate" DECIMAL(12,2),
ADD COLUMN     "payType" "PayType" NOT NULL DEFAULT 'NONE';
