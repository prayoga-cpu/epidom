-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('TIP', 'PETTY_IN', 'PETTY_OUT', 'DROP', 'PAYOUT');

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "staffMemberId" TEXT,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_movements_storeId_idx" ON "cash_movements"("storeId");

-- CreateIndex
CREATE INDEX "cash_movements_shiftId_idx" ON "cash_movements"("shiftId");

-- CreateIndex
CREATE INDEX "cash_movements_storeId_occurredAt_idx" ON "cash_movements"("storeId", "occurredAt");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
