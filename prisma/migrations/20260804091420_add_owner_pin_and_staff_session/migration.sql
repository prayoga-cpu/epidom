-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "ownerPin" TEXT;

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_key" ON "staff_sessions"("token");

-- CreateIndex
CREATE INDEX "staff_sessions_storeId_idx" ON "staff_sessions"("storeId");

-- CreateIndex
CREATE INDEX "staff_sessions_staffMemberId_idx" ON "staff_sessions"("staffMemberId");

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
