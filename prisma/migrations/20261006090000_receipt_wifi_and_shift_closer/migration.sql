-- AlterTable
ALTER TABLE "store_receipt_settings" ADD COLUMN     "showWifiOnReceipt" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "wifiName" TEXT,
ADD COLUMN     "wifiPassword" TEXT;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "closedByStaffMemberId" TEXT,
ADD COLUMN     "closedFromBackOffice" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closedByStaffMemberId_fkey" FOREIGN KEY ("closedByStaffMemberId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

