-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "username" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_storeId_username_key" ON "staff_members"("storeId", "username");
