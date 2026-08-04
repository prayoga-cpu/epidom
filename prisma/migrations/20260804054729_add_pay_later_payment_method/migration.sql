-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAY_LATER';

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "payLaterEnabled" BOOLEAN NOT NULL DEFAULT false;
