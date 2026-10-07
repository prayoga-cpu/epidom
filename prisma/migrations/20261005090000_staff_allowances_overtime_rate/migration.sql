-- CreateEnum
CREATE TYPE "AllowanceBasis" AS ENUM ('PER_DAY', 'PER_MONTH');

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "overtimeRate" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "staff_allowances" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "basis" "AllowanceBasis" NOT NULL DEFAULT 'PER_DAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_allowances_storeId_idx" ON "staff_allowances"("storeId");

-- CreateIndex
CREATE INDEX "staff_allowances_staffMemberId_idx" ON "staff_allowances"("staffMemberId");

-- AddForeignKey
ALTER TABLE "staff_allowances" ADD CONSTRAINT "staff_allowances_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_allowances" ADD CONSTRAINT "staff_allowances_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

