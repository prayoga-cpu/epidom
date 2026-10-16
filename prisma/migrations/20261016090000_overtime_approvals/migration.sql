-- CreateEnum
CREATE TYPE "OvertimeDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "overtimeRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "overtime_approvals" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "decision" "OvertimeDecision" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER NOT NULL,
    "decidedByUserId" TEXT,
    "decidedByStaffMemberId" TEXT,
    "decidedByName" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overtime_approvals_storeId_date_idx" ON "overtime_approvals"("storeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_approvals_staffMemberId_date_key" ON "overtime_approvals"("staffMemberId", "date");

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

